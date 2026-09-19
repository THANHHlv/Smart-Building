import React from 'react';
import {
  Building2,
  CalendarCheck,
  Home,
  Kanban,
  Newspaper,
  Receipt,
  Shield,
  Users,
  Wrench,
} from 'lucide-react';
import type { UserProfile } from '../types';

export type PageId =
  | 'overview'
  | 'operations'
  | 'residents'
  | 'tickets'
  | 'billing'
  | 'services'
  | 'bulletin'
  | 'rbac'
  | 'maintenance';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: number;
  badgeColor?: string;
  adminOnly?: boolean;
  residentOnly?: boolean;
}

interface NavbarProps {
  currentUser: UserProfile | null;
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  unassignedUsersCount?: number;
  unreadAnnouncementsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activePage,
  onSelectPage,
  unassignedUsersCount = 0,
  unreadAnnouncementsCount = 0,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: isAdmin ? 'Tổng Quan Tòa Nhà' : 'Nhà Của Tôi',
      icon: Home,
    },
    {
      id: 'operations',
      label: 'Vận Hành Ban Quản Lý',
      icon: Building2,
      adminOnly: true,
    },
    {
      id: 'residents',
      label: 'Quản Lý Cư Dân',
      icon: Users,
      badge: unassignedUsersCount,
      badgeColor: '#f43f5e',
      adminOnly: true,
    },
    {
      id: 'tickets',
      label: isAdmin ? 'Phiếu Việc (Kanban)' : 'Yêu Cầu Hỗ Trợ',
      icon: Kanban,
    },
    {
      id: 'billing',
      label: isAdmin ? 'Quản Lý Hoá Đơn' : 'Dịch Vụ & Hoá Đơn',
      icon: Receipt,
    },
    {
      id: 'services',
      label: 'Yêu Cầu & Tiện Ích',
      icon: CalendarCheck,
    },
    {
      id: 'bulletin',
      label: 'Bảng Tin Tòa Nhà',
      icon: Newspaper,
      badge: unreadAnnouncementsCount,
      badgeColor: '#D96B43',
    },
    {
      id: 'maintenance',
      label: 'Lịch Bảo Trì',
      icon: Wrench,
    },
    {
      id: 'rbac',
      label: 'Phân Quyền RBAC',
      icon: Shield,
      adminOnly: true,
    },
  ];

  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.residentOnly && isAdmin) return false;
    return true;
  });

  return (
    <nav
      aria-label="Thanh điều hướng chính của hệ thống"
      className="main-navbar-container"
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #EFE9DF',
        padding: '6px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
      }}
    >
      <div
        role="tablist"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          minWidth: 'max-content',
        }}
      >
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const hasBadge = !!item.badge && item.badge > 0;

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              id={`nav-tab-${item.id}`}
              aria-controls={`page-panel-${item.id}`}
              onClick={() => onSelectPage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: isActive ? '1px solid rgba(217, 107, 67, 0.35)' : '1px solid transparent',
                backgroundColor: isActive ? 'rgba(217, 107, 67, 0.08)' : 'transparent',
                color: isActive ? '#D96B43' : 'var(--text-secondary, #6F6861)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans, inherit)',
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(243, 238, 229, 0.7)';
                  e.currentTarget.style.color = 'var(--text-primary, #2D2825)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #6F6861)';
                }
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>

              {hasBadge && (
                <span
                  style={{
                    backgroundColor: item.badgeColor || '#D96B43',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    lineHeight: '1.2',
                    minWidth: '16px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {item.badge}
                </span>
              )}

              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '20%',
                    right: '20%',
                    height: '2.5px',
                    backgroundColor: '#D96B43',
                    borderRadius: '3px 3px 0 0',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
