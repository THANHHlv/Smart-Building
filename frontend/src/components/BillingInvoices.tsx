import React, { useCallback, useEffect, useState } from 'react';
import {
  Receipt, Zap, Droplets, Building2, Car, Wrench, Package, X, ChevronRight,
  Clock, CheckCircle2, AlertCircle, CreditCard, Layers, DollarSign,
  FileSpreadsheet, CheckSquare, Square, Loader2, Send
} from 'lucide-react';
import { api } from '../services/api';
import type { BulkJob, InvoiceDetail, InvoiceListItem } from '../types';
import { ReportExportModal } from './ReportExportModal';
import { BillingRateModal } from './BillingRateModal';

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
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  /* Bulk operations & modals state */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [activeJob, setActiveJob] = useState<BulkJob | null>(null);
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
      const pollTimer = setInterval(async () => {
        try {
          const status = await api.getBulkJobStatus(job.id);
          setActiveJob(status);
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollTimer);
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
          clearInterval(pollTimer);
          setIsGeneratingBulk(false);
        }
      }, 1500);
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
      setSelectedInvoice(null);
      setPaymentMessage(null);
    }
  }, [isOpen, asPage, loadInvoices]);

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

  /* Pay invoice */
  const handlePay = async () => {
    if (!selectedInvoice) return;
    setIsPaying(true);
    setPaymentMessage(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const result = await api.payInvoice(selectedInvoice.id, idempotencyKey);
      // Redirect to payment gateway
      if (result.payment_url) {
        setPaymentMessage('Đang chuyển đến cổng thanh toán...');
        window.open(result.payment_url, '_blank');
      }
    } catch (err: any) {
      setPaymentMessage(err.message || 'Thanh toán thất bại. Vui lòng thử lại.');
    } finally {
      setIsPaying(false);
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
                borderBottom: activeTab === tab.key ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                transition: 'all var(--transition-fast)',
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
            <div style={{
              width: '100%', height: '6px', backgroundColor: 'var(--border-subtle)',
              borderRadius: '3px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${activeJob.total_items ? Math.round((activeJob.processed_items / activeJob.total_items) * 100) : 45}%`,
                backgroundColor: 'var(--accent-emerald)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }} />
            </div>
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
            fontSize: '0.78rem',
            color: 'var(--text-primary)',
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
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div className="auth-loading-spinner" style={{ width: 28, height: 28, borderWidth: 2, margin: '0 auto 12px' }} />
              <p style={{ fontSize: '0.82rem' }}>Đang tải hoá đơn...</p>
            </div>
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

              {/* Payment message */}
              {paymentMessage && (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(184, 115, 25, 0.08)', border: '1px solid var(--border-amber)',
                  fontSize: '0.82rem', color: 'var(--accent-amber)',
                  marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <AlertCircle size={14} />
                  {paymentMessage}
                </div>
              )}

              {/* Pay button */}
              {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
                <button
                  onClick={handlePay}
                  disabled={isPaying}
                  style={{
                    width: '100%', padding: '14px',
                    borderRadius: 'var(--radius-sm)', border: 'none',
                    background: isPaying
                      ? 'var(--bg-elevated)'
                      : 'linear-gradient(135deg, #D96B43, #C45731)',
                    color: isPaying ? 'var(--text-muted)' : '#ffffff',
                    fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600,
                    cursor: isPaying ? 'not-allowed' : 'pointer',
                    boxShadow: isPaying ? 'none' : '0 4px 16px rgba(217, 107, 67, 0.3)',
                    transition: 'all var(--transition-fast)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <CreditCard size={18} />
                  {isPaying ? 'Đang xử lý...' : 'Thanh toán ngay'}
                </button>
              )}
            </div>
          ) : (
            /* ─── Invoice List View ─── */
            <div>
              {activeTab === 'current' && currentInvoices.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '48px 20px',
                  color: 'var(--text-muted)',
                }}>
                  <CheckCircle2 size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                    Không có hoá đơn chờ thanh toán
                  </p>
                  <p style={{ fontSize: '0.78rem' }}>
                    Tuyệt vời! Tất cả hoá đơn của bạn đã được thanh toán đầy đủ 🎉
                  </p>
                </div>
              )}

              {activeTab === 'history' && historyInvoices.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '48px 20px',
                  color: 'var(--text-muted)',
                }}>
                  <Receipt size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Chưa có lịch sử thanh toán
                  </p>
                </div>
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

              {(activeTab === 'current' ? currentInvoices : historyInvoices).map(inv => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.draft;
                const monthStr = new Date(inv.created_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <div
                    key={inv.id}
                    onClick={() => openInvoiceDetail(inv.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelected ? 'rgba(45, 138, 126, 0.08)' : 'var(--bg-card)',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontFamily: 'var(--font-sans)',
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
                  </div>
                );
              })}
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
