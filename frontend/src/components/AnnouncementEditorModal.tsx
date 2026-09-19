import React, { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  Megaphone,
  Send,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { AnnouncementCategory, AnnouncementPriority } from '../types';

interface AnnouncementEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnnouncementCreated?: () => void;
  onPublished?: () => void;
}

export const AnnouncementEditorModal: React.FC<AnnouncementEditorModalProps> = ({
  isOpen,
  onClose,
  onAnnouncementCreated,
  onPublished,
}) => {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('general');
  const [priority, setPriority] = useState<AnnouncementPriority>('standard');
  const [pinToTop, setPinToTop] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.createAdminAnnouncement({
        title,
        content,
        category,
        priority,
        pin_to_top: pinToTop || priority === 'urgent',
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        image_url: imageUrl || undefined,
      });

      onAnnouncementCreated?.();
      onPublished?.();
      onClose();
      // Reset
      setTitle('');
      setContent('');
      setCategory('general');
      setPriority('standard');
      setPinToTop(false);
      setExpiresAt('');
      setImageUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể đăng bài viết. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(45, 40, 37, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9DF',
          boxShadow: '0 24px 64px rgba(45, 40, 37, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          color: '#2D2825',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #EFE9DF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FBF9F5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Megaphone size={20} />
            </div>
            <div>
              <h2
                id="editor-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Đăng Thông Báo Ban Quản Lý
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#6F6861' }}>
                Soạn thảo và xem trước feed cư dân trước khi phát hành
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                background: '#F3EEE5',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #EFE9DF',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'edit' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'edit' ? '#2D2825' : '#6F6861',
                  fontWeight: viewMode === 'edit' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: viewMode === 'edit' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <FileText size={13} />
                <span>Soạn Thảo</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'preview' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'preview' ? '#D96B43' : '#6F6861',
                  fontWeight: viewMode === 'preview' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: viewMode === 'preview' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <Eye size={13} />
                <span>Xem Trước</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
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
        </div>

        {errorMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(200, 82, 82, 0.12)',
              border: '1px solid rgba(200, 82, 82, 0.3)',
              color: '#C85252',
              fontSize: '0.84rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {viewMode === 'edit' ? (
            <form id="announcement-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Priority warning */}
              {priority === 'urgent' && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(217, 107, 67, 0.1)',
                    border: '1px solid rgba(217, 107, 67, 0.35)',
                    color: '#D96B43',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>CẢNH BÁO PHÁT SÓNG TỨC THÌ:</strong> Bài viết này sẽ được ghim ở đầu trang bảng tin và lập tức gửi thông báo đẩy in-app đến toàn bộ cư dân tòa nhà qua Notification Service.
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                  Tiêu đề thông báo *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Tạm ngưng cấp nước sinh hoạt trục tầng 10 - 20"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #EFE9DF',
                    background: '#FBF9F5',
                    fontSize: '0.9rem',
                    color: '#2D2825',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Category & Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                    Phân loại danh mục
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      background: '#FBF9F5',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                    }}
                  >
                    <option value="general">Thông báo chung</option>
                    <option value="maintenance">Bảo trì & Kỹ thuật</option>
                    <option value="event">Sự kiện & Lễ hội</option>
                    <option value="safety">An toàn & PCCC</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      setPriority(p);
                      if (p === 'urgent') setPinToTop(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: priority === 'urgent' ? '1px solid #D96B43' : '1px solid #EFE9DF',
                      background: priority === 'urgent' ? 'rgba(217, 107, 67, 0.08)' : '#FBF9F5',
                      color: priority === 'urgent' ? '#D96B43' : '#2D2825',
                      fontSize: '0.88rem',
                      fontWeight: priority === 'urgent' ? 700 : 500,
                    }}
                  >
                    <option value="standard">Tiêu chuẩn (Hiển thị feed thông thường)</option>
                    <option value="urgent">Khẩn cấp (Ghim đầu trang + Bắn thông báo ngay)</option>
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                  Nội dung chi tiết thông báo *
                </label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Kính gửi quý cư dân, Ban Quản Lý xin thông báo..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #EFE9DF',
                    background: '#FBF9F5',
                    fontSize: '0.9rem',
                    color: '#2D2825',
                    lineHeight: 1.6,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Expiry & Pin row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                    Ngày hết hạn hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      background: '#FBF9F5',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#8E867E' }}>
                    Bài viết tự động ẩn khỏi feed cư dân sau ngày này.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                    Link ảnh đính kèm (URL)
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      background: '#FBF9F5',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', color: '#2D2825' }}>
                  <input
                    type="checkbox"
                    checked={pinToTop || priority === 'urgent'}
                    disabled={priority === 'urgent'}
                    onChange={(e) => setPinToTop(e.target.checked)}
                    style={{ accentColor: '#D96B43', width: 16, height: 16 }}
                  />
                  <span>Ghim thông báo này ở vị trí trên cùng của bảng tin</span>
                </label>
              </div>
            </form>
          ) : (
            /* LIVE PREVIEW TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#F3EEE5',
                  fontSize: '0.82rem',
                  color: '#6F6861',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Eye size={16} color="#D96B43" />
                <span>Đây là giao diện thực tế bài viết khi hiển thị trên màn hình ứng dụng của cư dân:</span>
              </div>

              {/* Simulated Card */}
              <article
                style={{
                  background: priority === 'urgent'
                    ? 'linear-gradient(135deg, rgba(217, 107, 67, 0.12), rgba(217, 107, 67, 0.05))'
                    : '#FFFFFF',
                  borderRadius: '14px',
                  border: priority === 'urgent' ? '1px solid rgba(217, 107, 67, 0.4)' : '1px solid #EFE9DF',
                  padding: '20px',
                  boxShadow: '0 4px 16px rgba(45, 40, 37, 0.06)',
                }}
              >
                {imageUrl && (
                  <div
                    style={{
                      width: '100%',
                      height: 180,
                      borderRadius: '10px',
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      marginBottom: '16px',
                      border: '1px solid #EFE9DF',
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: priority === 'urgent' ? '#D96B43' : '#F3EEE5',
                      color: priority === 'urgent' ? '#FFFFFF' : '#6F6861',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                    }}
                  >
                    {priority === 'urgent' ? 'KHẨN CẤP' : getCategoryLabel(category)}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: '#8E867E' }}>Vừa xong</span>
                </div>

                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: priority === 'urgent' ? '#D96B43' : '#2D2825',
                  }}
                >
                  {title || '(Chưa nhập tiêu đề thông báo)'}
                </h3>

                <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#2D2825', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {content || '(Chưa nhập nội dung chi tiết)'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#8E867E', borderTop: '1px solid #EFE9DF', paddingTop: '10px' }}>
                  <span>Người đăng: <strong>Ban Quản Lý The Oasis</strong></span>
                  {expiresAt && <span>Hạn: {expiresAt}</span>}
                </div>
              </article>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #EFE9DF',
            background: '#FBF9F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #EFE9DF',
              background: '#FFFFFF',
              color: '#6F6861',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title || !content}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              border: 'none',
              background: '#D96B43',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: submitting || !title || !content ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(217, 107, 67, 0.25)',
              opacity: !title || !content ? 0.6 : 1,
            }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Đăng Bài Lên Bảng Tin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
