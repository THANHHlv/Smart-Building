import React, { useEffect, useState, useRef } from 'react';
import {
  Wrench,
  Zap,
  Droplet,
  ArrowUpDown,
  Wind,
  Shield,
  HelpCircle,
  Camera,
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  RotateCcw,
  User,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import type { Ticket, TicketCategory, TicketDetail } from '../types';

interface ResidentTicketCenterProps {
  isOpen: boolean;
  onClose: () => void;
  apartmentId?: string | null;
  apartmentUnit?: string | null;
}

const CATEGORIES: {
  key: TicketCategory;
  label: string;
  sub: string;
  icon: React.FC<{ size?: number; color?: string; className?: string }>;
  color: string;
  bgColor: string;
  estimatedTime: string;
}[] = [
  {
    key: 'electrical',
    label: 'Điện Sinh Hoạt',
    sub: 'Ổ cắm, aptomat, đèn, thiết bị điện',
    icon: Zap,
    color: '#D96B43',
    bgColor: 'rgba(217, 107, 67, 0.1)',
    estimatedTime: 'Khoảng 2 – 4 giờ',
  },
  {
    key: 'plumbing',
    label: 'Hệ Thống Nước',
    sub: 'Vòi rò rỉ, áp lực yếu, thoát sàn',
    icon: Droplet,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    estimatedTime: 'Khoảng 2 – 4 giờ',
  },
  {
    key: 'hvac',
    label: 'Điều Hòa & Thông Gió',
    sub: 'Không mát, kêu to, chảy nước dàn lạnh',
    icon: Wind,
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.1)',
    estimatedTime: 'Khoảng 4 – 8 giờ',
  },
  {
    key: 'elevator',
    label: 'Thang Máy & Chung Cư',
    sub: 'Thang máy tầng, hành lang, đèn chung',
    icon: ArrowUpDown,
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    estimatedTime: 'Khoảng 1 – 2 giờ',
  },
  {
    key: 'security',
    label: 'An Ninh & Ra Vào',
    sub: 'Khóa từ, chuông hình, camera cửa',
    icon: Shield,
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    estimatedTime: 'Khoảng 2 – 4 giờ',
  },
  {
    key: 'other',
    label: 'Vấn Đề Khác',
    sub: 'Sự cố thiết bị hoặc yêu cầu đặc biệt',
    icon: HelpCircle,
    color: '#B87319',
    bgColor: 'rgba(184, 115, 25, 0.1)',
    estimatedTime: 'Khoảng 4 – 12 giờ',
  },
];

