import React, { useEffect, useState } from 'react';
import {
  X,
  Bell,
  Check,
  AlertTriangle,
  Receipt,
  Wrench,
  Megaphone,
  Smartphone,
  MessageSquare,
  Mail,
  ShieldCheck,
  Save,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferenceItem,
} from '../types';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface CategoryConfig {
  key: NotificationCategory;
  name: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  badgeBg: string;
}

interface ChannelConfig {
  key: NotificationChannel;
  name: string;
  icon: React.ReactNode;
  recommendedBadge?: string;
  description: string;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const categories: CategoryConfig[] = [
    {
      key: 'billing',
      name: 'Hóa Đơn & Thanh Toán',
      description: 'Nhắc hạn tiền điện, nước, phí quản lý định kỳ và hóa đơn mới phát hành',
      icon: <Receipt size={18} color="#F59E0B" />,
      accentColor: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      key: 'alert',
      name: 'Cảnh Báo An Toàn & IoT',
      description: 'Phát hiện rò rỉ nước, bất thường tiêu thụ điện và cảnh báo cảm biến khẩn cấp',
      icon: <AlertTriangle size={18} color="#D96B43" />,
      accentColor: '#D96B43',
      badgeBg: 'rgba(217, 107, 67, 0.12)',
    },
    {
      key: 'maintenance',
      name: 'Phiếu Sự Cố & Kỹ Thuật',
      description: 'Cập nhật tiến độ tiếp nhận, phân công và hoàn tất sửa chữa thiết bị',
      icon: <Wrench size={18} color="#F97316" />,
      accentColor: '#F97316',
      badgeBg: 'rgba(249, 115, 22, 0.12)',
    },
    {
      key: 'announcement',
      name: 'Tin Tức & Ban Quản Lý',
      description: 'Thông báo lịch bảo trì điện nước chung, sinh hoạt cư dân và thông báo tòa nhà',
      icon: <Megaphone size={18} color="#10B981" />,
      accentColor: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
    },
  ];

