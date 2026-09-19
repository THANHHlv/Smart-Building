import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCheck,
  ChevronRight,
  Flame,
  Info,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { Announcement, UserProfile } from '../types';

interface CommunityBulletinProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  currentUser: UserProfile | null;
  onOpenEditor?: () => void;
  onUnreadCountChanged?: (count: number) => void;
}

export const CommunityBulletin: React.FC<CommunityBulletinProps> = ({
  isOpen,
  onClose,
  asPage = false,
  currentUser,
  onOpenEditor,
  onUnreadCountChanged,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [readingAnnouncement, setReadingAnnouncement] = useState<Announcement | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const loadFeed = async (cat?: string) => {
    try {
      setLoading(true);
      const res = await api.getAnnouncements(cat === 'all' ? undefined : cat);
      setAnnouncements(res.items);
      setTotalUnread(res.total_unread);
      if (onUnreadCountChanged) {
        onUnreadCountChanged(res.total_unread);
      }
    } catch (err) {
      console.error('Failed to load announcements feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadFeed(selectedCategory);
    }
  }, [isOpen, asPage, selectedCategory]);

  const handleOpenDetail = async (item: Announcement) => {
    setReadingAnnouncement(item);
    if (!item.is_read) {
      try {
        await api.markAnnouncementAsRead(item.id);
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, is_read: true } : a))
        );
        setTotalUnread((prev) => {
          const next = Math.max(0, prev - 1);
          if (onUnreadCountChanged) onUnreadCountChanged(next);
          return next;
        });
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }
  };

  if (!isOpen && !asPage) return null;

  // Separate pinned/urgent announcements from general feed
  const urgentPinned = announcements.filter((a) => a.pin_to_top || a.priority === 'urgent');
  const regularFeed = announcements.filter((a) => !(a.pin_to_top || a.priority === 'urgent'));

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'maintenance':
        return <Wrench size={14} color="#4A7C59" />;
      case 'event':
        return <Calendar size={14} color="#D96B43" />;
      case 'safety':
        return <Flame size={14} color="#C85252" />;
      default:
        return <Info size={14} color="#437A82" />;
    }
  };

  const getCategoryBadgeLabel = (category: string) => {
    switch (category) {
      case 'maintenance':
        return 'Bảo Trì & Kỹ Thuật';
      case 'event':
        return 'Sự Kiện & Lễ Hội';
      case 'safety':
        return 'An Toàn & PCCC';
      default:
        return 'Thông Báo Chung';
    }
  };

  const content = (
    <div
      className="page-view-container animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '860px',
        maxHeight: asPage ? 'none' : '92vh',
        minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
        backgroundColor: '#FBF9F5',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid #EFE9DF',
        boxShadow: asPage ? '0 2px 12px rgba(45, 40, 37, 0.05)' : '0 24px 64px rgba(45, 40, 37, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#2D2825',
        fontFamily: 'var(--font-sans)',
      }}
    >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #EFE9DF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Megaphone size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  id="bulletin-title"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    color: '#2D2825',
                  }}
                >
                  Bảng Tin Chung Cư
                </h2>
                {totalUnread > 0 && (
                  <span
                    style={{
                      background: '#D96B43',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {totalUnread} tin mới
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6F6861' }}>
                Tin tức, thông báo bảo trì & sự kiện chính thức từ Ban Quản Lý The Oasis
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && onOpenEditor && (
              <button
                type="button"
                onClick={onOpenEditor}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#D96B43',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(217, 107, 67, 0.25)',
                }}
              >
                <Plus size={15} />
                <span>Đăng Thông Báo</span>
              </button>
            )}

            {!asPage && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng bảng tin"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8E867E',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#F3EEE5',
            borderBottom: '1px solid #EFE9DF',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'all', label: 'Tất cả tin' },
            { key: 'maintenance', label: 'Bảo trì & Kỹ thuật' },
            { key: 'event', label: 'Sự kiện & Lễ hội' },
            { key: 'safety', label: 'An toàn & PCCC' },
            { key: 'general', label: 'Thông báo chung' },
          ].map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isActive ? '1px solid #D96B43' : '1px solid #EFE9DF',
                  background: isActive ? '#D96B43' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#6F6861',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Feed Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#6F6861' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <div>Đang cập nhật bảng tin...</div>
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8E867E' }}>
              <Megaphone size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: '0.96rem', color: '#2D2825' }}>Không có bài thông báo nào trong mục này</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Các thông báo mới hoặc thông báo khẩn sẽ được hiển thị tại đây.</div>
            </div>
          ) : (
            <>
              {/* 1. URGENT PINNED BANNER (Terracotta Highlight - Biophilic Oasis Style, not harsh red) */}
              {urgentPinned.length > 0 && selectedCategory === 'all' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {urgentPinned.map((urgentItem) => (
                    <article
                      key={urgentItem.id}
                      onClick={() => handleOpenDetail(urgentItem)}
                      style={{
                        background: 'linear-gradient(135deg, rgba(217, 107, 67, 0.12), rgba(217, 107, 67, 0.05))',
                        border: '1px solid rgba(217, 107, 67, 0.4)',
                        borderRadius: '14px',
                        padding: '16px 20px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(217, 107, 67, 0.1)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 107, 67, 0.18)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(217, 107, 67, 0.1)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              background: '#D96B43',
                              color: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Pin size={10} />
                            <span>KHẨN CẤP • GHIM ĐẦU TRANG</span>
                          </span>
                          <span style={{ fontSize: '0.76rem', color: '#6F6861' }}>
                            {new Date(urgentItem.published_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {!urgentItem.is_read && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D96B43' }} title="Bài chưa đọc" />
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#D96B43', lineHeight: 1.4 }}>
                        {urgentItem.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: '#2D2825', lineHeight: 1.5 }}>
                        {urgentItem.content.length > 180 ? `${urgentItem.content.substring(0, 180)}...` : urgentItem.content}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                        <span style={{ fontSize: '0.76rem', color: '#8E867E' }}>
                          Người đăng: <strong>{urgentItem.publisher_name || 'Ban Quản Lý'}</strong>
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#D96B43', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Xem chi tiết <ChevronRight size={14} />
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* 2. REGULAR FEED (Social/News Feed Cards) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(selectedCategory === 'all' ? regularFeed : announcements).map((item) => (
                  <article
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #EFE9DF',
                      padding: '18px 20px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      display: 'flex',
                      gap: '16px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#D96B43';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(45, 40, 37, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#EFE9DF';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(45, 40, 37, 0.04)';
                    }}
                  >
                    {/* Optional Thumbnail Image */}
                    {item.image_url && (
                      <div
                        style={{
                          width: 110,
                          height: 90,
                          borderRadius: '10px',
                          backgroundImage: `url(${item.image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          flexShrink: 0,
                          border: '1px solid #EFE9DF',
                        }}
                      />
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#F3EEE5',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#6F6861',
                            }}
                          >
                            {getCategoryIcon(item.category)}
                            <span>{getCategoryBadgeLabel(item.category)}</span>
                          </span>

                          <span style={{ fontSize: '0.74rem', color: '#8E867E' }}>
                            {new Date(item.published_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {!item.is_read ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              background: 'rgba(217, 107, 67, 0.1)',
                              color: '#D96B43',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 700,
                            }}
                          >
                            Mới
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#8E867E', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCheck size={12} /> Đã đọc
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D2825', lineHeight: 1.4 }}>
                        {item.title}
                      </h3>
                      <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#6F6861', lineHeight: 1.5 }}>
                        {item.content.length > 150 ? `${item.content.substring(0, 150)}...` : item.content}
                      </p>

                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#8E867E' }}>
                        <span>Đăng bởi: <strong>{item.publisher_name || 'Ban Quản Lý'}</strong></span>
                        <span style={{ color: '#D96B43', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          Đọc thêm <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #EFE9DF',
            background: '#F3EEE5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#6F6861',
          }}
        >
          <span>The Oasis • Hệ thống bản tin tự động đồng bộ theo thời gian thực</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #EFE9DF',
              background: '#FFFFFF',
              color: '#2D2825',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Đóng
          </button>
        </div>

      {/* Detail Reader Modal */}
      {readingAnnouncement && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(45, 40, 37, 0.75)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EFE9DF',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Reader Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #EFE9DF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FBF9F5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#F3EEE5',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#6F6861',
                  }}
                >
                  {getCategoryBadgeLabel(readingAnnouncement.category)}
                </span>
                {readingAnnouncement.priority === 'urgent' && (
                  <span
                    style={{
                      background: '#D96B43',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    KHẨN CẤP
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setReadingAnnouncement(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8E867E',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Reader Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {readingAnnouncement.image_url && (
                <div
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: '12px',
                    backgroundImage: `url(${readingAnnouncement.image_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    marginBottom: '20px',
                    border: '1px solid #EFE9DF',
                  }}
                />
              )}

              <h2
                id="reader-title"
                style={{
                  margin: '0 0 12px',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: readingAnnouncement.priority === 'urgent' ? '#D96B43' : '#2D2825',
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {readingAnnouncement.title}
              </h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '0.78rem',
                  color: '#6F6861',
                  marginBottom: '20px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid #EFE9DF',
                }}
              >
                <span>Đăng ngày: <strong>{new Date(readingAnnouncement.published_at).toLocaleString('vi-VN')}</strong></span>
                <span>•</span>
                <span>Người đăng: <strong>{readingAnnouncement.publisher_name || 'Ban Quản Lý'}</strong></span>
                {readingAnnouncement.expires_at && (
                  <>
                    <span>•</span>
                    <span>Hạn hiển thị: <strong>{new Date(readingAnnouncement.expires_at).toLocaleDateString('vi-VN')}</strong></span>
                  </>
                )}
              </div>

              <div
                style={{
                  fontSize: '0.92rem',
                  color: '#2D2825',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                }}
              >
                {readingAnnouncement.content}
              </div>
            </div>

            {/* Reader Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #EFE9DF',
                background: '#FBF9F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4A7C59', fontSize: '0.8rem' }}>
                <CheckCheck size={16} />
                <span>Đã đánh dấu đã đọc bài này</span>
              </div>
              <button
                type="button"
                onClick={() => setReadingAnnouncement(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#2D2825',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (asPage) return content;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulletin-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(45, 40, 37, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {content}
    </div>
  );
};