export const ResidentTicketCenter: React.FC<ResidentTicketCenterProps> = ({
  isOpen,
  onClose,
  apartmentId,
  apartmentUnit,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory>('electrical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Rating & Reopen state
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load resident's tickets
  const loadMyTickets = async () => {
    try {
      setIsLoadingList(true);
      const res = await api.getTickets({ page_size: 50 });
      setTickets(res.items || []);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMyTickets();
    }
  }, [isOpen]);

  // Load ticket details when selected
  const loadTicketDetail = async (id: string) => {
    try {
      const detail = await api.getTicketDetail(id);
      setSelectedTicket(detail);
    } catch (err: any) {
      console.error('Failed to load ticket detail:', err);
    }
  };

  // Handle file selection (max 3 images)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Check count limit
    const remainingSlots = 3 - selectedFiles.length;
    if (remainingSlots <= 0) {
      setFormError('Bạn chỉ có thể đính kèm tối đa 3 hình ảnh cho mỗi sự cố.');
      return;
    }

    const validNewFiles: File[] = [];
    const validNewPreviews: string[] = [];

    for (const file of files.slice(0, remainingSlots)) {
      if (!file.type.startsWith('image/')) {
        setFormError(`Tệp "${file.name}" không phải là ảnh hợp lệ.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError(`Tệp "${file.name}" vượt quá dung lượng 5MB cho phép.`);
        continue;
      }
      validNewFiles.push(file);
      validNewPreviews.push(URL.createObjectURL(file));
    }

    if (validNewFiles.length > 0) {
      setFormError(null);
      setSelectedFiles((prev) => [...prev, ...validNewFiles]);
      setFilePreviews((prev) => [...prev, ...validNewPreviews]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Vui lòng nhập tóm tắt sự cố.');
      return;
    }
    if (!description.trim()) {
      setFormError('Vui lòng nhập mô tả chi tiết để kỹ thuật viên chuẩn bị.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const newTicket = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        apartment_id: apartmentId || undefined,
      });

      // Upload any attachments
      for (const file of selectedFiles) {
        try {
          await api.uploadTicketAttachment(newTicket.id, file);
        } catch (uploadErr) {
          console.warn('Failed to upload attachment:', uploadErr);
        }
      }

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedFiles([]);
      setFilePreviews([]);
      setSuccessBanner('Phiếu yêu cầu đã được gửi thành công! Kỹ thuật viên sẽ tiếp nhận sớm nhất.');

      // Refresh list and open it
      await loadMyTickets();
      setActiveTab('list');
      await loadTicketDetail(newTicket.id);

      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: any) {
      setFormError(err.message || 'Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle rating submission
  const handleRatingSubmit = async (ticketId: string) => {
    try {
      setIsRatingSubmitting(true);
      const updated = await api.rateTicket(ticketId, {
        rating: ratingScore,
        feedback: ratingFeedback.trim() || undefined,
      });
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
    } catch (err: any) {
      alert(err.message || 'Không thể lưu đánh giá');
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  // Handle reopen
  const handleReopen = async (ticketId: string) => {
    if (!reopenReason.trim()) {
      alert('Vui lòng cho biết lý do cần xử lý lại');
      return;
    }
    try {
      setIsRatingSubmitting(true);
      const updated = await api.reopenTicket(ticketId, { reason: reopenReason.trim() });
      setSelectedTicket(updated);
      setIsReopening(false);
      setReopenReason('');
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
    } catch (err: any) {
      alert(err.message || 'Không thể mở lại yêu cầu');
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  // Handle comment submit
  const handleSendComment = async (ticketId: string) => {
    if (!commentText.trim()) return;
    try {
      setIsSendingComment(true);
      const newComment = await api.addTicketComment(ticketId, {
        comment: commentText.trim(),
        is_internal: false,
      });
      if (selectedTicket) {
        setSelectedTicket({
          ...selectedTicket,
          comments: [...selectedTicket.comments, newComment],
        });
      }
      setCommentText('');
    } catch (err: any) {
      alert(err.message || 'Không thể gửi bình luận');
    } finally {
      setIsSendingComment(false);
    }
  };

  if (!isOpen) return null;

  const currentCategoryObj = CATEGORIES.find((c) => c.key === selectedCategory) || CATEGORIES[0];

  // Helper for 4-step friendly timeline
  const getTimelineStepIndex = (status: string) => {
    if (status === 'open' || status === 'reopened') return 0; // Đã gửi
    if (status === 'assigned') return 1; // Đã tiếp nhận
    if (status === 'in_progress') return 2; // Đang xử lý
    if (status === 'resolved' || status === 'closed') return 3; // Hoàn thành
    return 0;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(45, 40, 37, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAF7F2',
          border: '1px solid #EFE9DF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(45, 40, 37, 0.15)',
          overflow: 'hidden',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'rgba(217, 107, 67, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(217, 107, 67, 0.25)',
              }}
            >
              <Wrench size={22} color="#D96B43" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: '#2D2825',
                    margin: 0,
                    fontFamily: 'var(--font-display, inherit)',
                  }}
                >
                  Báo Hỏng & Chăm Sóc Căn Hộ
                </h2>
                {apartmentUnit && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(74, 124, 89, 0.12)',
                      color: '#4A7C59',
                    }}
                  >
                    Căn {apartmentUnit}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#736B63', margin: '2px 0 0' }}>
                Gửi sự cố thiết bị trực tiếp đến kỹ thuật viên chuyên trách tòa nhà
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                background: '#F2EDE4',
                padding: '3px',
                borderRadius: '10px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setSelectedTicket(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'create' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'create' ? '#2D2825' : '#736B63',
                  boxShadow: activeTab === 'create' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Gửi Báo Hỏng Mới
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  loadMyTickets();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'list' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'list' ? '#2D2825' : '#736B63',
                  boxShadow: activeTab === 'list' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Yêu Cầu Của Tôi</span>
                {tickets.length > 0 && (
                  <span
                    style={{
                      background: '#D96B43',
                      color: '#FFFFFF',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '1px 6px',
                    }}
                  >
                    {tickets.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                border: '1px solid #E5DFD5',
                background: '#FFFFFF',
                color: '#736B63',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div
            style={{
              padding: '12px 24px',
              background: 'rgba(74, 124, 89, 0.12)',
              borderBottom: '1px solid rgba(74, 124, 89, 0.25)',
              color: '#4A7C59',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Body Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'create' ? (
            /* Tab 1: Create Ticket Form */
            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Category Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#2D2825',
                    marginBottom: '10px',
                  }}
                >
                  1. Chọn loại vấn đề bạn đang gặp phải:
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {CATEGORIES.map((cat) => {
                    const IconComponent = cat.icon;
                    const isSelected = selectedCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCategory(cat.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '14px',
                          borderRadius: '12px',
                          border: isSelected
                            ? `2px solid ${cat.color}`
                            : '1px solid #EFE9DF',
                          background: isSelected ? '#FFFFFF' : '#FAF7F2',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '8px',
                            background: cat.bgColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconComponent size={20} color={cat.color} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: isSelected ? cat.color : '#2D2825',
                            }}
                          >
                            {cat.label}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#736B63', marginTop: '2px' }}>
                            {cat.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Natural SLA notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: 'rgba(217, 107, 67, 0.08)',
                  border: '1px solid rgba(217, 107, 67, 0.2)',
                  fontSize: '0.8rem',
                  color: '#9C4728',
                }}
              >
                <Clock size={16} color="#D96B43" />
                <span>
                  <strong>Thời gian cam kết hỗ trợ:</strong> {currentCategoryObj.estimatedTime} kể từ khi kỹ thuật viên tiếp nhận.
                </span>
              </div>

              {/* Title & Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    htmlFor="ticket-title"
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#2D2825',
                      marginBottom: '6px',
                    }}
                  >
                    2. Tiêu đề sự cố:
                  </label>
                  <input
                    id="ticket-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Vòi nước bồn rửa chén rò rỉ nhẹ, bóng đèn ban công chớp nháy..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E5DFD5',
                      background: '#FFFFFF',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="ticket-desc"
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#2D2825',
                      marginBottom: '6px',
                    }}
                  >
                    3. Chi tiết vị trí và biểu hiện:
                  </label>
                  <textarea
                    id="ticket-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả cụ thể vị trí trong căn hộ, thời điểm bắt đầu xuất hiện sự cố để kỹ thuật viên chuẩn bị đúng dụng cụ và linh kiện thay thế..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E5DFD5',
                      background: '#FFFFFF',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Photo Attachments (Max 3) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825' }}>
                    4. Đính kèm ảnh hiện trường (tối đa 3 ảnh):
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#736B63' }}>
                    {selectedFiles.length}/3 ảnh đã chọn
                  </span>
                </div>

                {/* Upload Thumbnails Row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {filePreviews.map((previewUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: 96,
                        height: 96,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #D5CEBF',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt={`Đính kèm ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(45, 40, 37, 0.75)',
                          color: '#FFFFFF',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Xoá ảnh"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {selectedFiles.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: '10px',
                        border: '2px dashed #D5CEBF',
                        background: '#FAF7F2',
                        color: '#736B63',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Camera size={22} color="#D96B43" />
                      <span>Thêm ảnh</span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {formError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(200, 82, 82, 0.12)',
                    border: '1px solid rgba(200, 82, 82, 0.3)',
                    color: '#C85252',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: '#D96B43',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(217, 107, 67, 0.3)',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Hỗ Trợ'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Tab 2: My Tickets List & Interactive Tracking */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isLoadingList ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#736B63' }}>
                  Đang tải danh sách yêu cầu của bạn...
                </div>
              ) : tickets.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px dashed #E5DFD5',
                  }}
                >
                  <CheckCircle2 size={40} color="#4A7C59" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                    Căn hộ của bạn chưa có sự cố nào!
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#736B63', marginTop: '6px' }}>
                    Nếu gặp bất kỳ vấn đề nào về điện, nước hoặc tiện ích, hãy bấm "Gửi Báo Hỏng Mới".
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    style={{
                      marginTop: '16px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: '#D96B43',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tạo yêu cầu ngay
                  </button>
                </div>
              ) : selectedTicket ? (
                /* Detailed View of Selected Ticket */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Back to List */}
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      color: '#D96B43',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ← Quay lại danh sách yêu cầu
                  </button>

                  {/* Ticket Header Card */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #E5DFD5',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(217, 107, 67, 0.1)',
                              color: '#D96B43',
                            }}
                          >
                            {CATEGORIES.find((c) => c.key === selectedTicket.category)?.label || selectedTicket.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#8C827A' }}>
                            Mã phiếu: #{selectedTicket.id.slice(0, 8)}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                          {selectedTicket.title}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#524B45', marginTop: '6px', lineHeight: 1.5 }}>
                          {selectedTicket.description}
                        </p>
                      </div>

                      {/* Natural SLA Badge */}
                      <div
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: selectedTicket.is_overdue ? 'rgba(200, 82, 82, 0.12)' : 'rgba(184, 115, 25, 0.12)',
                          color: selectedTicket.is_overdue ? '#C85252' : '#B87319',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textAlign: 'right',
                        }}
                      >
                        {selectedTicket.status === 'resolved' || selectedTicket.status === 'closed'
                          ? 'Đã hoàn tất xử lý'
                          : selectedTicket.due_in_human || 'Dự kiến trong hôm nay'}
                      </div>
                    </div>

                    {/* Assigned Technician if available */}
                    {selectedTicket.assigned_technician_name && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: 'rgba(74, 124, 89, 0.08)',
                          border: '1px solid rgba(74, 124, 89, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '0.8rem',
                          color: '#2E5A3B',
                        }}
                      >
                        <User size={16} />
                        <span>
                          Kỹ thuật viên phụ trách: <strong>{selectedTicket.assigned_technician_name}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4-Step Natural Timeline Stepper */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #E5DFD5',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825', marginBottom: '18px' }}>
                      Tiến độ thực hiện:
                    </div>
                    {(() => {
                      const currentStep = getTimelineStepIndex(selectedTicket.status);
                      const steps = [
                        { label: 'Đã gửi', desc: 'Hệ thống đã ghi nhận' },
                        { label: 'Đã tiếp nhận', desc: selectedTicket.assigned_technician_name || 'Phân công kỹ thuật' },
                        { label: 'Đang xử lý', desc: 'Kỹ thuật viên đang khắc phục' },
                        { label: 'Hoàn thành', desc: selectedTicket.resolved_at ? 'Đã giải quyết xong' : 'Chờ nghiệm thu' },
                      ];

                      return (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '12px',
                            position: 'relative',
                          }}
                        >
                          {steps.map((step, idx) => {
                            const isDone = idx <= currentStep;
                            const isCurrent = idx === currentStep;
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  gap: '6px',
                                }}
                              >
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: isDone ? '#4A7C59' : '#E5DFD5',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    border: isCurrent ? '3px solid rgba(74, 124, 89, 0.3)' : 'none',
                                    boxShadow: isDone ? '0 2px 8px rgba(74, 124, 89, 0.3)' : 'none',
                                  }}
                                >
                                  {isDone ? <CheckCircle2 size={18} /> : idx + 1}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.82rem',
                                    fontWeight: isCurrent ? 700 : 600,
                                    color: isDone ? '#2D2825' : '#8C827A',
                                  }}
                                >
                                  {step.label}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#8C827A' }}>{step.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Attachments Preview */}
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <div
                      style={{
                        background: '#FFFFFF',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825', marginBottom: '12px' }}>
                        Ảnh hiện trường ({selectedTicket.attachments.length}):
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {selectedTicket.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #D5CEBF',
                              display: 'block',
                            }}
                          >
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rating & Reopen Section (Only if resolved or closed) */}
                  {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                    <div
                      style={{
                        background: '#FFFFFF',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2D2825', marginBottom: '10px' }}>
                        Đánh giá chất lượng xử lý của kỹ thuật viên
                      </div>

                      {selectedTicket.resident_rating ? (
                        /* Already Rated */
                        <div
                          style={{
                            padding: '14px',
                            borderRadius: '8px',
                            background: 'rgba(74, 124, 89, 0.08)',
                            border: '1px solid rgba(74, 124, 89, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={18}
                                  fill={s <= (selectedTicket.resident_rating || 0) ? '#F59E0B' : 'none'}
                                  color={s <= (selectedTicket.resident_rating || 0) ? '#F59E0B' : '#D1D5DB'}
                                />
                              ))}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#4A7C59', fontWeight: 600 }}>
                              Cảm ơn bạn đã đánh giá ({selectedTicket.resident_rating}/5 sao)!
                            </div>
                            {selectedTicket.resident_feedback && (
                              <div style={{ fontSize: '0.78rem', color: '#524B45', marginTop: '4px' }}>
                                "{selectedTicket.resident_feedback}"
                              </div>
                            )}
                          </div>

                          {/* Reopen button */}
                          <button
                            type="button"
                            onClick={() => setIsReopening(true)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: '#FAF7F2',
                              border: '1px solid #D5CEBF',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: '#C85252',
                              cursor: 'pointer',
                            }}
                          >
                            <RotateCcw size={14} />
                            <span>Chưa hài lòng? Xử lý lại</span>
                          </button>
                        </div>
                      ) : (
                        /* Rating Form */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <p style={{ fontSize: '0.8rem', color: '#736B63', margin: 0 }}>
                            Sự cố đã được kỹ thuật viên báo hoàn tất. Hãy cho chúng tôi biết mức độ hài lòng của bạn:
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setRatingScore(s)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                <Star
                                  size={24}
                                  fill={s <= ratingScore ? '#F59E0B' : 'none'}
                                  color={s <= ratingScore ? '#F59E0B' : '#D1D5DB'}
                                />
                              </button>
                            ))}
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B87319', marginLeft: '6px' }}>
                              {ratingScore === 5
                                ? 'Rất hài lòng'
                                : ratingScore === 4
                                ? 'Hài lòng'
                                : ratingScore === 3
                                ? 'Bình thường'
                                : ratingScore === 2
                                ? 'Chưa tốt'
                                : 'Rất không hài lòng'}
                            </span>
                          </div>

                          <input
                            type="text"
                            value={ratingFeedback}
                            onChange={(e) => setRatingFeedback(e.target.value)}
                            placeholder="Nhận xét thêm về thái độ hoặc kết quả sửa chữa (không bắt buộc)..."
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #E5DFD5',
                              fontSize: '0.82rem',
                            }}
                          />

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRatingSubmit(selectedTicket.id)}
                              disabled={isRatingSubmitting}
                              style={{
                                padding: '8px 18px',
                                borderRadius: '8px',
                                background: '#4A7C59',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Gửi Đánh Giá
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsReopening(true)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                background: '#FAF7F2',
                                border: '1px solid #D5CEBF',
                                fontSize: '0.8rem',
                                color: '#C85252',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              <RotateCcw size={14} />
                              <span>Vẫn còn sự cố? Yêu cầu xử lý lại</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reopen Reason Mini-dialog */}
                      {isReopening && (
                        <div
                          style={{
                            marginTop: '14px',
                            padding: '14px',
                            borderRadius: '8px',
                            background: 'rgba(200, 82, 82, 0.08)',
                            border: '1px solid rgba(200, 82, 82, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#C85252' }}>
                            Lý do yêu cầu xử lý lại:
                          </div>
                          <input
                            type="text"
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            placeholder="Ví dụ: Vòi nước vẫn rỉ nước sau khi thợ về, đèn lại bị chớp..."
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #D5CEBF',
                              fontSize: '0.82rem',
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => setIsReopening(false)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#FFFFFF',
                                border: '1px solid #D5CEBF',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                              }}
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReopen(selectedTicket.id)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                background: '#C85252',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Xác nhận Reopen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments Thread (Resident & Technician) */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #E5DFD5',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825', marginBottom: '12px' }}>
                      Trao đổi với kỹ thuật viên ({selectedTicket.comments?.length || 0}):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                      {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                        selectedTicket.comments.map((cm) => (
                          <div
                            key={cm.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: '#FAF7F2',
                              border: '1px solid #EFE9DF',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D2825' }}>
                                {cm.author_name || 'Kỹ thuật viên'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#8C827A' }}>
                                {new Date(cm.created_at).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#453E38', lineHeight: 1.4 }}>
                              {cm.comment}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#8C827A', fontStyle: 'italic' }}>
                          Chưa có tin nhắn nào. Bạn có thể gửi thêm chi tiết cho kỹ thuật viên tại đây.
                        </div>
                      )}
                    </div>

                    {/* Add Comment Input */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendComment(selectedTicket.id);
                          }
                        }}
                        placeholder="Nhắn tin cho kỹ thuật viên (ví dụ: Mình có ở nhà sau 17h)..."
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #E5DFD5',
                          fontSize: '0.82rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(selectedTicket.id)}
                        disabled={isSendingComment || !commentText.trim()}
                        style={{
                          padding: '0 16px',
                          borderRadius: '8px',
                          background: '#D96B43',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: isSendingComment || !commentText.trim() ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Send size={14} />
                        <span>Gửi</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tickets List View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tickets.map((t) => {
                    const cat = CATEGORIES.find((c) => c.key === t.category) || CATEGORIES[0];
                    const IconComponent = cat.icon;
                    return (
                      <div
                        key={t.id}
                        onClick={() => loadTicketDetail(t.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px',
                          background: '#FFFFFF',
                          borderRadius: '12px',
                          border: '1px solid #E5DFD5',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#D96B43';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 107, 67, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#E5DFD5';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '10px',
                              background: cat.bgColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconComponent size={20} color={cat.color} />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                                {t.title}
                              </h4>
                              {t.source === 'ai_anomaly' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(6, 182, 212, 0.12)',
                                    color: '#0891B2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Sparkles size={11} />
                                  <span>AI Tự Động Báo</span>
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: '#736B63',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <span>{cat.label}</span>
                              <span>•</span>
                              <span>
                                {new Date(t.created_at).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </span>
                              {t.assigned_technician_name && (
                                <>
                                  <span>•</span>
                                  <span>KTV: {t.assigned_technician_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Status Badge */}
                          <div
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background:
                                t.status === 'resolved' || t.status === 'closed'
                                  ? 'rgba(74, 124, 89, 0.12)'
                                  : t.status === 'in_progress'
                                  ? 'rgba(217, 107, 67, 0.12)'
                                  : 'rgba(184, 115, 25, 0.12)',
                              color:
                                t.status === 'resolved' || t.status === 'closed'
                                  ? '#4A7C59'
                                  : t.status === 'in_progress'
                                  ? '#D96B43'
                                  : '#B87319',
                            }}
                          >
                            {t.status === 'open'
                              ? 'Chờ tiếp nhận'
                              : t.status === 'assigned'
                              ? 'Đã phân công'
                              : t.status === 'in_progress'
                              ? 'Đang xử lý'
                              : t.status === 'reopened'
                              ? 'Yêu cầu lại'
                              : 'Đã hoàn tất'}
                          </div>

                          <ChevronRight size={18} color="#A39A90" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
