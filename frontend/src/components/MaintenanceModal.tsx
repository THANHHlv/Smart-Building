import React, { useEffect, useState } from 'react';
import {
  AirVent,
  CheckCircle,
  Clock,
  Droplets,
  Loader2,
  PlusCircle,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

import { api } from '../services/api';
import type { MaintenanceTicket } from '../types';

interface MaintenanceModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  isAdmin?: boolean;
  apartmentUnit?: string;
  onTicketChanged?: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  asPage = false,
  isAdmin,
  apartmentUnit,
  onTicketChanged,
}) => {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>(isAdmin ? 'list' : 'create');

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('electrical');
  const [urgency, setUrgency] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin update state
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [updateStatus, setUpdateStatus] = useState('in_progress');
  const [techNotes, setTechNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMaintenanceTickets();
      setTickets(data);
    } catch (err: any) {
      console.error('Failed to load maintenance tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadTickets();
      setErrorMsg(null);
      setSuccessMsg(null);
      if (isAdmin) {
        setActiveTab('list');
      }
    }
  }, [isOpen, asPage, isAdmin]);

  if (!isOpen && !asPage) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.createMaintenanceTicket({
        title,
        description,
        category,
        urgency,
      });
      setSuccessMsg('Đã gửi yêu cầu báo hỏng thành công! Ban Quản Lý và Kỹ Thuật Viên sẽ tiếp nhận sớm.');
      setTitle('');
      setDescription('');
      await loadTickets();
      setActiveTab('list');
      onTicketChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gửi yêu cầu thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setIsUpdating(true);
      setErrorMsg(null);
      await api.updateMaintenanceTicket(selectedTicket.id, {
        status: updateStatus,
        technician_notes: techNotes,
      });
      setSuccessMsg('Đã cập nhật tiến độ xử lý phiếu kỹ thuật thành công.');
      setSelectedTicket(null);
      await loadTickets();
      onTicketChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cập nhật thất bại');
    } finally {
      setIsUpdating(false);
    }
  };

  const getUrgencyBadge = (u: string) => {
    switch (u) {
      case 'critical':
        return <span className="badge badge-critical">KHẨN CẤP</span>;
      case 'high':
        return <span className="badge badge-high">CAO</span>;
      case 'medium':
        return <span className="badge badge-medium">TRUNG BÌNH</span>;
      default:
        return <span className="badge badge-low">THẤP</span>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'open':
        return (
          <span
            className="badge"
            style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.3)' }}
          >
            Chờ Tiếp Nhận
          </span>
        );
      case 'in_progress':
        return (
          <span
            className="badge"
            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
          >
            Đang Xử Lý
          </span>
        );
      case 'resolved':
        return (
          <span
            className="badge"
            style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}
          >
            Đã Hoàn Thành
          </span>
        );
      default:
        return <span className="badge badge-low">{s}</span>;
    }
  };

  const getCategoryIcon = (c: string) => {
    switch (c) {
      case 'electrical':
        return <Zap size={14} color="#f59e0b" />;
      case 'plumbing':
        return <Droplets size={14} color="#06b6d4" />;
      case 'hvac':
        return <AirVent size={14} color="#38bdf8" />;
      default:
        return <Wrench size={14} color="#94a3b8" />;
    }
  };

  const content = (
    <div
      className="glass-panel animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '860px',
        maxHeight: asPage ? 'none' : '90vh',
        minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #141d31 0%, #0c1222 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: asPage ? '0 2px 12px rgba(0, 0, 0, 0.3)' : '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f97316',
              }}
            >
              <Wrench size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {isAdmin ? 'Trung Tâm Xử Lý Phiếu Bảo Trì & Sự Cố' : `Báo Hỏng & Hỗ Trợ Kỹ Thuật (Căn ${apartmentUnit || ''})`}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Kênh kết nối kỹ thuật trực tiếp giữa Cư Dân và Đội Ngũ Vận Hành Tòa Nhà
              </span>
            </div>
          </div>

          {!asPage && onClose && (
            <button
              onClick={onClose}
              className="btn-icon"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '8px',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
              title="Đóng"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.4)',
          }}
        >
          {!isAdmin && (
            <button
              onClick={() => setActiveTab('create')}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: activeTab === 'create' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'create' ? '2px solid #f97316' : 'none',
                color: activeTab === 'create' ? '#f97316' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <PlusCircle size={16} />
              Gửi Yêu Cầu Mới
            </button>
          )}

          <button
            onClick={() => setActiveTab('list')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'list' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'list' ? '2px solid #38bdf8' : 'none',
              color: activeTab === 'list' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Clock size={16} />
            {isAdmin ? `Danh Sách Toàn Bộ Phiếu (${tickets.length})` : `Phiếu Của Căn Hộ (${tickets.length})`}
          </button>
        </div>

        {/* Alert status messages */}
        {successMsg && (
          <div
            style={{
              padding: '10px 24px',
              background: 'rgba(34, 197, 94, 0.12)',
              borderBottom: '1px solid rgba(34, 197, 94, 0.25)',
              color: '#4ade80',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                  Tiêu Đề Sự Cố / Yêu Cầu: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bóng đèn phòng khách bị chập, Rò rỉ vòi nước bồn rửa..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                    Phân Loại Hạng Mục:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    <option value="electrical">Hệ thống Điện (Chiếu sáng, Ổ cắm)</option>
                    <option value="plumbing">Hệ thống Nước (Vòi, Rò rỉ, Thoát nước)</option>
                    <option value="hvac">Điều Hòa & Thông Gió (HVAC)</option>
                    <option value="appliance">Thiết Bị Gia Dụng Thông Minh</option>
                    <option value="general">Hạng mục chung / Khác</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                    Mức Độ Khẩn Cấp:
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    <option value="low">Thấp (Có thể xử lý trong vài ngày)</option>
                    <option value="medium">Trung bình (Xử lý trong 24 giờ)</option>
                    <option value="high">Cao (Cần kỹ thuật đến trong ngày)</option>
                    <option value="critical">Khẩn cấp (Sự cố mất điện, vỡ ống nước)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                  Mô Tả Chi Tiết Sự Cố: *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Mô tả cụ thể vị trí, hiện tượng xảy ra lúc mấy giờ để kỹ thuật viên chuẩn bị dụng cụ phù hợp..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {errorMsg && <div style={{ color: '#f87171', fontSize: '0.85rem' }}>{errorMsg}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#f97316',
                  fontSize: '0.9rem',
                }}
              >
                {isSubmitting && <Loader2 className="spin" size={18} />}
                Gửi Yêu Cầu Cho Kỹ Thuật Viên
              </button>
            </form>
          )}

          {activeTab === 'list' && (
            <div>
              {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <Loader2 className="spin" size={28} style={{ margin: '0 auto 10px' }} />
                  Đang tải danh sách phiếu...
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Chưa có yêu cầu hỗ trợ hoặc báo hỏng nào.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="glass-panel"
                      style={{
                        padding: '16px 20px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            {getCategoryIcon(t.category)}
                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
                              {t.title}
                            </h4>
                            {getUrgencyBadge(t.urgency)}
                            {getStatusBadge(t.status)}
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', gap: '12px' }}>
                            <span>
                              Căn Hộ: <strong style={{ color: '#38bdf8' }}>Căn {t.apartment_unit}</strong> ({t.building_name || 'Skyline Tower'})
                            </span>
                            <span>•</span>
                            <span>Người gửi: {t.resident_name || 'Cư Dân'}</span>
                            <span>•</span>
                            <span>{new Date(t.created_at).toLocaleString('vi-VN')}</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setSelectedTicket(t);
                              setUpdateStatus(t.status === 'open' ? 'in_progress' : t.status);
                              setTechNotes(t.technician_notes || '');
                            }}
                            className="btn-secondary"
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            Xử Lý Phiếu
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {t.description}
                      </div>

                      {t.technician_notes && (
                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            borderLeft: '3px solid #38bdf8',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            color: '#93c5fd',
                          }}
                        >
                          <strong>Ghi chú Kỹ Thuật Viên: </strong>
                          {t.technician_notes}
                          {t.resolved_at && (
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                              Hoàn thành lúc: {new Date(t.resolved_at).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Cập nhật cho Admin */}
        {selectedTicket && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 10000,
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
                maxWidth: '500px',
                padding: '24px',
                background: '#192238',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>
                  Cập Nhật Tiến Độ Phiếu Kỹ Thuật
                </h3>
                <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <strong>Yêu cầu: </strong> {selectedTicket.title} (Căn {selectedTicket.apartment_unit})
              </div>

              <form onSubmit={handleUpdateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Trạng Thái Xử Lý:
                  </label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    <option value="open">Chờ tiếp nhận (Open)</option>
                    <option value="in_progress">Đang sửa chữa (In Progress)</option>
                    <option value="resolved">Đã hoàn thành (Resolved)</option>
                    <option value="cancelled">Hủy phiếu (Cancelled)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Ghi Chú Kỹ Thuật Viên / Phương Án Sửa:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: KTV Nguyễn Văn A đã thay van khóa mới, bàn giao lúc 15h..."
                    value={techNotes}
                    onChange={(e) => setTechNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn-primary"
                    style={{
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {isUpdating && <Loader2 className="spin" size={15} />}
                    Lưu Tiến Độ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );

  if (asPage) return content;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {content}
    </div>
  );
};
