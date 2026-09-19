import React, { useState } from 'react';
import { Check, CheckCheck, Clock, HeartPulse, Loader2, Sparkles } from 'lucide-react';
import type { Alert } from '../types';
import { api } from '../services/api';

interface AlertCenterProps {
  alerts: Alert[];
  onAlertUpdated: () => void;
}

export const AlertCenter: React.FC<AlertCenterProps> = ({ alerts, onAlertUpdated }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAcknowledge = async (id: string) => {
    try {
      setProcessingId(id);
      await api.acknowledgeAlert(id);
      onAlertUpdated();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      setProcessingId(id);
      await api.resolveAlert(id);
      onAlertUpdated();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span
            className="badge"
            style={{
              background: '#FDEEE8',
              color: '#C85252',
              border: '1px solid #F6DFD7',
              fontWeight: 600,
            }}
          >
            Cần Hỗ Trợ Sớm
          </span>
        );
      case 'high':
        return (
          <span
            className="badge"
            style={{
              background: '#FEF8EE',
              color: '#B87319',
              border: '1px solid #F5E5CF',
              fontWeight: 600,
            }}
          >
            Lưu Ý Tiện Nghi
          </span>
        );
      case 'medium':
        return (
          <span
            className="badge"
            style={{
              background: '#FAF7F2',
              color: '#D96B43',
              border: '1px solid #EFE9DF',
              fontWeight: 600,
            }}
          >
            Nhắc Nhở Nhẹ
          </span>
        );
      case 'low':
      default:
        return (
          <span
            className="badge"
            style={{
              background: '#F0F7F2',
              color: '#4A7C59',
              border: '1px solid #E2EFE5',
              fontWeight: 600,
            }}
          >
            Ghi Nhận
          </span>
        );
    }
  };

  const openCount = alerts.filter((a) => a.status === 'open').length;

  return (
    <section
      aria-labelledby="care-journal-title"
      className="glass-panel"
      style={{
        padding: '22px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #EFE9DF',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#FDF7F2',
              border: '1px solid rgba(217, 107, 67, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D96B43',
            }}
            aria-hidden="true"
          >
            <HeartPulse size={20} />
          </div>
          <div>
            <h2
              id="care-journal-title"
              style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              Nhật Ký Chăm Sóc Tòa Nhà
            </h2>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Theo dõi và hỗ trợ cư dân tối ưu tiện nghi, chất lượng sống 24/7
            </span>
          </div>
        </div>

        <span
          role="status"
          aria-live="polite"
          className="badge"
          style={{
            background: openCount > 0 ? '#FDEEE8' : '#F0F7F2',
            color: openCount > 0 ? '#C85252' : '#4A7C59',
            border: `1px solid ${openCount > 0 ? '#F6DFD7' : '#E2EFE5'}`,
            fontWeight: 600,
          }}
        >
          {openCount > 0 ? `${openCount} vấn đề cần lưu ý` : 'Mọi nơi đều an tâm'}
        </span>
      </div>

      {/* Alerts Feed */}
      <div
        role="feed"
        aria-busy={processingId !== null}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: '400px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {alerts.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              background: '#FAF8F5',
              borderRadius: '14px',
              border: '1px dashed #E2D9CB',
            }}
          >
            <Sparkles size={32} color="#4A7C59" aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Tất cả không gian đều yên ả & an tâm
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Hệ thống AI không ghi nhận bất thường nào về điện, nước hay nhiệt độ sinh hoạt.
              </div>
            </div>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isOpen = alert.status === 'open';

            return (
              <article
                key={alert.id}
                role={isCritical && isOpen ? 'alert' : 'article'}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: isOpen && isCritical ? '#FFF8F6' : '#FAF8F5',
                  border: `1px solid ${isOpen && isCritical ? '#F6DFD7' : '#EFE9DF'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'all var(--transition-normal)',
                }}
              >
                {/* Alert Content */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 280px' }}>
                  <div style={{ marginTop: '2px' }}>{getSeverityBadge(alert.severity)}</div>
                  <div>
                    <h3 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {alert.title}
                    </h3>
                    {alert.message && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                        {alert.message}
                      </p>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.74rem',
                        color: 'var(--text-muted)',
                        marginTop: '6px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} aria-hidden="true" />
                        <time dateTime={alert.created_at}>
                          {new Date(alert.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </span>
                      <span>Khu vực: {alert.source || 'Căn hộ'}</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: alert.status === 'resolved' ? '#4A7C59' : '#B87319',
                        }}
                      >
                        {alert.status === 'resolved' ? 'Đã chăm sóc xong' : 'Đang theo dõi'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={processingId === alert.id}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.76rem', padding: '6px 12px', borderRadius: '8px' }}
                      aria-label={`Xác nhận đã xem ${alert.title}`}
                    >
                      {processingId === alert.id ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Check size={13} aria-hidden="true" />
                      )}
                      <span>Đã Biết</span>
                    </button>
                  )}

                  {alert.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleResolve(alert.id)}
                      disabled={processingId === alert.id}
                      className="btn btn-success"
                      style={{ fontSize: '0.76rem', padding: '6px 12px', borderRadius: '8px' }}
                      aria-label={`Hoàn tất chăm sóc ${alert.title}`}
                    >
                      {processingId === alert.id ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCheck size={13} aria-hidden="true" />
                      )}
                      <span>Đã Xử Lý</span>
                    </button>
                  )}

                  {alert.status === 'resolved' && (
                    <span
                      style={{
                        fontSize: '0.76rem',
                        color: '#4A7C59',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCheck size={14} aria-hidden="true" /> Đã hoàn tất
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

export default AlertCenter;
