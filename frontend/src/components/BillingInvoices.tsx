import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, Zap, Droplets, Building2, Car, Wrench, Package, X, ChevronRight,
  Clock, CheckCircle2, Layers, DollarSign,
  FileSpreadsheet, CheckSquare, Square, Loader2, Send
} from 'lucide-react';
import { api } from '../services/api';
import { startVisiblePolling } from '../services/visiblePolling';
import type { BulkJob, InvoiceDetail, InvoiceListItem, PendingManualConfirmation } from '../types';
import { ReportExportModal } from './ReportExportModal';
import { BillingRateModal } from './BillingRateModal';
import { createStaggerContainer, staggerItemVariants, MOTION_SPRINGS } from '../tokens/motionTokens';
import { WarmSkeletonCard } from './ui/WarmSkeleton';
import { WarmEmptyState } from './ui/WarmEmptyState';
import { SmoothProgressBar } from './ui/SmoothProgressBar';

/* ─── SERVICE TYPE → ICON + LABEL MAP ─── */
const SERVICE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  electricity: { icon: <Zap size={16} />, label: 'Điện sinh hoạt', color: 'var(--accent-amber)' },
  water: { icon: <Droplets size={16} />, label: 'Nước sinh hoạt', color: 'var(--accent-blue)' },
  management_fee: { icon: <Building2 size={16} />, label: 'Phí quản lý', color: 'var(--accent-emerald)' },
  parking: { icon: <Car size={16} />, label: 'Phí gửi xe', color: 'var(--accent-violet)' },
  maintenance: { icon: <Wrench size={16} />, label: 'Bảo trì', color: 'var(--accent-cyan)' },
  other: { icon: <Package size={16} />, label: 'Dịch vụ khác', color: 'var(--text-secondary)' },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Bản nháp', bg: 'rgba(142, 134, 126, 0.12)', color: 'var(--text-muted)' },
  pending: { label: 'Chờ thanh toán', bg: 'rgba(184, 115, 25, 0.12)', color: 'var(--accent-amber)' },
  paid: { label: 'Đã thanh toán', bg: 'rgba(74, 124, 89, 0.12)', color: 'var(--accent-emerald)' },
  overdue: { label: 'Quá hạn', bg: 'rgba(200, 82, 82, 0.12)', color: 'var(--accent-rose)' },
  cancelled: { label: 'Đã huỷ', bg: 'rgba(142, 134, 126, 0.12)', color: 'var(--text-muted)' },
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ─── TAB TYPE ─── */
type BillingTab = 'current' | 'history';

interface BillingInvoicesProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
}

