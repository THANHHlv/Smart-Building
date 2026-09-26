import React from 'react';
import {
  Building,
  Building2,
  ChevronDown,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { ResidentApartment, UserProfile } from '../types';
import type { PageId } from './Navbar';
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
  unassignedUsersCount?: number;
  onOpenProfile?: () => void;
  apartments?: ResidentApartment[];
  currentApartmentId?: string | null;
  onSelectApartment?: (apartmentId: string) => void;
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onRefresh,
  isRefreshing,
  autoRefresh,
  onToggleAutoRefresh,
  onOpenAiAssistant,
  onOpenBulletin: _onOpenBulletin,
  unreadAnnouncementsCount = 0,
  unassignedUsersCount = 0,
  onOpenProfile,
  apartments = [],
  currentApartmentId,
  onSelectApartment,
  activePage,
  onSelectPage,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  interface SubNavItem {
    id: PageId;
    label: string;
    adminOnly?: boolean;
    badge?: number;
    badgeColor?: string;
  }

  // Exact sub-navigation tabs matching role permissions
  const subNavItems: SubNavItem[] = [
    {
      id: 'overview',
      label: isAdmin ? 'Tổng Quan Tòa Nhà' : 'Căn Hộ Của Tôi',
    },
    ...(isAdmin
      ? [
          {
            id: 'operations' as PageId,
            label: 'Vận Hành Ban Quản Lý',
            adminOnly: true,
          },
          {
            id: 'residents' as PageId,
            label: 'Quản Lý Cư Dân & Căn Hộ',
            adminOnly: true,
            badge: unassignedUsersCount,
            badgeColor: '#f43f5e',
          },
          {
            id: 'maintenance' as PageId,
            label: 'Giám Sát IoT & Cảm Biến',
            adminOnly: true,
          },
        ]
      : []),
    {
      id: 'billing',
      label: isAdmin ? 'Quản Lý Hoá Đơn' : 'Năng Lượng & Điện Nước',
    },
    {
      id: 'tickets',
      label: isAdmin ? 'Phiếu Việc' : 'Yêu Cầu Hỗ Trợ',
    },
    {
      id: 'bulletin',
      label: 'Bảng Tin',
      badge: unreadAnnouncementsCount,
      badgeColor: '#D96B43',
    },
    ...(isAdmin
      ? [
          {
            id: 'rbac' as PageId,
            label: 'Phân Quyền',
            adminOnly: true,
          },
        ]
      : []),
    {
      id: 'services',
      label: 'Tiện Ích',
    },
  ];

  return (
    <header
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* ============================================================ */}
      {/* ROW 1: Logo + Brand + AI Button + Area Pill + Bell + User + Exit */}
      {/* ============================================================ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          gap: '16px',
        }}
      >
        {/* Left Brand Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Dark squircle container with golden building icon */}
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.18)',
            }}
            aria-hidden="true"
          >
            <Building2 size={24} color="#F59E0B" strokeWidth={2.2} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
              <span
                style={{
                  fontSize: '1.08rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#0F172A',
                  fontFamily: 'Inter, var(--font-sans)',
                  lineHeight: 1.2,
                }}
              >
                THANHLE SMART TOWER
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#FEF3E2',
                  color: '#C26D24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {isAdmin ? 'BAN QUẢN LÝ / OPERATIONS' : 'CỘNG ĐỒNG CƯ DÂN / RESIDENT'}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#94A3B8',
                marginTop: '1px',
                textTransform: 'uppercase',
              }}
            >
              SMART LIVING & IOT CLOUD PLATFORM
            </div>
          </div>
        </div>

        {/* Right Controls: AI Assistant, Area, Bell, User Profile, Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
          {/* Trợ Lý AI Tổ Ấm Pill Button */}
          {onOpenAiAssistant && (
            <button
              type="button"
              onClick={onOpenAiAssistant}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 15px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #D96B43 0%, #C25E38 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(217, 107, 67, 0.28)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              title="Mở Trợ Lý AI Tổ Ấm thông minh"
            >
              <Sparkles size={14} color="#FEF08A" />
              <span>Trợ Lý AI Tổ Ấm</span>
            </button>
          )}

          {/* Area Selector Dropdown Pill: Tòa A • Toàn Khu Vực */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontSize: '0.78rem',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          >
            <Building size={14} color="#64748B" />
            {apartments && apartments.length > 0 ? (
              <select
                aria-label="Chọn căn hộ hoặc khu vực"
                value={currentApartmentId || currentUser?.apartment_id || (apartments[0]?.apartment_id ?? '')}
                onChange={(e) => onSelectApartment?.(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {apartments.map((apt) => (
                  <option key={apt.id} value={apt.apartment_id}>
                    Tòa A • Căn {apt.unit_number} ({apt.building_name || 'Tòa nhà'})
                  </option>
                ))}
              </select>
            ) : (
              <span>{currentUser?.apartment_unit ? `Tòa A • Căn ${currentUser.apartment_unit}` : 'Tòa A • Toàn Khu Vực'}</span>
            )}
            <ChevronDown size={13} color="#94A3B8" />
          </div>

          {/* Circular Notification Bell with Red Badge */}
          <NotificationCenter currentUserId={currentUser?.id} circleStyle={true} />

          {/* User Profile Block */}
          <div
            onClick={onOpenProfile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenProfile?.();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '3px 6px',
              borderRadius: '8px',
              transition: 'background 0.15s ease',
            }}
            title="Xem và chỉnh sửa hồ sơ cá nhân"
          >
            {/* Avatar */}
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.full_name || 'User Avatar'}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid #E2E8F0',
                }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38BDF8',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: '1px solid #CBD5E1',
                }}
              >
                {currentUser?.full_name?.[0]?.toUpperCase() || 'A'}
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#1E293B',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser?.full_name || (isAdmin ? 'Nguyễn Quản Trị (Super Admin)' : 'Cư Dân')}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#94A3B8',
                  lineHeight: 1.2,
                  marginTop: '2px',
                }}
              >
                {isAdmin ? 'Super Admin' : (currentUser?.apartment_unit ? `Căn hộ ${currentUser.apartment_unit}` : 'Cư Dân')}
              </div>
            </div>
          </div>

          {/* Circular Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#0F172A';
              e.currentTarget.style.backgroundColor = '#F8FAFC';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 2: Sub-navigation Tabs (Left) + Live Sync Status (Right) */}
      {/* ============================================================ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderTop: '1px solid #F1F5F9',
          backgroundColor: '#FFFFFF',
          gap: '16px',
        }}
      >
        {/* Navigation Tabs */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            minWidth: 0,
          }}
        >
          {subNavItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectPage(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #C25E38' : '2px solid transparent',
                  padding: '9px 0 8px 0',
                  color: isActive ? '#C25E38' : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  fontFamily: 'Inter, var(--font-sans)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#0F172A';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#475569';
                }}
              >
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span
                    style={{
                      backgroundColor: item.badgeColor || '#C25E38',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      padding: '0 5px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      lineHeight: '14px',
                      height: '14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Live Sync Status Pill */}
        <div
          onClick={onToggleAutoRefresh || onRefresh}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleAutoRefresh?.();
            }
          }}
          title="Bấm để bật/tắt đồng bộ tự động hoặc làm mới telemetry"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 0',
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', width: '9px', height: '9px' }}>
            <span
              className="animate-ping"
              style={{
                position: 'absolute',
                display: 'inline-flex',
                height: '100%',
                width: '100%',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                opacity: autoRefresh ? 0.75 : 0,
              }}
            />
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                borderRadius: '50%',
                height: '9px',
                width: '9px',
                backgroundColor: autoRefresh ? '#10B981' : '#94A3B8',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: 'monospace, var(--font-mono)',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: autoRefresh ? '#065F46' : '#64748B',
              letterSpacing: '0.04em',
            }}
          >
            {isRefreshing ? 'SYNC: ĐANG TẢI...' : (autoRefresh ? 'SYNC: LIVE 0.8s' : 'SYNC: TẠM DỪNG')}
          </span>
        </div>
      </div>
    </header>
  );
};
