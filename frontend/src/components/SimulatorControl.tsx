import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Flame, Loader2, Play, Radio, Waves, Zap } from 'lucide-react';
import { api } from '../services/api';

interface SimulatorControlProps {
  onEventTriggered: () => void;
}

export const SimulatorControl: React.FC<SimulatorControlProps> = ({ onEventTriggered }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'anomaly';
    text: string;
  } | null>(null);

  const handleEmitCycle = async () => {
    try {
      setLoadingAction('tick');
      const res = await api.triggerTick();
      setStatusMessage({
        type: 'success',
        text: `✓ ${res.message} lúc ${new Date(res.timestamp).toLocaleTimeString('vi-VN')}`,
      });
      onEventTriggered();
    } catch (err: any) {
      setStatusMessage({ type: 'anomaly', text: `Broadcast thất bại: ${err.message}` });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInjectAnomaly = async (type: 'power_spike' | 'water_leak' | 'overheat') => {
    try {
      setLoadingAction(type);
      const res = await api.injectAnomaly(type);
      setStatusMessage({
        type: 'anomaly',
        text: `🚨 [${res.alert_severity.toUpperCase()}] ${res.alert_title} — Đã phát cảnh báo bất thường đến Kafka & PostgreSQL!`,
      });
      onEventTriggered();
    } catch (err: any) {
      setStatusMessage({ type: 'anomaly', text: `Injection thất bại: ${err.message}` });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <section
      aria-labelledby="simulator-control-title"
      className="glass-panel"
      style={{
        padding: '20px 24px',
        border: '1px solid #EFE9DF',
        background: '#FFFFFF',
        borderRadius: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Title & Description */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: '#FDF7F2',
              border: '1px solid rgba(217, 107, 67, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D96B43',
            }}
            aria-hidden="true"
          >
            <Radio size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                id="simulator-control-title"
                style={{
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Thử Nghiệm Nhịp Sống & AI Anomaly Lab
              </h2>
              <span className="badge badge-medium">Luồng Sự Kiện Kafka</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Mô phỏng chu kỳ phát tín hiệu cảm biến hoặc kích hoạt sự cố mẫu để quan sát phản hồi của trợ lý AI.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div
          role="group"
          aria-label="Bảng điều khiển mô phỏng sự cố"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
        >
          {/* Normal Tick */}
          <button
            type="button"
            onClick={handleEmitCycle}
            disabled={loadingAction !== null}
            aria-label="Phát chu kỳ đọc dữ liệu telemetry cảm biến"
            className="btn btn-primary"
            style={{ fontSize: '0.825rem' }}
          >
            {loadingAction === 'tick' ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={15} aria-hidden="true" />
            )}
            <span>{loadingAction === 'tick' ? 'Đang phát...' : 'Phát Chu Kỳ Telemetry'}</span>
          </button>

          {/* Anomaly: Power Spike */}
          <button
            type="button"
            onClick={() => handleInjectAnomaly('power_spike')}
            disabled={loadingAction !== null}
            aria-label="Kích hoạt sự cố đột biến điện áp 18 kW"
            className="btn btn-danger"
            style={{ fontSize: '0.825rem' }}
          >
            {loadingAction === 'power_spike' ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Zap size={15} aria-hidden="true" />
            )}
            <span>{loadingAction === 'power_spike' ? 'Đang tạo...' : 'Tạo Đột Biến Điện (18 kW)'}</span>
          </button>

          {/* Anomaly: Water Leak */}
          <button
            type="button"
            onClick={() => handleInjectAnomaly('water_leak')}
            disabled={loadingAction !== null}
            aria-label="Kích hoạt sự cố rò rỉ nước 28 lít trên phút"
            className="btn btn-warning"
            style={{ fontSize: '0.825rem' }}
          >
            {loadingAction === 'water_leak' ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Waves size={15} aria-hidden="true" />
            )}
            <span>{loadingAction === 'water_leak' ? 'Đang tạo...' : 'Tạo Rò Rỉ Nước (28 L/phút)'}</span>
          </button>

          {/* Anomaly: Overheat */}
          <button
            type="button"
            onClick={() => handleInjectAnomaly('overheat')}
            disabled={loadingAction !== null}
            aria-label="Kích hoạt sự cố quá nhiệt máy biến áp 65 độ C"
            className="btn btn-danger"
            style={{
              fontSize: '0.825rem',
              background: 'linear-gradient(135deg, #e11d48, #9f1239)',
            }}
          >
            {loadingAction === 'overheat' ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Flame size={15} aria-hidden="true" />
            )}
            <span>{loadingAction === 'overheat' ? 'Đang tạo...' : 'Tạo Quá Nhiệt (65°C)'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background:
              statusMessage.type === 'anomaly'
                ? 'rgba(244, 63, 94, 0.16)'
                : 'rgba(16, 185, 129, 0.16)',
            border:
              statusMessage.type === 'anomaly'
                ? '1px solid var(--border-rose)'
                : '1px solid var(--border-emerald)',
            color: statusMessage.type === 'anomaly' ? '#fb7185' : '#34d399',
            boxShadow:
              statusMessage.type === 'anomaly'
                ? 'var(--shadow-glow-rose)'
                : 'var(--shadow-glow-emerald)',
          }}
        >
          {statusMessage.type === 'anomaly' ? (
            <AlertOctagon size={18} color="#f43f5e" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} color="#10b981" aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </section>
  );
};
