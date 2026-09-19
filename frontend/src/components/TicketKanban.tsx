import React, { useEffect, useState } from 'react';
import {
  Kanban,
  Zap,
  Droplet,
  Wind,
  ArrowUpDown,
  Shield,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Search,
  X,
  Sparkles,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Ticket,
  TicketDetail,
  TicketStatus,
  Technician,
  SlaReport,
} from '../types';

interface TicketKanbanProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.FC<{ size?: number; color?: string }>; color: string; bg: string }
> = {
  electrical: { label: 'Điện', icon: Zap, color: '#D96B43', bg: 'rgba(217, 107, 67, 0.12)' },
  plumbing: { label: 'Nước', icon: Droplet, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  hvac: { label: 'Điều hòa', icon: Wind, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  elevator: { label: 'Thang máy', icon: ArrowUpDown, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  security: { label: 'An ninh', icon: Shield, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  other: { label: 'Khác', icon: HelpCircle, color: '#B87319', bg: 'rgba(184, 115, 25, 0.12)' },
};

const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Khẩn cấp', color: '#C85252', bg: 'rgba(200, 82, 82, 0.12)' },
  high: { label: 'Ưu tiên cao', color: '#D96B43', bg: 'rgba(217, 107, 67, 0.12)' },
  medium: { label: 'Trung bình', color: '#B87319', bg: 'rgba(184, 115, 25, 0.12)' },
  low: { label: 'Bình thường', color: '#4A7C59', bg: 'rgba(74, 124, 89, 0.12)' },
};

const COLUMNS: {
  id: string;
  title: string;
  statuses: TicketStatus[];
  dropStatus: TicketStatus;
  accent: string;
}[] = [
  {
    id: 'col_open',
    title: 'Mới Tiếp Nhận',
    statuses: ['open', 'reopened'],
    dropStatus: 'open',
    accent: '#B87319',
  },
  {
    id: 'col_assigned',
    title: 'Đã Điều Phối',
    statuses: ['assigned'],
    dropStatus: 'assigned',
    accent: '#06B6D4',
  },
  {
    id: 'col_in_progress',
    title: 'Đang Xử Lý',
    statuses: ['in_progress'],
    dropStatus: 'in_progress',
    accent: '#D96B43',
  },
  {
    id: 'col_resolved',
    title: 'Đã Giải Quyết',
    statuses: ['resolved', 'closed'],
    dropStatus: 'resolved',
    accent: '#4A7C59',
  },
];

export const TicketKanban: React.FC<TicketKanbanProps> = ({ isOpen = true, onClose, asPage = false }) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'sla_report'>('kanban');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterTechnician, setFilterTechnician] = useState<string>('all');

  // Drag-and-drop state
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Assign modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [assignNote, setAssignNote] = useState('');

  // Comment state inside detail modal
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);

  // SLA Report state
  const [slaMonth, setSlaMonth] = useState<string>('2026-09');
  const [slaReport, setSlaReport] = useState<SlaReport | null>(null);
  const [isLoadingSla, setIsLoadingSla] = useState(false);

  // Load tickets and technicians
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [ticketRes, techRes] = await Promise.all([
        api.getTickets({
          page_size: 100,
          category: filterCategory !== 'all' ? filterCategory : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined,
          overdue_only: filterOverdueOnly || undefined,
          search: searchQuery.trim() || undefined,
        }),
        api.getTechnicians(),
      ]);
      setTickets(ticketRes.items || []);
      setTechnicians(techRes || []);
    } catch (err: any) {
      console.error('Failed to load tickets/technicians:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadData();
    }
  }, [isOpen, asPage, filterCategory, filterPriority, filterOverdueOnly]);

  if (!isOpen && !asPage) return null;

  // Load SLA report
  const loadSlaReport = async () => {
    try {
      setIsLoadingSla(true);
      const report = await api.getTicketSlaReport(slaMonth);
      setSlaReport(report);
    } catch (err: any) {
      console.error('Failed to load SLA report:', err);
    } finally {
      setIsLoadingSla(false);
    }
  };

  useEffect(() => {
    if (isOpen && viewMode === 'sla_report') {
      loadSlaReport();
    }
  }, [isOpen, viewMode, slaMonth]);

  // Open detail modal
  const openTicketDetail = async (id: string) => {
    try {
      const detail = await api.getTicketDetail(id);
      setSelectedTicket(detail);
    } catch (err: any) {
      console.error('Failed to load ticket detail:', err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData('text/plain', ticketId);
    setDraggedTicketId(ticketId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TicketStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const ticketId = e.dataTransfer.getData('text/plain') || draggedTicketId;
    if (!ticketId) return;

    const targetTicket = tickets.find((t) => t.id === ticketId);
    if (!targetTicket) return;

    // Check if transition is valid according to state machine
    try {
      if (targetStatus === 'assigned' && !targetTicket.assigned_to) {
        // Prompt assign modal instead
        setAssigningTicketId(ticketId);
        setIsAssignModalOpen(true);
        return;
      }

      const updated = await api.updateTicketStatus(ticketId, {
        status: targetStatus,
        note: `Kéo thả cập nhật trạng thái trên Kanban sang ${targetStatus}`,
      });

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Không thể chuyển trạng thái này (vi phạm quy trình xử lý).');
    } finally {
      setDraggedTicketId(null);
    }
  };

  // Handle Technician Assign
  const handleAssignSubmit = async () => {
    if (!assigningTicketId || !selectedTechId) {
      alert('Vui lòng chọn một kỹ thuật viên');
      return;
    }
    try {
      const updated = await api.assignTicket(assigningTicketId, {
        technician_id: selectedTechId,
        note: assignNote.trim() || undefined,
      });
      setTickets((prev) => prev.map((t) => (t.id === assigningTicketId ? updated : t)));
      if (selectedTicket?.id === assigningTicketId) {
        setSelectedTicket(updated);
      }
      setIsAssignModalOpen(false);
      setAssigningTicketId(null);
      setSelectedTechId('');
      setAssignNote('');
    } catch (err: any) {
      alert(err.message || 'Gán kỹ thuật viên thất bại');
    }
  };

  // Handle Detail Status Change Button
  const handleDetailStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;
    try {
      const updated = await api.updateTicketStatus(selectedTicket.id, {
        status: newStatus,
        note: `Cập nhật trực tiếp từ bảng điều khiển`,
      });
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
    } catch (err: any) {
      alert(err.message || 'Chuyển trạng thái thất bại');
    }
  };

  // Add Comment (Internal or Public)
  const handleAddComment = async () => {
    if (!selectedTicket || !commentText.trim()) return;
    try {
      setIsSendingComment(true);
      const newComment = await api.addTicketComment(selectedTicket.id, {
        comment: commentText.trim(),
        is_internal: isInternalNote,
      });
      setSelectedTicket({
        ...selectedTicket,
        comments: [...selectedTicket.comments, newComment],
      });
      setCommentText('');
    } catch (err: any) {
      alert(err.message || 'Không thể thêm bình luận');
    } finally {
      setIsSendingComment(false);
    }
  };

  if (!isOpen && !asPage) return null;

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    if (filterTechnician !== 'all' && t.assigned_to !== filterTechnician) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchUnit = t.apartment_unit?.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      if (!matchTitle && !matchUnit && !matchId) return false;
    }
    return true;
  });

  const content = (
    <div
      className="page-view-container animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '1280px',
        height: asPage ? 'calc(100vh - 160px)' : '92vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAF7F2',
        border: '1px solid #EFE9DF',
        borderRadius: '16px',
        boxShadow: asPage ? '0 2px 12px rgba(45, 40, 37, 0.05)' : '0 25px 50px -12px rgba(45, 40, 37, 0.2)',
        overflow: 'hidden',
      }}
    >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #EFE9DF',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                background: 'rgba(217, 107, 67, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(217, 107, 67, 0.25)',
              }}
            >
              <Kanban size={22} color="#D96B43" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#2D2825',
                    margin: 0,
                    fontFamily: 'var(--font-display, inherit)',
                  }}
                >
                  Điều Phối Phiếu Công Việc (Work Orders)
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(217, 107, 67, 0.12)',
                    color: '#D96B43',
                  }}
                >
                  {filteredTickets.length} phiếu
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#736B63', margin: '2px 0 0' }}>
                Đóng vòng lặp: Tiếp nhận sự cố & Anomaly AI → Phân công kỹ thuật viên → Theo dõi SLA
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View Mode Switch */}
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
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'kanban' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'kanban' ? '#2D2825' : '#736B63',
                  boxShadow: viewMode === 'kanban' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Kanban size={15} />
                <span>Bảng Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sla_report')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'sla_report' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'sla_report' ? '#2D2825' : '#736B63',
                  boxShadow: viewMode === 'sla_report' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <BarChart3 size={15} />
                <span>Báo Cáo SLA</span>
              </button>
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                border: '1px solid #E5DFD5',
                background: '#FFFFFF',
                color: '#736B63',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Làm mới"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {!asPage && onClose && (
              <button
                onClick={onClose}
                style={{
                  width: 36,
                  height: 36,
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
            )}
          </div>
        </div>

        {/* Filter Toolbar (Only in Kanban view) */}
        {viewMode === 'kanban' && (
          <div
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid #EFE9DF',
              background: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              <Search
                size={16}
                color="#8C827A"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tiêu đề, căn hộ, mã phiếu..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 34px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  background: '#FFFFFF',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  background: '#FFFFFF',
                  fontSize: '0.8rem',
                  color: '#2D2825',
                }}
              >
                <option value="all">Tất cả danh mục</option>
                <option value="electrical">Điện</option>
                <option value="plumbing">Nước</option>
                <option value="hvac">Điều hòa</option>
                <option value="elevator">Thang máy</option>
                <option value="security">An ninh</option>
                <option value="other">Khác</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  background: '#FFFFFF',
                  fontSize: '0.8rem',
                  color: '#2D2825',
                }}
              >
                <option value="all">Tất cả mức ưu tiên</option>
                <option value="critical">Khẩn cấp</option>
                <option value="high">Ưu tiên cao</option>
                <option value="medium">Trung bình</option>
                <option value="low">Bình thường</option>
              </select>

              {/* Technician Filter */}
              <select
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  background: '#FFFFFF',
                  fontSize: '0.8rem',
                  color: '#2D2825',
                }}
              >
                <option value="all">Tất cả kỹ thuật viên</option>
                {technicians.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.full_name || tc.email} ({tc.open_ticket_count} việc)
                  </option>
                ))}
              </select>

              {/* Overdue Only Toggle */}
              <button
                type="button"
                onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: filterOverdueOnly ? '1px solid #D96B43' : '1px solid #E5DFD5',
                  background: filterOverdueOnly ? 'rgba(217, 107, 67, 0.12)' : '#FFFFFF',
                  color: filterOverdueOnly ? '#D96B43' : '#736B63',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} color={filterOverdueOnly ? '#D96B43' : '#8C827A'} />
                <span>Chỉ xem quá hạn SLA</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 24px', display: 'flex' }}>
          {viewMode === 'kanban' ? (
            /* Kanban Board Columns */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                width: '100%',
                height: '100%',
              }}
            >
              {COLUMNS.map((col) => {
                const colTickets = filteredTickets.filter((t) => col.statuses.includes(t.status));
                const isOver = dragOverCol === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.dropStatus)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: isOver ? 'rgba(217, 107, 67, 0.05)' : '#F2EDE4',
                      borderRadius: '12px',
                      border: isOver ? `2px dashed ${col.accent}` : '1px solid #E5DFD5',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Column Header */}
                    <div
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #E5DFD5',
                        background: '#FAF7F2',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: col.accent,
                          }}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2D2825' }}>
                          {col.title}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#E5DFD5',
                          color: '#524B45',
                        }}
                      >
                        {colTickets.length}
                      </span>
                    </div>

                    {/* Column Ticket Cards Container */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {colTickets.map((ticket) => {
                        const cat = CATEGORY_META[ticket.category] || CATEGORY_META.other;
                        const pri = PRIORITY_META[ticket.priority] || PRIORITY_META.medium;
                        const CatIcon = cat.icon;

                        return (
                          <div
                            key={ticket.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, ticket.id)}
                            onClick={() => openTicketDetail(ticket.id)}
                            style={{
                              padding: '12px 14px',
                              background: '#FFFFFF',
                              borderRadius: '10px',
                              border: ticket.is_overdue
                                ? '1.5px solid #D96B43'
                                : '1px solid #E5DFD5',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                              cursor: 'grab',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Badges Row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: cat.bg,
                                    color: cat.color,
                                  }}
                                >
                                  <CatIcon size={12} />
                                  <span>{cat.label}</span>
                                </span>

                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: pri.bg,
                                    color: pri.color,
                                  }}
                                >
                                  {pri.label}
                                </span>
                              </div>

                              {/* Source badge */}
                              {ticket.source === 'ai_anomaly' ? (
                                <span
                                  title="Phát hiện bởi AI Anomaly"
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(6, 182, 212, 0.12)',
                                    color: '#0891B2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Sparkles size={11} />
                                  <span>AI</span>
                                </span>
                              ) : (
                                <span
                                  title="Cư dân báo sự cố"
                                  style={{
                                    fontSize: '0.68rem',
                                    color: '#8C827A',
                                  }}
                                >
                                  Căn {ticket.apartment_unit || '—'}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <div
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                color: '#2D2825',
                                lineHeight: 1.3,
                              }}
                            >
                              {ticket.title}
                            </div>

                            {/* SLA status */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                color: ticket.is_overdue ? '#D96B43' : '#B87319',
                                background: ticket.is_overdue ? 'rgba(217, 107, 67, 0.08)' : 'rgba(184, 115, 25, 0.08)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              <Clock size={12} />
                              <span>{ticket.due_in_human || 'Hôm nay'}</span>
                            </div>

                            {/* Footer info: technician & action */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: '4px',
                                borderTop: '1px dashed #EFE9DF',
                                fontSize: '0.72rem',
                                color: '#736B63',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <User size={12} />
                                <span>{ticket.assigned_technician_name || 'Chưa gán'}</span>
                              </div>

                              {!ticket.assigned_to && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssigningTicketId(ticket.id);
                                    setIsAssignModalOpen(true);
                                  }}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: '#D96B43',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Phân công
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* SLA Report Tab */
            <div
              style={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Report Filter Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5DFD5',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                    Thống Kê SLA & Thời Gian Xử Lý Trung Bình (MTTR)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#736B63', margin: '3px 0 0' }}>
                    Đo lường thời gian từ lúc tạo phiếu đến khi hoàn tất xử lý theo từng loại sự cố
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="sla-month-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#524B45' }}>
                    Kỳ báo cáo:
                  </label>
                  <input
                    id="sla-month-input"
                    type="month"
                    value={slaMonth}
                    onChange={(e) => setSlaMonth(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E5DFD5',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              {isLoadingSla ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#736B63' }}>
                  Đang tính toán số liệu SLA...
                </div>
              ) : slaReport ? (
                <>
                  {/* KPI Summary Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '14px',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#736B63' }}>Tổng Phiếu Ghi Nhận</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2D2825', marginTop: '4px' }}>
                        {slaReport.total_tickets}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#4A7C59', marginTop: '2px' }}>
                        Đã xử lý xong: {slaReport.total_resolved}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#736B63' }}>Tỷ Lệ Đạt Cam Kết SLA</div>
                      <div
                        style={{
                          fontSize: '1.6rem',
                          fontWeight: 800,
                          color: slaReport.overall_compliance_rate_percent >= 90 ? '#4A7C59' : '#D96B43',
                          marginTop: '4px',
                        }}
                      >
                        {slaReport.overall_compliance_rate_percent}%
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#736B63', marginTop: '2px' }}>
                        Mục tiêu tiêu chuẩn: &gt; 95%
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#736B63' }}>Thời Gian Xử Lý TB (MTTR)</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2D2825', marginTop: '4px' }}>
                        {slaReport.overall_avg_resolution_hours} <span style={{ fontSize: '0.9rem' }}>giờ</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#736B63', marginTop: '2px' }}>
                        Tính trên các phiếu đã giải quyết
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#736B63' }}>Trạng Thái Tổng Thể</div>
                      <div
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: '#4A7C59',
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle2 size={18} />
                        <span>Vận Hành Tốt</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#736B63', marginTop: '4px' }}>
                        Đội ngũ kỹ thuật đáp ứng nhanh
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown Table */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5DFD5',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5DFD5' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                        Chi Tiết Theo Từng Loại Sự Cố
                      </h4>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E5DFD5', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>Danh mục</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>Tổng phiếu</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>Đã xong</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>SLA Mục tiêu</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>MTTR Thực tế</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>Tỷ lệ đạt SLA</th>
                          <th style={{ padding: '12px 16px', color: '#736B63', fontWeight: 600 }}>Trễ hạn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slaReport.categories.map((row) => (
                          <tr key={row.category} style={{ borderBottom: '1px solid #EFE9DF' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2D2825' }}>
                              {row.category_name}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#524B45' }}>{row.total_tickets}</td>
                            <td style={{ padding: '12px 16px', color: '#4A7C59', fontWeight: 600 }}>
                              {row.resolved_tickets}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#736B63' }}>{row.sla_target_hours} giờ</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2D2825' }}>
                              {row.avg_resolution_hours} giờ
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    width: 60,
                                    height: 6,
                                    borderRadius: 3,
                                    background: '#E5DFD5',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.min(row.sla_compliance_rate_percent, 100)}%`,
                                      height: '100%',
                                      background:
                                        row.sla_compliance_rate_percent >= 90 ? '#4A7C59' : '#D96B43',
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color:
                                      row.sla_compliance_rate_percent >= 90 ? '#4A7C59' : '#D96B43',
                                  }}
                                >
                                  {row.sla_compliance_rate_percent}%
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {row.overdue_tickets > 0 ? (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(217, 107, 67, 0.12)',
                                    color: '#D96B43',
                                    fontWeight: 700,
                                  }}
                                >
                                  {row.overdue_tickets} phiếu
                                </span>
                              ) : (
                                <span style={{ color: '#4A7C59' }}>0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

      {/* Technician Assignment Modal */}
      {isAssignModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                Phân Công Kỹ Thuật Viên
              </h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label htmlFor="tech-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#524B45', display: 'block', marginBottom: '6px' }}>
                Chọn kỹ thuật viên phụ trách:
              </label>
              <select
                id="tech-select"
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">-- Chọn kỹ thuật viên --</option>
                {technicians.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.full_name || tc.email} — Chuyên môn: {tc.specialties.join(', ')} ({tc.open_ticket_count} việc đang xử lý)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="assign-note" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#524B45', display: 'block', marginBottom: '6px' }}>
                Ghi chú điều phối (tùy chọn):
              </label>
              <input
                id="assign-note"
                type="text"
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Ví dụ: Ưu tiên xử lý trước giờ tan tầm..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#FAF7F2',
                  border: '1px solid #D5CEBF',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#D96B43',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Phân Công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detailed Modal */}
      {selectedTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5DFD5',
              boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E5DFD5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                background: '#FAF7F2',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(217, 107, 67, 0.12)',
                      color: '#D96B43',
                    }}
                  >
                    #{selectedTicket.id.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#736B63' }}>
                    {selectedTicket.apartment_unit ? `Căn ${selectedTicket.apartment_unit}` : 'Khu vực chung'}
                  </span>
                  {selectedTicket.source === 'ai_anomaly' && (
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
                      <span>AI Anomaly Ingestion</span>
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2825', margin: 0 }}>
                  {selectedTicket.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  border: '1px solid #E5DFD5',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Description & AI Snapshot */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#FAF7F2',
                  border: '1px solid #EFE9DF',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: '#2D2825',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#736B63', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Nội dung phản ánh & Dữ liệu snapshot:
                </div>
                {selectedTicket.description}
              </div>

              {/* State Machine Transition Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(74, 124, 89, 0.08)',
                  border: '1px solid rgba(74, 124, 89, 0.2)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#2E5A3B' }}>
                  Trạng thái hiện tại: <strong>{selectedTicket.status.toUpperCase()}</strong>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedTicket.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningTicketId(selectedTicket.id);
                        setIsAssignModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Phân công KTV
                    </button>
                  )}

                  {selectedTicket.status === 'assigned' && (
                    <button
                      type="button"
                      onClick={() => handleDetailStatusChange('in_progress')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#D96B43',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Bắt đầu xử lý
                    </button>
                  )}

                  {selectedTicket.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => handleDetailStatusChange('resolved')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#4A7C59',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã giải quyết (Resolved)
                    </button>
                  )}

                  {selectedTicket.status === 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleDetailStatusChange('closed')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#736B63',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đóng phiếu (Closed)
                    </button>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#524B45', marginBottom: '8px' }}>
                    Ảnh đính kèm ({selectedTicket.attachments.length}):
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {selectedTicket.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #D5CEBF',
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

              {/* Comments & Internal Notes */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#524B45', marginBottom: '10px' }}>
                  Trao đổi & Ghi chú nội bộ:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {selectedTicket.comments?.map((cm) => (
                    <div
                      key={cm.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: cm.is_internal ? 'rgba(184, 115, 25, 0.08)' : '#FAF7F2',
                        border: cm.is_internal ? '1px solid rgba(184, 115, 25, 0.25)' : '1px solid #EFE9DF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: cm.is_internal ? '#B87319' : '#2D2825' }}>
                          {cm.author_name || 'Hệ thống'} {cm.is_internal && '(Ghi chú nội bộ)'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#8C827A' }}>
                          {new Date(cm.created_at).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#2D2825' }}>{cm.comment}</div>
                    </div>
                  ))}
                </div>

                {/* Add Comment Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      placeholder={isInternalNote ? 'Nhập ghi chú nội bộ (chỉ KTV thấy)...' : 'Nhắn tin công khai cho cư dân...'}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E5DFD5',
                        fontSize: '0.82rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={isSendingComment || !commentText.trim()}
                      style={{
                        padding: '0 16px',
                        borderRadius: '8px',
                        background: '#D96B43',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: isSendingComment || !commentText.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Gửi
                    </button>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.76rem',
                      color: '#736B63',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                    />
                    <span>Ghi chú nội bộ (cư dân không nhìn thấy)</span>
                  </label>
                </div>
              </div>

              {/* Append-Only Status History Audit Trail */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#524B45', marginBottom: '8px' }}>
                  Nhật ký thay đổi trạng thái (Append-only Audit Trail):
                </div>
                <div style={{ border: '1px solid #E5DFD5', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                    <thead>
                      <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E5DFD5', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', color: '#736B63' }}>Thời gian</th>
                        <th style={{ padding: '8px 10px', color: '#736B63' }}>Chuyển đổi</th>
                        <th style={{ padding: '8px 10px', color: '#736B63' }}>Người thực hiện</th>
                        <th style={{ padding: '8px 10px', color: '#736B63' }}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTicket.status_history?.map((h) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid #EFE9DF' }}>
                          <td style={{ padding: '8px 10px', color: '#736B63' }}>
                            {new Date(h.changed_at).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {h.from_status} → {h.to_status}
                          </td>
                          <td style={{ padding: '8px 10px' }}>{h.changed_by_name || 'Hệ thống'}</td>
                          <td style={{ padding: '8px 10px', color: '#524B45' }}>{h.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(45, 40, 37, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      {content}
    </div>
  );
};
