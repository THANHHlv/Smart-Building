import React, { useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Droplet,
  Droplets,
  Home,
  Loader2,
  Power,
  Receipt,
  Shield,
  ShieldAlert,
  Thermometer,
  Wrench,
  Zap,
  Newspaper,
  CalendarCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { ResidentDashboardResponse } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface ResidentDashboardProps {
  data: ResidentDashboardResponse | null;
  isLoading: boolean;
  onRefresh?: () => void;
  onOpenMaintenance?: () => void;
  onOpenServiceHub?: () => void;
  onOpenBulletin?: () => void;
}

export const ResidentDashboard: React.FC<ResidentDashboardProps> = ({
  data,
  isLoading,
  onRefresh,
  onOpenMaintenance,
  onOpenServiceHub,
  onOpenBulletin,
}) => {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleDevice = async (deviceId: string) => {
    try {
      setTogglingId(deviceId);
      await api.controlDevice(deviceId, 'toggle');
      onRefresh?.();
    } catch (err) {
      console.error('Failed to control device:', err);
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-panel skeleton-shimmer" style={{ height: '100px', width: '100%' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-panel skeleton-shimmer" style={{ height: '140px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Không thể tải dữ liệu căn hộ của bạn. Vui lòng thử lại sau.
      </div>
    );
  }

  const { apartment, climate, energy, water, devices, alerts } = data;

  // Chart styling
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#38bdf8',
        bodyColor: '#f8fafc',
        titleFont: { family: 'Fira Code', size: 12 },
        bodyFont: { family: 'Fira Code', size: 13, weight: 'bold' as const },
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#94a3b8', font: { family: 'Fira Code', size: 10 } },
        border: { color: 'rgba(255, 255, 255, 0.08)' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#94a3b8', font: { family: 'Fira Code', size: 10 } },
        border: { color: 'rgba(255, 255, 255, 0.08)' },
      },
    },
  };

  const formatChartTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const elecChartData = {
    labels:
      energy.recent_readings.length > 0
        ? energy.recent_readings.map((r) => formatChartTime(r.timestamp))
        : ['12:00', '12:05', '12:10', '12:15', '12:20'],
    datasets: [
      {
        label: 'Tải Điện Căn Hộ (kW)',
        data:
          energy.recent_readings.length > 0
            ? energy.recent_readings.map((r) => r.value)
            : [1.2, 0.8, 1.5, 2.1, 1.4],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#06b6d4',
      },
    ],
  };

  const waterChartData = {
    labels:
      water.recent_readings.length > 0
        ? water.recent_readings.map((r) => formatChartTime(r.timestamp))
        : ['12:00', '12:05', '12:10', '12:15', '12:20'],
    datasets: [
      {
        label: 'Lưu Lượng Nước (L/min)',
        data:
          water.recent_readings.length > 0
            ? water.recent_readings.map((r) => r.value)
            : [0.0, 0.0, 4.5, 2.0, 1.2],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#38bdf8',
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Apartment Welcome Header */}
      <section
        aria-labelledby="apartment-welcome-title"
        className="glass-panel"
        style={{
          padding: '24px',
          border: '1px solid var(--border-cyan)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(17, 24, 39, 0.95))',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.18)',
                border: '1px solid var(--border-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06b6d4',
                boxShadow: 'var(--shadow-glow-cyan)',
              }}
              aria-hidden="true"
            >
              <Home size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2
                  id="apartment-welcome-title"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Căn Hộ {apartment.unit_number} • {apartment.building_name}
                </h2>
                <span className="badge badge-healthy">Cư Dân Chính Thức</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Chủ hộ: <strong style={{ color: 'var(--text-primary)' }}>{apartment.resident_name}</strong> • Tầng {apartment.floor_number} • Diện tích: {apartment.area_sqm} m² ({apartment.num_rooms} phòng)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                background: 'var(--bg-interactive)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Mã bảo mật căn hộ: <span style={{ color: '#38bdf8' }}>{apartment.id.slice(0, 8)}</span>
            </span>

            {onOpenServiceHub && (
              <button
                onClick={onOpenServiceHub}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(74, 124, 89, 0.15)',
                  border: '1px solid rgba(74, 124, 89, 0.35)',
                  color: '#4A7C59',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <CalendarCheck size={15} />
                Yêu Cầu & Tiện Ích
              </button>
            )}

            {onOpenMaintenance && (
              <button
                onClick={onOpenMaintenance}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(249, 115, 22, 0.15)',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  color: '#f97316',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Wrench size={15} />
                Báo Sự Cố Kỹ Thuật
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Community Bulletin & Self-Service Shortcuts Banner */}
      {(onOpenBulletin || onOpenServiceHub) && (
        <section
          className="glass-panel"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(217, 107, 67, 0.08), rgba(74, 124, 89, 0.08))',
            border: '1px solid rgba(217, 107, 67, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(217, 107, 67, 0.15)',
                border: '1px solid rgba(217, 107, 67, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D96B43',
                flexShrink: 0,
              }}
            >
              <Newspaper size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Không Gian Sinh Hoạt Cư Dân
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(74, 124, 89, 0.15)',
                    color: '#4A7C59',
                    border: '1px solid rgba(74, 124, 89, 0.3)',
                  }}
                >
                  Dịch vụ & Tin tức mới
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Xem thông báo bảo trì, sự kiện toà nhà hoặc đặt lịch dọn vệ sinh, bảo trì điều hoà, sân chơi cộng đồng
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onOpenBulletin && (
              <button
                onClick={onOpenBulletin}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#D96B43',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(217, 107, 67, 0.3)',
                }}
              >
                <Newspaper size={14} />
                <span>Xem Bảng Tin</span>
              </button>
            )}

            {onOpenServiceHub && (
              <button
                onClick={onOpenServiceHub}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(74, 124, 89, 0.15)',
                  border: '1px solid rgba(74, 124, 89, 0.4)',
                  color: '#4A7C59',
                }}
              >
                <CalendarCheck size={14} />
                <span>Đặt Tiện Ích & Dịch Vụ</span>
              </button>
            )}
          </div>
        </section>
      )}


      {/* 2. Personal KPI Grid */}
      <section
        aria-label="Chỉ số tiện ích căn hộ cá nhân"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Indoor Climate */}
        <article
          className="glass-panel"
          style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: 'linear-gradient(180deg, #10b981, #06b6d4)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                Khí Hậu Phòng Khách
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {climate.temperature_celsius}°C
                </span>
                <span style={{ fontSize: '1.1rem', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {climate.humidity_percent}% RH
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#34d399', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)' }}>
                <span className="dot dot-green" /> {climate.status}
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--border-emerald)', color: '#10b981' }}>
              <Thermometer size={22} />
            </div>
          </div>
        </article>

        {/* Card 2: Electricity Today */}
        <article
          className="glass-panel"
          style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: 'linear-gradient(180deg, #06b6d4, #0284c7)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                Điện Năng Hôm Nay
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {energy.today_kwh}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#06b6d4', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  kWh
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                Tháng này: {energy.month_kwh} kWh (Đang chạy {energy.current_kw} kW)
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(6, 182, 212, 0.12)', border: '1px solid var(--border-cyan)', color: '#06b6d4' }}>
              <Zap size={22} />
            </div>
          </div>
        </article>

        {/* Card 3: Water Today */}
        <article
          className="glass-panel"
          style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: 'linear-gradient(180deg, #38bdf8, #0284c7)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                Nước Sinh Hoạt Hôm Nay
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {water.today_liters}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  Lít
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                Tháng này: {(water.month_liters / 1000).toFixed(2)} m³ ({water.current_flow_l_min} L/min)
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
              <Droplets size={22} />
            </div>
          </div>
        </article>

        {/* Card 4: Estimated Monthly Utility Bill */}
        <article
          className="glass-panel"
          style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: 'linear-gradient(180deg, #f59e0b, #ea580c)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Hóa Đơn Tạm Tính ({data.estimated_cost?.billing_cycle || 'Tháng Này'})
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: '#fbbf24',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {(data.estimated_cost?.total_estimated_vnd || 0).toLocaleString('vi-VN')}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  VNĐ
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Điện: {(data.estimated_cost?.electricity_cost_vnd || 0).toLocaleString('vi-VN')} đ • Nước:{' '}
                {(data.estimated_cost?.water_cost_vnd || 0).toLocaleString('vi-VN')} đ
              </div>
              {data.estimated_cost && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: '0.68rem',
                    }}
                  >
                    {data.estimated_cost.electricity_tier}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background:
                        data.estimated_cost.avg_comparison_percent <= 0
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(234, 179, 8, 0.15)',
                      color:
                        data.estimated_cost.avg_comparison_percent <= 0 ? '#4ade80' : '#fbbf24',
                      border:
                        data.estimated_cost.avg_comparison_percent <= 0
                          ? '1px solid rgba(34, 197, 94, 0.3)'
                          : '1px solid rgba(234, 179, 8, 0.3)',
                      fontSize: '0.68rem',
                    }}
                  >
                    {data.estimated_cost.avg_comparison_percent <= 0
                      ? `Tiết kiệm ${Math.abs(data.estimated_cost.avg_comparison_percent)}% so với TB`
                      : `Vượt ${data.estimated_cost.avg_comparison_percent}% so với TB`}
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
              }}
            >
              <Receipt size={22} />
            </div>
          </div>
        </article>


        {/* Card 4: Apartment Alerts */}
        <article
          className="glass-panel"
          style={{
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            borderColor: alerts.length > 0 ? 'var(--border-rose)' : 'var(--border-subtle)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: alerts.length > 0 ? 'linear-gradient(180deg, #f43f5e, #be123c)' : 'linear-gradient(180deg, #10b981, #059669)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                An Toàn & Cảnh Báo
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: alerts.length > 0 ? '#ff4d6d' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {alerts.length}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sự cố</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: alerts.length > 0 ? '#fb7185' : '#34d399', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {alerts.length > 0 ? 'Cần kiểm tra thiết bị căn hộ' : 'Căn hộ an toàn danh định'}
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: alerts.length > 0 ? 'rgba(244, 63, 94, 0.14)' : 'rgba(16, 185, 129, 0.12)', border: alerts.length > 0 ? '1px solid var(--border-rose)' : '1px solid var(--border-emerald)', color: alerts.length > 0 ? '#f43f5e' : '#10b981' }}>
              {alerts.length > 0 ? <AlertTriangle size={22} /> : <Shield size={22} />}
            </div>
          </div>
        </article>
      </section>

      {/* 3. Real-Time Telemetry Curves for Apartment */}
      <section
        aria-label="Biểu đồ phụ tải điện và lưu lượng nước riêng của căn hộ"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Electricity Load Curve */}
        <article className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--border-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                <Zap size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Phụ Tải Điện Căn Hộ {apartment.unit_number} (kW)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Công tơ điện tử thông minh riêng của căn hộ
                </span>
              </div>
            </div>
            <span className="badge badge-telemetry">
              <span className="dot dot-cyan" /> {energy.current_kw} kW hiện tại
            </span>
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <Line data={elecChartData} options={commonOptions} />
          </div>
        </article>

        {/* Water Flow Rate Curve */}
        <article className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Droplet size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Lưu Lượng Nước Căn Hộ {apartment.unit_number} (L/min)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Đồng hồ đo nước siêu âm riêng của căn hộ
                </span>
              </div>
            </div>
            <span className="badge badge-telemetry">
              <span className="dot dot-cyan" /> {water.current_flow_l_min} L/min hiện tại
            </span>
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <Line data={waterChartData} options={commonOptions} />
          </div>
        </article>
      </section>

      {/* 4. Split Grid: My Devices & My Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>
        {/* My Smart Devices */}
        <section className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--border-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Cpu size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Thiết Bị IoT Lắp Trong Căn Hộ
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Chỉ các cảm biến thuộc quyền quản lý của Căn {apartment.unit_number}
                </span>
              </div>
            </div>
            <span className="badge badge-online">
              <span className="dot dot-green" /> {devices.length} Thiết bị
            </span>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <caption className="sr-only">Danh sách thiết bị thông minh lắp trong căn hộ của cư dân</caption>
              <thead>
                <tr>
                  <th scope="col">Mã Thiết Bị</th>
                  <th scope="col">Tên Cảm Biến / Thiết Bị</th>
                  <th scope="col">Chỉ Số Gần Nhất</th>
                  <th scope="col">Trạng Thái</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Điều Khiển Thông Minh</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const isOnline = d.status.toLowerCase() === 'online';
                  const isToggling = togglingId === d.id;
                  const isMeter = d.device_code.includes('elec') || d.device_code.includes('water');

                  return (
                    <tr key={d.id}>
                      <th scope="row" style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {d.device_code}
                      </th>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f8fafc' }}>
                        {d.last_reading_value !== null ? `${d.last_reading_value} ${d.last_reading_unit || ''}` : '--'}
                      </td>
                      <td>
                        <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
                          <span className={`dot ${isOnline ? 'dot-green' : 'dot-red'}`} /> {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isMeter ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cảm biến tự động</span>
                        ) : (
                          <button
                            onClick={() => handleToggleDevice(d.id)}
                            disabled={isToggling}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              background: isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              border: isOnline ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                              color: isOnline ? '#4ade80' : '#94a3b8',
                            }}
                            title={isOnline ? 'Nhấn để tắt thiết bị' : 'Nhấn để bật thiết bị'}
                          >
                            {isToggling ? (
                              <Loader2 className="spin" size={12} />
                            ) : (
                              <Power size={12} color={isOnline ? '#22c55e' : '#94a3b8'} />
                            )}
                            {isOnline ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* My Apartment Alerts */}
        <section className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--border-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Thông Báo An Toàn Căn Hộ
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Cảnh báo sự cố rò rỉ hoặc quá tải gửi tới Căn {apartment.unit_number}
                </span>
              </div>
            </div>
            <span className={`badge ${alerts.length > 0 ? 'badge-critical' : 'badge-healthy'}`}>
              {alerts.length} Thông Báo
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={24} color="#10b981" />
                <span>Không có sự cố nào ghi nhận tại căn hộ của bạn.</span>
              </div>
            ) : (
              alerts.map((a) => (
                <article
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: a.severity === 'critical' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                    border: a.severity === 'critical' ? '1px solid var(--border-rose)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</h4>
                    <span className={`badge ${a.severity === 'critical' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '0.65rem' }}>
                      {a.severity === 'critical' ? 'KHẨN CẤP' : a.severity === 'high' ? 'ƯU TIÊN CAO' : a.severity === 'medium' ? 'TRUNG BÌNH' : 'GHI NHẬN'}
                    </span>
                  </div>
                  {a.message && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.message}</p>}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(a.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • Trạng thái: {a.status === 'resolved' ? 'Đã xử lý' : a.status === 'acknowledged' ? 'Đã tiếp nhận' : 'Đang theo dõi'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
