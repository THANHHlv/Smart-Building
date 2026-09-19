import React, { useEffect, useState } from 'react';
import {
  Home,
  LogOut,
  RefreshCw,
  Sparkles,
  UserCheck,
  Wifi,
  WifiOff,
  Newspaper,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  currentUser: UserProfile | null;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onOpenAiAssistant?: () => void;
  onOpenBulletin?: () => void;
  unreadAnnouncementsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onRefresh,
  isRefreshing,
  autoRefresh,
  onToggleAutoRefresh,
  onOpenAiAssistant,
  onOpenBulletin,
  unreadAnnouncementsCount = 0,
}) => {

  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <header
      className="glass-panel"
      style={{
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderBottom: '1px solid var(--border-medium)',
      }}
    >
      {/* Top Row: Brand & Status & Live Clock & User Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Brand & System Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #FDF7F2, #F8EDE4)',
              border: '1px solid rgba(217, 107, 67, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(217, 107, 67, 0.12)',
            }}
            aria-hidden="true"
          >
            <Home size={24} color="#D96B43" strokeWidth={2.2} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                THANHLE TOWER
              </h1>
              <span
                className={`badge ${isAdmin ? 'badge-telemetry' : 'badge-healthy'}`}
                style={{ fontSize: '0.68rem', padding: '2px 8px' }}
              >
                {isAdmin ? 'BAN QUẢN LÝ' : 'CỘNG ĐỒNG CƯ DÂN'}
              </span>
              <span className="badge badge-low" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                {isAdmin ? 'ĐIỀU HÀNH CĂN HỘ' : `CĂN HỘ ${currentUser?.apartment_unit || '—'}`}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {isAdmin
                ? 'Theo dõi tiện nghi, tối ưu năng lượng & chăm sóc không gian sống tòa nhà'
                : `Không gian sống an tâm của gia đình bạn${currentUser?.apartment_unit ? ` • Căn hộ ${currentUser.apartment_unit}` : ''}`}
            </p>
          </div>
        </div>

        {/* System Health Indicators & Action Controls */}
        <nav
          aria-label="Tình trạng không gian sống và điều khiển đồng bộ"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
        >
          {isAdmin ? (
            <>
              {/* Tiêu chuẩn không khí trong lành */}
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(74, 124, 89, 0.1)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(74, 124, 89, 0.25)',
                  fontSize: '0.75rem',
                  color: '#4A7C59',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                }}
              >
                <span className="dot dot-green" />
                <span>Không Khí:</span>
                <span style={{ fontWeight: 600 }}>Trong Lành (AQI 28)</span>
              </div>

              {/* Năng lượng tòa nhà */}
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(217, 107, 67, 0.08)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(217, 107, 67, 0.25)',
                  fontSize: '0.75rem',
                  color: '#D96B43',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                }}
              >
                <span className="dot dot-cyan" />
                <span>Năng Lượng:</span>
                <span style={{ fontWeight: 600 }}>Tối Ưu 24h</span>
              </div>
            </>
          ) : (
            /* Resident Connection Badge */
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(74, 124, 89, 0.1)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(74, 124, 89, 0.25)',
                fontSize: '0.75rem',
                color: '#4A7C59',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <UserCheck size={14} aria-hidden="true" />
              <span>Cư Dân:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser?.full_name}</span>
            </div>
          )}

          {/* Clock Display */}
          <time
            dateTime={new Date().toISOString()}
            style={{
              fontFamily: 'var(--font-display)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#D96B43',
              background: '#FAF7F2',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #EFE9DF',
              letterSpacing: '0.02em',
            }}
          >
            {timeStr || '--:--:--'}
          </time>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            aria-pressed={autoRefresh}
            className="btn btn-ghost"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              color: autoRefresh ? '#34d399' : 'var(--text-muted)',
              borderColor: autoRefresh ? 'var(--border-emerald)' : 'var(--border-subtle)',
            }}
            title="Bật/tắt tự động làm mới dữ liệu telemetry mỗi 5 giây"
          >
            {autoRefresh ? (
              <Wifi size={14} color="#10b981" aria-hidden="true" />
            ) : (
              <WifiOff size={14} color="#64748b" aria-hidden="true" />
            )}
            <span>{autoRefresh ? 'Live Sync 5s' : 'Sync Paused'}</span>
          </button>

          {/* Community Bulletin Quick Access */}
          {onOpenBulletin && (
            <button
              type="button"
              onClick={onOpenBulletin}
              className="btn btn-ghost"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                position: 'relative',
                color: unreadAnnouncementsCount > 0 ? '#D96B43' : 'var(--text-secondary)',
                borderColor: unreadAnnouncementsCount > 0 ? 'rgba(217, 107, 67, 0.4)' : 'var(--border-subtle)',
                background: unreadAnnouncementsCount > 0 ? 'rgba(217, 107, 67, 0.08)' : 'transparent',
              }}
              title="Bảng tin chung cư & thông báo khẩn cấp"
            >
              <Newspaper size={15} color={unreadAnnouncementsCount > 0 ? '#D96B43' : undefined} />
              <span>Bảng Tin</span>
              {unreadAnnouncementsCount > 0 && (
                <span
                  style={{
                    background: '#D96B43',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  {unreadAnnouncementsCount}
                </span>
              )}
            </button>
          )}

          {/* Notification Center */}
          <NotificationCenter currentUserId={currentUser?.id} />

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Làm mới chỉ số telemetry"
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-ghost"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              color: '#fb7185',
              borderColor: 'var(--border-rose)',
            }}
            title="Đăng xuất"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Đăng Xuất</span>
          </button>
        </nav>
      </div>

      {/* Bottom Row: Authenticated User Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* User Avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              background: isAdmin
                ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(139, 92, 246, 0.3))'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3))',
              border: isAdmin ? '1px solid var(--border-cyan)' : '1px solid var(--border-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isAdmin ? '#38bdf8' : '#34d399',
            }}
          >
            {currentUser?.full_name?.[0]?.toUpperCase() || '?'}
          </div>

          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentUser?.full_name || 'User'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentUser?.email}
              {currentUser?.building_name && (
                <span style={{ marginLeft: '8px', color: 'var(--text-subtle)' }}>
                  • {currentUser.building_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenAiAssistant && (
            <button
              onClick={onOpenAiAssistant}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(217, 107, 67, 0.08)',
                border: '1px solid rgba(217, 107, 67, 0.3)',
                color: '#D96B43',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Mở Trợ Lý AI Tòa Nhà thông minh"
            >
              <Sparkles size={13} />
              <span>Trợ Lý AI</span>
            </button>
          )}

          <span
            className={`badge ${isAdmin ? 'badge-telemetry' : 'badge-healthy'}`}
            style={{ fontSize: '0.7rem', padding: '3px 10px' }}
          >
            {isAdmin ? '👑 Administrator' : '🏠 Cư Dân'}
          </span>
          {currentUser?.apartment_unit && (
            <span
              className="badge badge-low"
              style={{ fontSize: '0.7rem', padding: '3px 10px' }}
            >
              Căn {currentUser.apartment_unit}
            </span>
          )}
          {!currentUser?.apartment_id && currentUser?.role === 'resident' && (
            <span
              className="badge"
              style={{
                fontSize: '0.7rem',
                padding: '3px 10px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#fbbf24',
                border: '1px solid var(--border-amber)',
              }}
            >
              ⏳ Chờ gán căn hộ
            </span>
          )}
        </div>
      </div>

    </header>
  );
};
