import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Zap, Droplets, Building2, Car, Wrench, Package, X, ChevronRight, Clock, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { api } from '../services/api';
import type { InvoiceDetail, InvoiceListItem } from '../types';

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

/* ─── PROPS ─── */
interface BillingInvoicesProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BillingInvoices: React.FC<BillingInvoicesProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<BillingTab>('current');
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      loadInvoices();
      setSelectedInvoice(null);
      setPaymentMessage(null);
    }
  }, [isOpen, loadInvoices]);

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

  if (!isOpen) return null;

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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(45, 40, 37, 0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Dịch vụ & Hoá đơn"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(520px, 95vw)',
          zIndex: 10000,
          background: 'var(--bg-main)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 30px rgba(45, 40, 37, 0.08)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '6px', borderRadius: 'var(--radius-xs)',
          }}>
            <X size={20} />
          </button>
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

              {(activeTab === 'current' ? currentInvoices : historyInvoices).map(inv => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.draft;
                const monthStr = new Date(inv.created_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

                return (
                  <button
                    key={inv.id}
                    onClick={() => openInvoiceDetail(inv.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)', padding: '16px',
                      marginBottom: '8px', cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontFamily: 'var(--font-sans)',
                    }}
                    className="invoice-list-item"
                  >
                    <div>
                      <p style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                        margin: '0 0 4px',
                      }}>
                        {`Hoá đơn ${monthStr}` }
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

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