  const channels: ChannelConfig[] = [
    {
      key: 'in_app',
      name: 'Cổng Cư Dân',
      icon: <Bell size={15} color="#38BDF8" />,
      recommendedBadge: 'Cơ bản',
      description: 'Hiện trực tiếp tại chuông thông báo trên giao diện web app',
    },
    {
      key: 'zalo',
      name: 'Zalo OA',
      icon: <MessageSquare size={15} color="#0068FF" />,
      recommendedBadge: 'Ưu tiên',
      description: 'Nhận qua tin nhắn Zalo Official Account chính thức của tòa nhà',
    },
    {
      key: 'sms',
      name: 'Tin Nhắn SMS',
      icon: <Smartphone size={15} color="#10B981" />,
      description: 'Tin nhắn gửi trực tiếp tới số điện thoại đăng ký',
    },
    {
      key: 'push',
      name: 'Web Push',
      icon: <ShieldCheck size={15} color="#A855F7" />,
      description: 'Thông báo đẩy trên trình duyệt ngay cả khi đang xem tab khác',
    },
    {
      key: 'email',
      name: 'Thư Điện Tử',
      icon: <Mail size={15} color="#64748B" />,
      description: 'Gửi bản sao kê chi tiết hóa đơn vào hộp thư email',
    },
  ];

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchPreferences = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      setSaveSuccess(false);
      try {
        const res = await api.getNotificationPreferences();
        if (mounted) {
          setPreferences(res.preferences);
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || 'Không thể tải cài đặt thông báo');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchPreferences();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const isChannelEnabled = (category: NotificationCategory, channel: NotificationChannel): boolean => {
    const item = preferences.find((p) => p.category === category && p.channel === channel);
    return item ? item.is_enabled : true;
  };

  const toggleChannel = (category: NotificationCategory, channel: NotificationChannel) => {
    setPreferences((prev) => {
      const idx = prev.findIndex((p) => p.category === category && p.channel === channel);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], is_enabled: !updated[idx].is_enabled };
        return updated;
      } else {
        return [...prev, { category, channel, is_enabled: false }];
      }
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await api.updateNotificationPreferences(preferences);
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu tùy chọn');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAllToDefault = () => {
    // Enable all channels
    const defaults: NotificationPreferenceItem[] = [];
    categories.forEach((cat) => {
      channels.forEach((chan) => {
        defaults.push({ category: cat.key, channel: chan.key, is_enabled: true });
      });
    });
    setPreferences(defaults);
    setSaveSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(217, 107, 67, 0.15)',
                border: '1px solid rgba(217, 107, 67, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} color="#D96B43" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Cài Đặt Kênh Nhận Thông Báo
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Chủ động chọn kênh nhận tin phù hợp với thói quen sinh hoạt của gia đình bạn
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccess && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={16} />
              <span>Đã lưu tùy chọn kênh thông báo thành công!</span>
            </div>
          )}

          {/* Matrix Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1.8fr) repeat(5, 1fr)',
                padding: '14px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border-medium)',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                LOẠI THÔNG BÁO
              </div>
              {channels.map((chan) => (
                <div
                  key={chan.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {chan.icon}
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {chan.name}
                    </span>
                  </div>
                  {chan.recommendedBadge && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: chan.key === 'zalo' ? 'rgba(0, 104, 255, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: chan.key === 'zalo' ? '#3b82f6' : '#38bdf8',
                        fontWeight: 600,
                      }}
                    >
                      {chan.recommendedBadge}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Matrix Rows */}
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Đang tải cấu hình kênh nhận tin...
              </div>
            ) : (
              categories.map((cat, idx) => (
                <div
                  key={cat.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 1.8fr) repeat(5, 1fr)',
                    padding: '16px 18px',
                    borderBottom: idx < categories.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                  className="hover-row"
                >
                  {/* Category Info */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: cat.badgeBg,
                        border: `1px solid ${cat.accentColor}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cat.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          marginTop: '2px',
                          lineHeight: '1.3',
                        }}
                      >
                        {cat.description}
                      </div>
                    </div>
                  </div>

                  {/* Channel Toggles */}
                  {channels.map((chan) => {
                    const enabled = isChannelEnabled(cat.key, chan.key);
                    return (
                      <div
                        key={chan.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleChannel(cat.key, chan.key)}
                          style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            background: enabled ? cat.accentColor : 'rgba(255, 255, 255, 0.1)',
                            border: enabled ? `1px solid ${cat.accentColor}` : '1px solid var(--border-medium)',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            padding: 0,
                          }}
                          title={`${enabled ? 'Tắt' : 'Bật'} kênh ${chan.name} cho ${cat.name}`}
                        >
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: enabled ? '22px' : '3px',
                              transition: 'left 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Practical Notes for Resident */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              background: 'rgba(217, 107, 67, 0.06)',
              border: '1px solid rgba(217, 107, 67, 0.2)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}
          >
            <strong style={{ color: '#D96B43' }}>Lưu ý vận hành:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>
                <strong>Zalo OA</strong> là kênh được Ban Quản Lý khuyến khích bật cho toàn bộ danh mục để nhận thông báo tức thì, không bị tính phí SMS.
              </li>
              <li>
                Kênh <strong>Cổng Cư Dân</strong> luôn lưu trữ bản ghi thông báo trong hộp thư cá nhân để đối soát lịch sử khi cần thiết.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
          }}
        >
          <button
            onClick={resetAllToDefault}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
            }}
          >
            <RotateCcw size={14} />
            <span>Khôi Phục Mặc Định</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#D96B43',
                borderColor: '#D96B43',
                color: '#ffffff',
                fontWeight: 600,
                padding: '8px 18px',
              }}
            >
              <Save size={15} />
              <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
