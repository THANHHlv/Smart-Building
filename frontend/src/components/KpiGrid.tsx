import React from 'react';
import { AlertCircle, Droplets, HeartPulse, Home, Sparkles, Zap } from 'lucide-react';
import { CountUpNumber, BreathingIndicator } from './ui/HumanInteractions';
import type { DashboardOverview, EnergyDashboard, WaterDashboard } from '../types';

interface KpiGridProps {
  overview: DashboardOverview | null;
  energy: EnergyDashboard | null;
  water: WaterDashboard | null;
  isLoading?: boolean;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ overview, energy, water, isLoading = false }) => {
  const onlinePercent =
    overview && overview.total_devices > 0
      ? Math.round((overview.devices_online / overview.total_devices) * 100)
      : 0;

  if (isLoading && !overview) {
    return (
      <section
        aria-label="Đang tải dữ liệu không gian sống"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <article
            key={i}
            className="glass-panel skeleton-shimmer"
            style={{ height: '140px', padding: '20px', borderRadius: '16px' }}
            aria-busy="true"
          />
        ))}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="kpi-grid-heading"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px',
      }}
    >
      <h2 id="kpi-grid-heading" className="sr-only">
        Chỉ Số Tiện Nghi & Nhịp Sống Tòa Nhà
      </h2>

      {/* 1. Tổ Ấm & Căn Hộ */}
      <article
        tabIndex={0}
        aria-labelledby="kpi-apartments-title"
        className="glass-panel interactive-card"
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span
              id="kpi-apartments-title"
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              Tổ Ấm & Căn Hộ
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <CountUpNumber value={overview?.total_apartments ?? 0} decimals={0} />
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Căn hộ</span>
            </div>
            <div
              style={{
                fontSize: '0.76rem',
                color: '#D96B43',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500,
              }}
            >
              <Sparkles size={13} />
              <span>{overview?.total_buildings ?? 1} Tòa nhà The Oasis</span>
            </div>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: '#FDF7F2',
              border: '1px solid rgba(217, 107, 67, 0.2)',
              color: '#D96B43',
            }}
            aria-hidden="true"
          >
            <Home size={22} />
          </div>
        </div>
      </article>

      {/* 2. Thiết Bị Sống Thông Minh */}
      <article
        tabIndex={0}
        aria-labelledby="kpi-devices-title"
        className="glass-panel interactive-card"
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span
              id="kpi-devices-title"
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              Thiết Bị Tiện Nghi
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <CountUpNumber value={overview?.devices_online ?? 0} decimals={0} />
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                /{overview?.total_devices ?? 0}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.76rem',
                color: '#4A7C59',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500,
              }}
            >
              <BreathingIndicator status="normal" size={8} />
              <span>{onlinePercent}% Đang hoạt động êm ái</span>
            </div>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: '#F0F7F2',
              border: '1px solid rgba(74, 124, 89, 0.2)',
              color: '#4A7C59',
            }}
            aria-hidden="true"
          >
            <HeartPulse size={22} />
          </div>
        </div>
      </article>

      {/* 3. Tiêu Thụ Năng Lượng */}
      <article
        tabIndex={0}
        aria-labelledby="kpi-energy-title"
        className="glass-panel interactive-card"
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span
              id="kpi-energy-title"
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              Điện Năng Hôm Nay
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <CountUpNumber value={energy?.total_kwh_today ?? 0} decimals={1} />
              </span>
              <span style={{ fontSize: '0.85rem', color: '#B87319', fontWeight: 600 }}>
                kWh
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Tháng này: {Math.round(energy?.total_kwh_this_month ?? 0).toLocaleString('vi-VN')} kWh
            </div>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: '#FEF8EE',
              border: '1px solid rgba(184, 115, 25, 0.2)',
              color: '#B87319',
            }}
            aria-hidden="true"
          >
            <Zap size={22} />
          </div>
        </div>
      </article>

      {/* 4. Nguồn Nước Sử Dụng */}
      <article
        tabIndex={0}
        aria-labelledby="kpi-water-title"
        className="glass-panel interactive-card"
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span
              id="kpi-water-title"
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              Nước Sạch Hôm Nay
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <CountUpNumber value={(water?.total_liters_today ?? 0) / 1000} decimals={2} />
              </span>
              <span style={{ fontSize: '0.85rem', color: '#437A82', fontWeight: 600 }}>
                m³
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Tháng này: {((water?.total_liters_this_month ?? 0) / 1000).toFixed(1)} m³
            </div>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: '#F0F6F7',
              border: '1px solid rgba(67, 122, 130, 0.2)',
              color: '#437A82',
            }}
            aria-hidden="true"
          >
            <Droplets size={22} />
          </div>
        </div>
      </article>

      {/* 5. Nhật Ký Chăm Sóc & Lưu Ý */}
      <article
        tabIndex={0}
        aria-labelledby="kpi-care-title"
        className="glass-panel interactive-card"
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span
              id="kpi-care-title"
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              Lưu Ý Chăm Sóc
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
              <span
                style={{
                  fontSize: '2.1rem',
                  fontWeight: 700,
                  color: (overview?.total_alerts_open ?? 0) > 0 ? '#C85252' : '#4A7C59',
                }}
              >
                <CountUpNumber value={overview?.total_alerts_open ?? 0} decimals={0} />
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Vấn đề</span>
            </div>
            <div
              style={{
                fontSize: '0.76rem',
                color: (overview?.total_alerts_open ?? 0) > 0 ? '#C85252' : '#4A7C59',
                marginTop: '4px',
                fontWeight: 500,
              }}
            >
              {(overview?.total_alerts_open ?? 0) > 0
                ? 'Có căn hộ cần hỗ trợ'
                : 'Mọi không gian đều êm ả'}
            </div>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: (overview?.total_alerts_open ?? 0) > 0 ? '#FEF2F2' : '#F0F7F2',
              border: `1px solid ${(overview?.total_alerts_open ?? 0) > 0 ? 'rgba(200, 82, 82, 0.25)' : 'rgba(74, 124, 89, 0.25)'}`,
              color: (overview?.total_alerts_open ?? 0) > 0 ? '#C85252' : '#4A7C59',
            }}
            aria-hidden="true"
          >
            <AlertCircle size={22} />
          </div>
        </div>
      </article>
    </section>
  );
};

export default KpiGrid;
