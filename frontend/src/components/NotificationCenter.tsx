import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Settings,
  AlertTriangle,
  Receipt,
  Wrench,
  Megaphone,
  Sparkles,
  Smartphone,
  MessageSquare,
  Mail,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  NotificationCategory,
  NotificationChannel,
  ResidentNotification,
} from '../types';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';

interface NotificationCenterProps {
  currentUserId?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUserId }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<ResidentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [isDispatchingTest, setIsDispatchingTest] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async (cat?: string) => {
    setIsLoading(true);
    try {
      const res = await api.getMyNotifications(cat === 'all' ? undefined : cat);
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(activeCategory);
    // Poll every 30 seconds for live notifications
    const interval = setInterval(() => {
      fetchNotifications(activeCategory);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeCategory]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read', read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'read', read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  // Test trigger: dispatch an instant notification to test the Kafka/service pipeline
  const handleTriggerTest = async () => {
    if (!currentUserId) return;
    setIsDispatchingTest(true);
    try {
      await api.dispatchNotificationEvent({
        user_id: currentUserId,
        category: 'billing',
        template_code: 'billing.payment_due_soon',
        context: {
          invoice_number: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-TEST`,
          amount: '1,250,000',
          due_date: '15/10/2026',
          apartment_unit: 'Tổ ấm của bạn',
        },
        channels: ['in_app', 'zalo'],
      });
      // Refresh list
      await fetchNotifications(activeCategory);
    } catch (err) {
      console.error('Test notification dispatch failed', err);
    } finally {
      setIsDispatchingTest(false);
    }
  };

  const getCategoryTheme = (cat: NotificationCategory) => {
    switch (cat) {
      case 'billing':
        return {
          icon: <Receipt size={14} color="#F59E0B" />,
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          label: 'Hóa Đơn',
        };
      case 'alert':
        return {
          icon: <AlertTriangle size={14} color="#D96B43" />,
          color: '#D96B43',
          bg: 'rgba(217, 107, 67, 0.12)',
          border: 'rgba(217, 107, 67, 0.3)',
          label: 'Cảnh Báo',
        };
      case 'maintenance':
        return {
          icon: <Wrench size={14} color="#F97316" />,
          color: '#F97316',
          bg: 'rgba(249, 115, 22, 0.12)',
          border: 'rgba(249, 115, 22, 0.3)',
          label: 'Bảo Trì',
        };
      case 'announcement':
      default:
        return {
          icon: <Megaphone size={14} color="#10B981" />,
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          label: 'Tin Tòa Nhà',
        };
    }
  };

  const getChannelBadge = (channel: NotificationChannel) => {
    switch (channel) {
      case 'zalo':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#3b82f6', fontSize: '0.65rem' }}>
            <MessageSquare size={11} /> Zalo OA
          </span>
        );
      case 'sms':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#10b981', fontSize: '0.65rem' }}>
            <Smartphone size={11} /> SMS
          </span>
        );
      case 'email':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#64748b', fontSize: '0.65rem' }}>
            <Mail size={11} /> Email
          </span>
        );
      case 'in_app':
      default:
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#38bdf8', fontSize: '0.65rem' }}>
            <Bell size={11} /> Cổng Cư Dân
          </span>
        );
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (items: ResidentNotification[]) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups: { [key: string]: ResidentNotification[] } = {
      'Hôm nay': [],
      'Hôm qua': [],
      'Trước đó': [],
    };

    items.forEach((item) => {
      const itemDate = new Date(item.created_at).toDateString();
      if (itemDate === today) {
        groups['Hôm nay'].push(item);
      } else if (itemDate === yesterday) {
        groups['Hôm qua'].push(item);
      } else {
        groups['Trước đó'].push(item);
      }
    });

    return groups;
  };

  const grouped = groupNotificationsByDate(notifications);

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: isOpen ? 'rgba(217, 107, 67, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          border: isOpen ? '1px solid #D96B43' : '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title="Thông báo hệ thống & nhắc hạn"
        aria-label="Chuông thông báo"
        aria-expanded={isOpen}
      >
        <Bell size={18} color={isOpen ? '#D96B43' : 'var(--text-primary)'} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#D96B43',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 700,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-card)',
              boxShadow: '0 0 10px rgba(217, 107, 67, 0.6)',
              animation: 'pulse 2s infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '420px',
            maxWidth: '92vw',
            maxHeight: '560px',
            borderRadius: '16px',
            border: '1px solid var(--border-medium)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="#D96B43" />
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Thông Báo
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    background: 'rgba(217, 107, 67, 0.15)',
                    color: '#D96B43',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                  }}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={13} />
                  <span>Đã đọc hết</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsPreferencesOpen(true);
                  setIsOpen(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Cài đặt kênh nhận thông báo"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div
            style={{
              display: 'flex',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              gap: '6px',
              overflowX: 'auto',
              background: 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'billing', label: 'Hóa đơn' },
              { id: 'alert', label: 'Cảnh báo' },
              { id: 'maintenance', label: 'Bảo trì' },
              { id: 'announcement', label: 'Tòa nhà' },
            ].map((tab) => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: active ? '1px solid #D96B43' : '1px solid transparent',
                    background: active ? 'rgba(217, 107, 67, 0.15)' : 'transparent',
                    color: active ? '#D96B43' : 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Notification Feed List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '380px',
              padding: '6px 0',
            }}
          >
            {isLoading && notifications.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Bell size={18} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Không có thông báo nào
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                  Bạn đã cập nhật mọi thông tin mới nhất từ ban quản lý tòa nhà.
                </div>
              </div>
            ) : (
              Object.entries(grouped).map(([groupTitle, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={groupTitle} style={{ marginBottom: '6px' }}>
                    <div
                      style={{
                        padding: '6px 16px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {groupTitle}
                    </div>

                    {items.map((item) => {
                      const theme = getCategoryTheme(item.category);
                      const isUnread = item.status !== 'read';
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleMarkAsRead(item.id)}
                          style={{
                            padding: '10px 16px',
                            display: 'flex',
                            gap: '12px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isUnread ? 'rgba(217, 107, 67, 0.04)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          className="hover-row"
                        >
                          {/* Category Icon */}
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: theme.bg,
                              border: `1px solid ${theme.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            {theme.icon}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: isUnread ? 700 : 600,
                                  color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.title}
                              </span>
                              {isUnread && (
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: '#D96B43',
                                    flexShrink: 0,
                                  }}
                                  title="Chưa đọc"
                                />
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginTop: '3px',
                                lineHeight: '1.35',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {item.body}
                            </div>

                            {/* Meta row: Time & Channel badge */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '6px',
                                fontSize: '0.68rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Clock size={10} />
                                {formatTime(item.created_at)}
                              </span>
                              <div>{getChannelBadge(item.channel)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Quick Actions */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <button
              onClick={() => {
                setIsPreferencesOpen(true);
                setIsOpen(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#D96B43',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Settings size={13} />
              <span>Tùy chỉnh nhận tin</span>
            </button>

            {/* Test Trigger Button for live demonstration */}
            <button
              onClick={handleTriggerTest}
              disabled={isDispatchingTest || !currentUserId}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Bắn 1 sự kiện thử nghiệm vào Kafka để xem thông báo xuất hiện"
            >
              <Sparkles size={11} />
              <span>{isDispatchingTest ? 'Đang gửi...' : 'Test Event'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onSaved={() => fetchNotifications(activeCategory)}
      />
    </div>
  );
};