export const BillingInvoices: React.FC<BillingInvoicesProps> = ({
  isOpen,
  onClose,
  asPage = false,
}) => {
  const [activeTab, setActiveTab] = useState<BillingTab>('current');
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingManualConfirmation[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  /* Bulk operations & modals state */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [activeJob, setActiveJob] = useState<BulkJob | null>(null);
  const stopJobPolling = useRef<(() => void) | null>(null);
  useEffect(() => () => stopJobPolling.current?.(), []);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  /* Load invoices */
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getInvoices(undefined, 1, 50);
      setInvoices(res.items || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPendingConfirmations = useCallback(async () => {
    try {
      setPendingConfirmations(await api.getPendingManualConfirmations());
    } catch (err) {
      console.error('Failed to load pending payment confirmations:', err);
    }
  }, []);

  const approveManualConfirmation = async (confirmation: PendingManualConfirmation) => {
    if (!window.confirm(`Bạn đã đối soát giao dịch ngân hàng cho hóa đơn ${confirmation.invoice_number} (${formatVND(confirmation.amount)})?`)) return;
    setApprovingId(confirmation.id);
    setActionFeedback('Đang ghi nhận kết quả đối soát...');
    try {
      const job = await api.approveBulkManualConfirmations({ confirmation_ids: [confirmation.id] });
      let result = job;
      for (let attempt = 0; attempt < 20 && (result.status === 'pending' || result.status === 'processing'); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await api.getBulkJobStatus(job.id);
      }
      if (result.status !== 'completed' || result.failed_items > 0 || result.processed_items !== 1) {
        throw new Error('Không thể xác nhận thanh toán. Vui lòng kiểm tra lại trạng thái hóa đơn.');
      }
      setActionFeedback(`Đã xác nhận thanh toán hóa đơn ${confirmation.invoice_number}.`);
      await Promise.all([loadInvoices(), loadPendingConfirmations()]);
    } catch (err: any) {
      setActionFeedback(err.message || 'Đối soát thanh toán thất bại.');
    } finally {
      setApprovingId(null);
    }
  };

  /* Toggle selection of a single invoice */
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  /* Toggle select all in current tab */
  const handleSelectAll = () => {
    const list = activeTab === 'current' ? currentInvoices : historyInvoices;
    if (selectedIds.length === list.length && list.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list.map(i => i.id));
    }
  };

  /* Bulk Invoice Generation */
  const handleGenerateBulkInvoices = async () => {
    if (!window.confirm('Hệ thống sẽ phát hành hóa đơn tự động cho tất cả căn hộ trong chu kỳ tháng này. Bạn có muốn tiếp tục?')) {
      return;
    }
    setIsGeneratingBulk(true);
    setActionFeedback('Đang khởi tạo tiến trình phát hành hóa đơn hàng loạt...');
    try {
      const job = await api.generateBulkInvoices({});
      setActiveJob(job);

      // Poll job progress
      stopJobPolling.current?.();
      stopJobPolling.current = startVisiblePolling(async () => {
        try {
          const status = await api.getBulkJobStatus(job.id);
          setActiveJob(status);
          if (status.status === 'completed' || status.status === 'failed') {
            stopJobPolling.current?.();
            setIsGeneratingBulk(false);
            loadInvoices();
            setActionFeedback(
              status.status === 'completed'
                ? `Đã phát hành thành công ${status.processed_items} hóa đơn!`
                : `Phát hành hóa đơn thất bại: ${status.error_summary?.length || 0} lỗi`
            );
            setTimeout(() => setActionFeedback(null), 5000);
          }
        } catch {
          stopJobPolling.current?.();
          setIsGeneratingBulk(false);
        }
      }, 1500, false);
    } catch (err: any) {
      setIsGeneratingBulk(false);
      setActionFeedback(err.message || 'Lỗi khi khởi tạo phát hành hóa đơn hàng loạt.');
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  /* Bulk Overdue Reminders */
  const handleSendBulkReminders = async () => {
    const count = selectedIds.length;
    if (count === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn gửi thông báo nhắc hạn thanh toán tức thì tới ${count} căn hộ đã chọn?`)) {
      return;
    }

    setActionFeedback(`Đang gửi thông báo nhắc nợ tới ${count} căn hộ...`);
    try {
      const job = await api.sendBulkReminders({ min_overdue_days: 1 });
      setActiveJob(job);
      setSelectedIds([]);
      setActionFeedback(`Đã kích hoạt gửi nhắc nợ hàng loạt (Job ID: ${job.id.slice(0, 8)})`);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback(err.message || 'Gửi nhắc nợ hàng loạt thất bại.');
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadInvoices();
      loadPendingConfirmations();
      setSelectedInvoice(null);
    }
  }, [isOpen, asPage, loadInvoices, loadPendingConfirmations]);

  if (!isOpen && !asPage) return null;

  /* Load invoice detail */
  const openInvoiceDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const detail = await api.getInvoiceDetail(id);
      setSelectedInvoice(detail);
    } catch (err) {
      console.error('Failed to load invoice detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen && !asPage) return null;

  /* Partition invoices */
  const currentInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const historyInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'cancelled');

  /* Days until due */
  const daysUntilDue = (dueDateStr: string) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      {/* Backdrop */}
      {!asPage && onClose && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(45, 40, 37, 0.4)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Main Container / Drawer */}
      <div
        role="region"
        aria-label="Dịch vụ & Hoá đơn"
        style={{
          position: asPage ? 'relative' : 'fixed',
          top: asPage ? undefined : 0,
          right: asPage ? undefined : 0,
          bottom: asPage ? undefined : 0,
          width: asPage ? '100%' : 'min(520px, 95vw)',
          minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
          zIndex: asPage ? 10 : 10000,
          background: 'var(--bg-main)',
          border: asPage ? '1px solid var(--border-subtle)' : undefined,
          borderLeft: asPage ? undefined : '1px solid var(--border-subtle)',
          borderRadius: asPage ? '16px' : undefined,
          boxShadow: asPage ? '0 2px 12px rgba(45, 40, 37, 0.05)' : '-8px 0 30px rgba(45, 40, 37, 0.08)',
          display: 'flex', flexDirection: 'column',
          animation: asPage ? 'fadeIn 0.2s ease' : 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/* ─── Header ─── */}
        <header style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-cyan-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-cyan)',
            }}>
              <Receipt size={18} />
            </div>
            <div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0,
              }}>
                Dịch vụ & Hoá đơn
              </h2>
              <p style={{
                fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px',
              }}>
                Quản lý hoá đơn và thanh toán dịch vụ
              </p>
            </div>
          </div>
          {!asPage && onClose && (
            <button
              onClick={onClose}
              aria-label="Đóng"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px',
                borderRadius: 'var(--radius-sm)', display: 'flex',
                transition: 'color var(--transition-fast)',
              }}
            >
              <X size={20} />
            </button>
          )}
        </header>

        {/* ─── Tab Switcher ─── */}
        <nav style={{
          display: 'flex', padding: '0 24px', gap: '4px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {([
            { key: 'current' as BillingTab, label: 'Hoá đơn hiện tại', count: currentInvoices.length },
            { key: 'history' as BillingTab, label: 'Lịch sử thanh toán', count: historyInvoices.length },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedInvoice(null); }}
              style={{
                flex: 1, padding: '12px 8px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                fontSize: '0.82rem', fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                position: 'relative',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: '6px', fontSize: '0.72rem', fontWeight: 600,
                  background: activeTab === tab.key ? 'var(--accent-cyan-glow)' : 'var(--bg-elevated)',
                  color: activeTab === tab.key ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  padding: '1px 7px', borderRadius: 'var(--radius-full)',
                }}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="billingTabIndicator"
                  transition={MOTION_SPRINGS.snappy}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '10%',
                    right: '10%',
                    height: '2.5px',
                    backgroundColor: 'var(--accent-cyan)',
                    borderRadius: '3px 3px 0 0',
                  }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* ─── Admin Bulk & Rates Action Toolbar ─── */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={handleGenerateBulkInvoices}
            disabled={isGeneratingBulk}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(74, 124, 89, 0.3)',
              backgroundColor: isGeneratingBulk ? 'var(--bg-elevated)' : 'rgba(74, 124, 89, 0.1)',
              color: 'var(--accent-emerald)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: isGeneratingBulk ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            title="Tự động phát hành hoá đơn cho toàn bộ căn hộ trong kỳ"
          >
            {isGeneratingBulk ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Layers size={14} />
            )}
            <span>{isGeneratingBulk ? 'Đang phát hành...' : 'Phát hành hàng loạt'}</span>
          </button>

          <button
            onClick={() => setIsRateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Xem và cập nhật biểu giá điện, nước, phí quản lý có hiệu lực theo ngày"
          >
            <DollarSign size={14} color="var(--accent-amber)" />
            <span>Biểu giá</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Xuất các báo cáo thu phí, công nợ, bảo trì, đối soát sang Excel"
          >
            <FileSpreadsheet size={14} color="var(--accent-cyan)" />
            <span>Báo cáo</span>
          </button>
        </div>

        <section aria-labelledby="manual-confirmations-heading" style={{ margin: '16px 24px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <h3 id="manual-confirmations-heading" style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Chuyển khoản chờ đối soát ({pendingConfirmations.length})
            </h3>
            <button type="button" onClick={loadPendingConfirmations} className="focus-visible:ring-2"
              style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '6px 10px', cursor: 'pointer' }}>
              Tải lại
            </button>
          </div>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Kiểm tra số tiền và mã giao dịch trên sao kê ngân hàng trước khi xác nhận.
          </p>
          {pendingConfirmations.length === 0 && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Không có giao dịch chờ đối soát.</p>}
          {pendingConfirmations.map(confirmation => (
            <article key={confirmation.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{confirmation.invoice_number} · {formatVND(confirmation.amount)}</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>
                  {confirmation.note || 'Không có mã giao dịch'}
                </p>
              </div>
              <button type="button" onClick={() => approveManualConfirmation(confirmation)} disabled={approvingId !== null}
                className="focus-visible:ring-2"
                style={{ border: 0, borderRadius: 'var(--radius-sm)', background: 'var(--accent-emerald)', color: '#fff', padding: '9px 14px', cursor: approvingId ? 'wait' : 'pointer' }}>
                {approvingId === confirmation.id ? 'Đang xác nhận...' : 'Đã đối soát, xác nhận'}
              </button>
            </article>
          ))}
        </section>

        {/* ─── Active Bulk Job Tracker Banner ─── */}
        {activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing') && (
          <div style={{
            margin: '12px 24px 0',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(74, 124, 89, 0.08)',
            border: '1px solid rgba(74, 124, 89, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={14} className="animate-spin" color="var(--accent-emerald)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeJob.job_type === 'invoice_generation' ? 'Đang tạo hoá đơn...' : 'Đang xử lý tiến trình ngầm...'}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {activeJob.processed_items} / {activeJob.total_items || '—'}
              </span>
            </div>
            <SmoothProgressBar
              progress={activeJob.total_items ? Math.round((activeJob.processed_items / activeJob.total_items) * 100) : 45}
              color="var(--accent-emerald)"
              height={6}
            />
          </div>
        )}

        {/* Feedback Alert */}
        {actionFeedback && (
          <div style={{
            margin: '12px 24px 0',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(217, 107, 67, 0.1)',
            border: '1px solid rgba(217, 107, 67, 0.25)',
            fontSize: '0.82rem',
            color: '#D96B43',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{actionFeedback}</span>
            <button
              onClick={() => setActionFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ─── Content Area ─── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {isLoading && !selectedInvoice ? (
            <WarmSkeletonCard count={3} />
          ) : selectedInvoice ? (
            /* ─── Invoice Detail View ─── */
            <div>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 500,
                  padding: '0', marginBottom: '16px', fontFamily: 'var(--font-sans)',
                }}
              >
                ← Quay lại danh sách
              </button>

              {/* Invoice header card */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                padding: '20px', border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-card)', marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                      {selectedInvoice.invoice_number}
                    </p>
                    <h3 style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0,
                    }}>
                      {formatVND(selectedInvoice.total_amount)}
                    </h3>
                  </div>
                  {(() => {
                    const badge = STATUS_BADGE[selectedInvoice.status] || STATUS_BADGE.draft;
                    return (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        padding: '4px 12px', borderRadius: 'var(--radius-full)',
                        background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Due date reminder */}
                {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: selectedInvoice.status === 'overdue'
                      ? 'rgba(200, 82, 82, 0.06)' : 'rgba(74, 124, 89, 0.06)',
                    border: `1px solid ${selectedInvoice.status === 'overdue'
                      ? 'var(--border-rose)' : 'var(--border-emerald)'}`,
                    fontSize: '0.8rem',
                    color: selectedInvoice.status === 'overdue'
                      ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <Clock size={14} />
                    {selectedInvoice.status === 'overdue'
                      ? 'Hoá đơn đã quá hạn thanh toán. Vui lòng thanh toán sớm nhé!'
                      : (() => {
                          const days = daysUntilDue(selectedInvoice.due_date);
                          if (days <= 0) return 'Hôm nay là hạn cuối thanh toán';
                          if (days <= 5) return `Còn ${days} ngày nữa là đến hạn thanh toán — bạn nhé!`;
                          return `Hạn thanh toán: ${formatDate(selectedInvoice.due_date)}`;
                        })()
                    }
                  </div>
                )}

                {selectedInvoice.status === 'paid' && selectedInvoice.paid_at && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(74, 124, 89, 0.06)',
                    border: '1px solid var(--border-emerald)',
                    fontSize: '0.8rem', color: 'var(--accent-emerald)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <CheckCircle2 size={14} />
                    Cảm ơn bạn! Hoá đơn đã được thanh toán thành công ✨
                  </div>
                )}
              </div>

              {/* Line items breakdown */}
              <h4 style={{
                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)',
                margin: '0 0 10px', fontFamily: 'var(--font-sans)',
              }}>
                Chi tiết hoá đơn
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {selectedInvoice.items.map(item => {
                  const meta = SERVICE_META[item.service_type] || SERVICE_META.other;
                  return (
                    <div key={item.id} style={{
                      background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px', border: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-xs)',
                          background: `${meta.color}15`, color: meta.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {meta.icon}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                            {meta.label}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                      }}>
                        {formatVND(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            /* ─── Invoice List View ─── */
            <div>
              {activeTab === 'current' && currentInvoices.length === 0 && (
                <WarmEmptyState
                  title="Không có hoá đơn chờ thanh toán"
                  description="Tuyệt vời! Tất cả hoá đơn dịch vụ của bạn đã được thanh toán hoặc quyết toán đầy đủ 🎉"
                />
              )}

              {activeTab === 'history' && historyInvoices.length === 0 && (
                <WarmEmptyState
                  title="Chưa có lịch sử thanh toán"
                  description="Các hoá đơn đã hoàn tất thanh toán sẽ được lưu trữ và xuất biên lai chi tiết tại đây."
                />
              )}

              {/* ─── Select All & Counter Bar ─── */}
              {((activeTab === 'current' ? currentInvoices : historyInvoices).length > 0) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 2px 12px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}>
                  <button
                    onClick={handleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      padding: 0,
                    }}
                  >
                    {selectedIds.length > 0 && selectedIds.length === (activeTab === 'current' ? currentInvoices : historyInvoices).length ? (
                      <CheckSquare size={16} color="var(--accent-cyan)" />
                    ) : (
                      <Square size={16} />
                    )}
                    <span>Chọn tất cả ({(activeTab === 'current' ? currentInvoices : historyInvoices).length})</span>
                  </button>

                  {selectedIds.length > 0 && (
                    <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      Đã chọn {selectedIds.length}
                    </span>
                  )}
                </div>
              )}

              <motion.div
                variants={createStaggerContainer(0.04)}
                initial="hidden"
                animate="visible"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
              {(activeTab === 'current' ? currentInvoices : historyInvoices).map(inv => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.draft;
                const monthStr = new Date(inv.created_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <motion.div
                    key={inv.id}
                    variants={staggerItemVariants}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    onClick={() => openInvoiceDetail(inv.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelected ? 'rgba(45, 138, 126, 0.08)' : 'var(--bg-card)',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontFamily: 'var(--font-sans)',
                      boxShadow: '0 2px 6px rgba(45, 40, 37, 0.02)',
                    }}
                    className="invoice-list-item"
                  >
                    <button
                      onClick={(e) => handleToggleSelect(inv.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      }}
                      title={isSelected ? 'Bỏ chọn' : 'Chọn hoá đơn'}
                    >
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                        margin: '0 0 4px',
                      }}>
                        {`Hoá đơn ${monthStr}`}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: badge.bg, color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {inv.invoice_number}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                      }}>
                        {formatVND(inv.total_amount)}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </motion.div>
                );
              })}
              </motion.div>
            </div>
          )}
        </div>

        {/* ─── Floating Bulk Action Bar ─── */}
        {selectedIds.length > 0 && !selectedInvoice && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Đã chọn {selectedIds.length} hoá đơn
              </span>
              <button
                onClick={() => setSelectedIds([])}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                }}
              >
                Bỏ chọn
              </button>
            </div>

            <button
              onClick={handleSendBulkReminders}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: '#D96B43',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(217, 107, 67, 0.3)',
              }}
            >
              <Send size={14} />
              <span>Gửi nhắc hạn ({selectedIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
      <BillingRateModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
      />

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .invoice-list-item:hover {
          background: var(--bg-card-hover) !important;
          box-shadow: var(--shadow-card) !important;
        }
      `}</style>
    </>
  );
};
