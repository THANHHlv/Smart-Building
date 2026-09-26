import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit2,
  Filter,
  Home,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  Star,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  AdminCreateResidentPayload,
  AdminResidentItem,
  AdminUpdateResidentPayload,
  Building,
} from '../types';

interface AdminResidentManagerProps {
  asPage?: boolean;
  onResidentChanged?: () => void;
}

export const AdminResidentManager: React.FC<AdminResidentManagerProps> = ({
  onResidentChanged,
}) => {
  const [residents, setResidents] = useState<AdminResidentItem[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Filters
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoveOutModalOpen, setIsMoveOutModalOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<AdminResidentItem | null>(null);

  // Add resident form state
  const [addApartmentId, setAddApartmentId] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRelationship, setAddRelationship] = useState<'owner' | 'tenant' | 'family_member' | 'other'>('tenant');
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  // Edit resident form state
  const [editRelationship, setEditRelationship] = useState<'owner' | 'tenant' | 'family_member' | 'other'>('tenant');
  const [editIsPrimary, setEditIsPrimary] = useState(false);

  // Notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load buildings & residents
  const loadData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [resList, bldgs] = await Promise.all([
        api.getAdminResidents({
          building_id: selectedBuildingId || undefined,
          status: selectedStatus || undefined,
          search: searchTerm || undefined,
        }),
        api.getBuildings().catch(() => ({ items: [] as Building[] })),
      ]);
      setResidents(resList);
      setBuildings(bldgs.items || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể tải danh sách cư dân' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBuildingId, selectedStatus]);

  // Handle Search Debounce / Trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Add resident submit
  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addApartmentId.trim() || (!addEmail.trim() && !addFullName.trim())) {
      setFeedback({ type: 'error', message: 'Vui lòng điền mã căn hộ và thông tin cư dân' });
      return;
    }

    setIsActionLoading(true);
    try {
      const payload: AdminCreateResidentPayload = {
        apartment_id: addApartmentId.trim(),
        email: addEmail.trim() || undefined,
        full_name: addFullName.trim() || undefined,
        phone: addPhone.trim() || undefined,
        relationship: addRelationship,
        is_primary_contact: addIsPrimary,
      };
      await api.createAdminResident(payload);
      setFeedback({ type: 'success', message: 'Thêm cư dân vào căn hộ thành công!' });
      setIsAddModalOpen(false);
      resetAddForm();
      loadData();
      onResidentChanged?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Thêm cư dân thất bại' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const resetAddForm = () => {
    setAddApartmentId('');
    setAddEmail('');
    setAddFullName('');
    setAddPhone('');
    setAddRelationship('tenant');
    setAddIsPrimary(false);
  };

  // Open Edit Modal
  const openEditModal = (resident: AdminResidentItem) => {
    setSelectedResident(resident);
    setEditRelationship(resident.relationship);
    setEditIsPrimary(resident.is_primary_contact);
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;
    setIsActionLoading(true);
    try {
      const payload: AdminUpdateResidentPayload = {
        relationship: editRelationship,
        is_primary_contact: editIsPrimary,
      };
      await api.updateAdminResident(selectedResident.id, payload);
      setFeedback({ type: 'success', message: 'Cập nhật thông tin cư dân thành công!' });
      setIsEditModalOpen(false);
      loadData();
      onResidentChanged?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Cập nhật thất bại' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Open Move Out Confirmation Modal
  const openMoveOutModal = (resident: AdminResidentItem) => {
    setSelectedResident(resident);
    setIsMoveOutModalOpen(true);
  };

  // Confirm Move Out (Soft delete)
  const handleConfirmMoveOut = async () => {
    if (!selectedResident) return;
    setIsActionLoading(true);
    try {
      await api.deleteAdminResident(selectedResident.id);
      setFeedback({
        type: 'success',
        message: `Đã đánh dấu cư dân ${selectedResident.resident_name} chuyển đi (lịch sử hóa đơn vẫn được lưu giữ an toàn)`,
      });
      setIsMoveOutModalOpen(false);
      loadData();
      onResidentChanged?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Thao tác thất bại' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Stats calculation
  const totalActive = useMemo(() => residents.filter((r) => r.status === 'active').length, [residents]);
  const totalMovedOut = useMemo(() => residents.filter((r) => r.status === 'moved_out').length, [residents]);

  return (
    <div
      className="oasis-page-container"
      style={{
        padding: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                letterSpacing: '0.04em',
              }}
            >
              RESIDENT MANAGEMENT
            </span>
            <span style={{ fontSize: '0.75rem', color: '#8E867E' }}>•</span>
            <span style={{ fontSize: '0.78rem', color: '#6F6861' }}>Quản lý cư trú & phân bổ căn hộ</span>
          </div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              color: '#2D2825',
              margin: '6px 0 0 0',
              fontFamily: 'var(--font-display)',
            }}
          >
            Danh Sách Cư Dân Tòa Nhà
          </h1>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={loadData}
            className="btn btn-ghost"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #EFE9DF',
              backgroundColor: '#FFFFFF',
              color: '#6F6861',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              backgroundColor: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(217, 107, 67, 0.25)',
            }}
          >
            <UserPlus size={16} />
            <span>Thêm Cư Dân Mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '16px 20px',
            border: '1px solid #EFE9DF',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(74, 124, 89, 0.12)',
              color: '#4A7C59',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6F6861', fontWeight: 500 }}>Đang Cư Trú (Active)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>
              {totalActive}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '16px 20px',
            border: '1px solid #EFE9DF',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#F3EEE5',
              color: '#6F6861',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6F6861', fontWeight: 500 }}>Đã Chuyển Đi (Moved Out)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>
              {totalMovedOut}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '16px 20px',
            border: '1px solid #EFE9DF',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(217, 107, 67, 0.12)',
              color: '#D96B43',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Star size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6F6861', fontWeight: 500 }}>Đại Diện Liên Hệ Chính</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>
              {residents.filter((r) => r.is_primary_contact && r.status === 'active').length}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: feedback.type === 'success' ? 'rgba(74, 124, 89, 0.12)' : 'rgba(200, 82, 82, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(74, 124, 89, 0.25)' : 'rgba(200, 82, 82, 0.25)'}`,
            color: feedback.type === 'success' ? '#4A7C59' : '#C85252',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid #EFE9DF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Building filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} color="#6F6861" />
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #EFE9DF',
                backgroundColor: '#FBF9F5',
                fontSize: '0.84rem',
                color: '#2D2825',
              }}
            >
              <option value="">Tất cả tòa nhà</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} color="#6F6861" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #EFE9DF',
                backgroundColor: '#FBF9F5',
                fontSize: '0.84rem',
                color: '#2D2825',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang cư trú (Active)</option>
              <option value="moved_out">Đã chuyển đi (Moved Out)</option>
            </select>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '240px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8E867E' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên, email, số điện thoại hoặc căn hộ..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '8px',
                  border: '1px solid #EFE9DF',
                  backgroundColor: '#FBF9F5',
                  fontSize: '0.84rem',
                  color: '#2D2825',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#F3EEE5',
                color: '#2D2825',
                border: '1px solid #EFE9DF',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tìm
            </button>
          </form>
        </div>
      </div>

      {/* Residents Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9DF',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#FBF9F5', borderBottom: '1px solid #EFE9DF', color: '#6F6861' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Căn Hộ</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Cư Dân</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Số Điện Thoại</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Quan Hệ</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Ngày Dọn Vào</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Trạng Thái</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#8E867E' }}>
                    <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 8px auto', color: '#D96B43' }} />
                    <div>Đang tải dữ liệu cư dân...</div>
                  </td>
                </tr>
              ) : residents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#8E867E' }}>
                    <Users size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                    <div>Không tìm thấy cư dân nào phù hợp với bộ lọc.</div>
                  </td>
                </tr>
              ) : (
                residents.map((res) => {
                  const isActive = res.status === 'active';
                  return (
                    <tr
                      key={res.id}
                      style={{
                        borderBottom: '1px solid #F3EEE5',
                        transition: 'background 0.15s',
                        backgroundColor: !isActive ? 'rgba(243, 238, 229, 0.3)' : 'transparent',
                      }}
                    >
                      {/* Apartment & Building */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: res.is_primary_contact ? 'rgba(217, 107, 67, 0.12)' : '#F3EEE5',
                              color: res.is_primary_contact ? '#D96B43' : '#6F6861',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Home size={16} />
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: '#2D2825' }}>Căn {res.unit_number}</span>
                            <div style={{ fontSize: '0.74rem', color: '#8E867E' }}>
                              {res.building_name} • Tầng {res.floor_number}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Resident Info & Avatar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              backgroundColor: '#F3EEE5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: '#D96B43',
                              fontSize: '0.85rem',
                              flexShrink: 0,
                            }}
                          >
                            {res.avatar_url ? (
                              <img src={res.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              res.resident_name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: '#2D2825' }}>{res.resident_name}</span>
                              {res.is_primary_contact && (
                                <span
                                  title="Người nhận thông báo chính của căn hộ"
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(217, 107, 67, 0.14)',
                                    color: '#D96B43',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <Star size={10} fill="#D96B43" />
                                  Chính
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#8E867E' }}>{res.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 18px', color: '#2D2825' }}>
                        {res.phone || <span style={{ color: '#8E867E', fontStyle: 'italic' }}>Chưa có</span>}
                      </td>

                      {/* Relationship */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '8px',
                            backgroundColor:
                              res.relationship === 'owner'
                                ? 'rgba(74, 124, 89, 0.12)'
                                : 'rgba(67, 122, 130, 0.12)',
                            color: res.relationship === 'owner' ? '#4A7C59' : '#437A82',
                          }}
                        >
                          {res.relationship === 'owner'
                            ? 'Chủ Hộ'
                            : res.relationship === 'tenant'
                            ? 'Người Thuê'
                            : res.relationship === 'family_member'
                            ? 'Người Thân'
                            : 'Khác'}
                        </span>
                      </td>

                      {/* Moved In At */}
                      <td style={{ padding: '14px 18px', color: '#6F6861', fontSize: '0.78rem' }}>
                        {res.moved_in_at ? new Date(res.moved_in_at).toLocaleDateString('vi-VN') : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '8px',
                            backgroundColor: isActive ? 'rgba(74, 124, 89, 0.12)' : 'rgba(142, 134, 126, 0.15)',
                            color: isActive ? '#4A7C59' : '#8E867E',
                          }}
                        >
                          {isActive ? 'Đang cư trú' : 'Đã chuyển đi'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(res)}
                            title="Sửa quan hệ / vai trò"
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #EFE9DF',
                              backgroundColor: '#FFFFFF',
                              color: '#6F6861',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Sửa</span>
                          </button>

                          {isActive && (
                            <button
                              type="button"
                              onClick={() => openMoveOutModal(res)}
                              title="Đánh dấu cư dân chuyển đi (không xoá lịch sử)"
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(200, 82, 82, 0.25)',
                                backgroundColor: 'rgba(200, 82, 82, 0.08)',
                                color: '#C85252',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <LogOut size={13} />
                              <span>Chuyển Đi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: ADD RESIDENT                                               */}
      {/* =================================================================== */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(45, 40, 37, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(45, 40, 37, 0.15)',
              border: '1px solid #EFE9DF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#2D2825' }}>
                Thêm Cư Dân Vào Căn Hộ
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ border: 'none', background: '#F3EEE5', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}
              >
                <X size={16} color="#6F6861" />
              </button>
            </div>

            <form onSubmit={handleAddResident} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                  ID Căn Hộ (UUID)*
                </label>
                <input
                  type="text"
                  value={addApartmentId}
                  onChange={(e) => setAddApartmentId(e.target.value)}
                  placeholder="Nhập Apartment ID (UUID)"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                  Email Cư Dân*
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="VD: resident@thanhle.vn"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                  Họ và Tên Cư Dân
                </label>
                <input
                  type="text"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="VD: Trần Văn Nam"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                  Số Điện Thoại (10 số VN)
                </label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="VD: 0912345678"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                    Quan Hệ Căn Hộ
                  </label>
                  <select
                    value={addRelationship}
                    onChange={(e) => setAddRelationship(e.target.value as any)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                  >
                    <option value="owner">Chủ Hộ (Owner)</option>
                    <option value="tenant">Người Thuê (Tenant)</option>
                    <option value="family_member">Người Thân (Family)</option>
                    <option value="other">Khác (Other)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                    Người Liên Hệ Chính?
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      backgroundColor: addIsPrimary ? 'rgba(217, 107, 67, 0.08)' : '#FFFFFF',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addIsPrimary}
                      onChange={(e) => setAddIsPrimary(e.target.checked)}
                    />
                    <span>Đặt làm liên hệ chính</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #EFE9DF', background: '#FBF9F5', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#D96B43',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isActionLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>Xác Nhận Thêm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: EDIT RESIDENT                                              */}
      {/* =================================================================== */}
      {isEditModalOpen && selectedResident && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(45, 40, 37, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(45, 40, 37, 0.15)',
              border: '1px solid #EFE9DF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#2D2825' }}>
                Cập Nhật Cư Dân: {selectedResident.resident_name}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ border: 'none', background: '#F3EEE5', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}
              >
                <X size={16} color="#6F6861" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '4px' }}>
                  Quan Hệ Với Căn Hộ
                </label>
                <select
                  value={editRelationship}
                  onChange={(e) => setEditRelationship(e.target.value as any)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #EFE9DF', fontSize: '0.84rem' }}
                >
                  <option value="owner">Chủ Hộ (Owner)</option>
                  <option value="tenant">Người Thuê (Tenant)</option>
                  <option value="family_member">Người Thân (Family)</option>
                  <option value="other">Khác (Other)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #EFE9DF',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    backgroundColor: editIsPrimary ? 'rgba(217, 107, 67, 0.08)' : '#FFFFFF',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editIsPrimary}
                    onChange={(e) => setEditIsPrimary(e.target.checked)}
                  />
                  <span>Đặt làm Người Liên Hệ Chính (Nhận thông báo sự cố & hóa đơn)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #EFE9DF', background: '#FBF9F5', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#D96B43',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isActionLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: MARK MOVED OUT (SOFT DELETE REASSURANCE)                  */}
      {/* =================================================================== */}
      {isMoveOutModalOpen && selectedResident && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(45, 40, 37, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMoveOutModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(45, 40, 37, 0.15)',
              border: '1px solid #EFE9DF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(217, 107, 67, 0.12)',
                  color: '#D96B43',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LogOut size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#2D2825' }}>
                Xác Nhận Cư Dân Chuyển Đi
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#6F6861', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Bạn có chắc chắn muốn đánh dấu cư dân <strong>{selectedResident.resident_name}</strong> đã chuyển khỏi
              căn hộ <strong>{selectedResident.unit_number}</strong> không?
            </p>

            <div
              style={{
                backgroundColor: 'rgba(74, 124, 89, 0.08)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(74, 124, 89, 0.2)',
                fontSize: '0.78rem',
                color: '#4A7C59',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
              }}
            >
              <Shield size={16} style={{ flexShrink: 0 }} />
              <span>
                Hệ thống <strong>không xóa vĩnh viễn dữ liệu</strong> nhằm bảo toàn toàn bộ lịch sử hóa đơn, thanh toán
                và phiếu dịch vụ cũ để đối chiếu kiểm toán.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsMoveOutModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #EFE9DF', background: '#FBF9F5', cursor: 'pointer' }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleConfirmMoveOut}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#C85252',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isActionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Đánh Dấu Chuyển Đi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
