import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  Lock,
  Search,
  Unlock,
  Users,
  X,
} from 'lucide-react';

import { api } from '../services/api';
import type { UserAdminItem } from '../types';

interface UserManagerProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  onUserUpdated?: () => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  isOpen,
  onClose,
  asPage = false,
  onUserUpdated,
}) => {
  const [users, setUsers] = useState<UserAdminItem[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'resident'>('all');
  const [filterAssigned, setFilterAssigned] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Modal assign apartment state
  const [selectedUser, setSelectedUser] = useState<UserAdminItem | null>(null);
  const [assigningAptId, setAssigningAptId] = useState<string>('');
  const [onlyVacantFilter, setOnlyVacantFilter] = useState<boolean>(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Map apartment_id -> UserAdminItem (active occupant)
  const assignedApartmentMap = useMemo(() => {
    const map = new Map<string, UserAdminItem>();
    users.forEach((u) => {
      if (u.apartment_id && u.is_active && !map.has(u.apartment_id)) {
        map.set(u.apartment_id, u);
      }
    });
    return map;
  }, [users]);

  // Set of apartment_ids that are assigned to more than 1 user (duplicate data detection)
  const duplicateApartmentIds = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (u.apartment_id && u.is_active) {
        counts.set(u.apartment_id, (counts.get(u.apartment_id) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((cnt, aptId) => {
      if (cnt > 1) dupes.add(aptId);
    });
    return dupes;
  }, [users]);

  const vacantApartmentsCount = useMemo(() => {
    return apartments.filter((apt) => !assignedApartmentMap.has(apt.id)).length;
  }, [apartments, assignedApartmentMap]);

  const displayApartments = useMemo(() => {
    if (!onlyVacantFilter) return apartments;
    return apartments.filter((apt) => {
      const occupant = assignedApartmentMap.get(apt.id);
      return !occupant || (selectedUser && occupant.id === selectedUser.id);
    });
  }, [apartments, onlyVacantFilter, assignedApartmentMap, selectedUser]);

  const handleOpenAssignModal = (user: UserAdminItem) => {
    setSelectedUser(user);
    if (user.apartment_id) {
      setAssigningAptId(user.apartment_id);
    } else {
      const firstVacant = apartments.find((a) => !assignedApartmentMap.has(a.id));
      setAssigningAptId(firstVacant ? firstVacant.id : '');
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersData, aptsData] = await Promise.all([
        api.getUsers(),
        api.getApartments(1, 100),
      ]);
      setUsers(usersData);
      if (aptsData?.items) {
        setApartments(aptsData.items);
      }
    } catch (err: any) {
      console.error('Failed to load user management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadData();
      setActionSuccess(null);
      setActionError(null);
    }
  }, [isOpen, asPage]);

  if (!isOpen && !asPage) return null;

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !assigningAptId) return;

    // Check client-side occupant conflict
    const occupant = assignedApartmentMap.get(assigningAptId);
    if (occupant && occupant.id !== selectedUser.id) {
      setActionError(
        `Căn hộ này hiện đã được gán cho cư dân '${occupant.full_name || occupant.email}'. Vui lòng chọn căn hộ trống!`
      );
      return;
    }

    try {
      setIsAssigning(true);
      setActionError(null);
      await api.assignApartment(selectedUser.id, assigningAptId);
      setActionSuccess(`Đã gán thành công căn hộ cho ${selectedUser.full_name || selectedUser.email}`);
      setSelectedUser(null);
      setAssigningAptId('');
      await loadData();
      onUserUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Gán căn hộ thất bại');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (user: UserAdminItem) => {
    if (!confirm(`Bạn có chắc muốn hủy gán căn hộ của ${user.full_name || user.email}?`)) return;

    try {
      setIsLoading(true);
      await api.unassignApartment(user.id);
      setActionSuccess(`Đã hủy gán căn hộ cho ${user.full_name || user.email}`);
      await loadData();
      onUserUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Hủy gán căn hộ thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserAdminItem) => {
    const actionName = user.is_active ? 'vô hiệu hóa' : 'kích hoạt';
    if (!confirm(`Bạn có chắc muốn ${actionName} tài khoản ${user.email}?`)) return;

    try {
      setIsLoading(true);
      await api.toggleUserStatus(user.id, !user.is_active);
      setActionSuccess(`Đã ${actionName} tài khoản ${user.email}`);
      await loadData();
      onUserUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Cập nhật trạng thái thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.apartment_unit && u.apartment_unit.toLowerCase().includes(search.toLowerCase()));

    const matchRole = filterRole === 'all' || u.role === filterRole;

    const matchAssigned =
      filterAssigned === 'all' ||
      (filterAssigned === 'assigned' && u.apartment_id !== null) ||
      (filterAssigned === 'unassigned' && u.apartment_id === null && u.role === 'resident');

    return matchSearch && matchRole && matchAssigned;
  });

  const unassignedCount = users.filter((u) => u.role === 'resident' && !u.apartment_id).length;
  const totalResidents = users.filter((u) => u.role === 'resident').length;

  const content = (
    <div
      className="glass-panel animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '1080px',
        maxHeight: asPage ? 'none' : '90vh',
        minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #131b2e 0%, #0c1220 100%)',
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
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Quản Lý Cư Dân & Gán Căn Hộ
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Hệ thống xác thực và phân bổ căn hộ thông minh cho Ban Quản Lý
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

        {/* Status / Alert Bar */}
        {actionSuccess && (
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
            <CheckCircle2 size={16} />
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div
            style={{
              padding: '10px 24px',
              background: 'rgba(239, 68, 68, 0.12)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            {actionError}
          </div>
        )}

        {/* Quick Stats Strip */}
        <div
          style={{
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.5)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tổng cư dân:</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
              {totalResidents}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Chờ gán căn hộ:</span>
            <span
              className="badge"
              style={{
                background: unassignedCount > 0 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: unassignedCount > 0 ? '#f43f5e' : '#4ade80',
                border: unassignedCount > 0 ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
              }}
            >
              {unassignedCount} tài khoản
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Căn hộ trống sẵn sàng:</span>
            <strong style={{ color: '#38bdf8', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
              {vacantApartmentsCount} / {apartments.length} căn hộ
            </strong>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            padding: '14px 24px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 250px',
              minWidth: '220px',
            }}
          >
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder="Tìm theo email, tên cư dân, số phòng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Filter Role */}
          <select
            value={filterRole}
            onChange={(e: any) => setFilterRole(e.target.value)}
            style={{
              padding: '8px 14px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="resident">Chỉ Cư Dân</option>
            <option value="admin">Ban Quản Lý (Admin)</option>
          </select>

          {/* Filter Assignment */}
          <select
            value={filterAssigned}
            onChange={(e: any) => setFilterAssigned(e.target.value)}
            style={{
              padding: '8px 14px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unassigned">Chờ gán căn hộ (Mới)</option>
            <option value="assigned">Đã có căn hộ</option>
          </select>
        </div>

        {/* User Table Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              <Loader2 className="spin" size={32} style={{ margin: '0 auto 12px' }} />
              <div>Đang tải dữ liệu cư dân...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              Không tìm thấy người dùng nào phù hợp với bộ lọc.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Người Dùng
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Vai Trò
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Căn Hộ Gán
                  </th>
                  <th style={{ padding: '12px 10px', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Trạng Thái
                  </th>
                  <th
                    style={{
                      padding: '12px 10px',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      textAlign: 'right',
                    }}
                  >
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const hasApartment = !!user.apartment_id;
                  const isDuplicateApartment = Boolean(user.apartment_id && duplicateApartmentIds.has(user.apartment_id));
                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '14px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                          {user.full_name || 'Chưa cập nhật tên'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                          {user.email}
                        </div>
                      </td>

                      <td style={{ padding: '14px 10px' }}>
                        <span
                          className={`badge ${user.role === 'admin' ? 'badge-critical' : 'badge-healthy'}`}
                          style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}
                        >
                          {user.role === 'admin' ? 'Ban Quản Lý' : 'Cư Dân'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 10px' }}>
                        {hasApartment ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Home size={15} color="#38bdf8" />
                              <div>
                                <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
                                  Căn {user.apartment_unit}
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '6px' }}>
                                  ({user.building_name || 'Tòa Skyline'})
                                </span>
                              </div>
                            </div>
                            {isDuplicateApartment && (
                              <div
                                style={{
                                  marginTop: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  borderRadius: '4px',
                                  color: '#f87171',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                }}
                                title="Căn hộ này đang bị gán trùng cho nhiều hơn 1 tài khoản! Hãy hủy gán hoặc đổi căn hộ cho cư dân."
                              >
                                <AlertCircle size={11} />
                                <span>Trùng với cư dân khác!</span>
                              </div>
                            )}
                          </div>
                        ) : user.role === 'resident' ? (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              fontSize: '0.72rem',
                            }}
                          >
                            ⚠️ Chờ Gán Căn Hộ
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>N/A (Toàn tòa nhà)</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 10px' }}>
                        <span
                          className={`badge ${user.is_active ? 'badge-healthy' : 'badge-offline'}`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {user.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {user.role === 'resident' && (
                            <>
                              <button
                                onClick={() => handleOpenAssignModal(user)}
                                className="btn-secondary"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: hasApartment ? 'rgba(56, 189, 248, 0.1)' : 'rgba(34, 197, 94, 0.15)',
                                  border: hasApartment ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(34, 197, 94, 0.4)',
                                  color: hasApartment ? '#38bdf8' : '#4ade80',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                <Home size={13} />
                                {hasApartment ? 'Đổi Căn' : 'Gán Căn Hộ'}
                              </button>

                              {hasApartment && (
                                <button
                                  onClick={() => handleUnassign(user)}
                                  className="btn-secondary"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '0.75rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#f87171',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                  title="Hủy gán căn hộ"
                                >
                                  Hủy Gán
                                </button>
                              )}
                            </>
                          )}

                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.75rem',
                                background: user.is_active ? 'rgba(255, 255, 255, 0.05)' : 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: user.is_active ? '#94a3b8' : '#4ade80',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                              title={user.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                            >
                              {user.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Gán Căn Hộ */}
        {selectedUser && (
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
                maxWidth: '480px',
                padding: '24px',
                background: '#1a233a',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '14px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#38bdf8" />
                  Gán Căn Hộ Cho Cư Dân
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Cư dân:</div>
                <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedUser.full_name || selectedUser.email}</div>
                <div style={{ color: '#64748b', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                  {selectedUser.email}
                </div>
              </div>

              <form onSubmit={handleAssignSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label
                      style={{
                        fontSize: '0.85rem',
                        color: '#cbd5e1',
                        fontWeight: 600,
                      }}
                    >
                      Chọn Căn Hộ Muốn Gán:
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={onlyVacantFilter}
                        onChange={(e) => setOnlyVacantFilter(e.target.checked)}
                        style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                      <span>Chỉ hiện căn hộ còn trống ({vacantApartmentsCount})</span>
                    </label>
                  </div>
                  <select
                    value={assigningAptId}
                    onChange={(e) => setAssigningAptId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Chọn căn hộ --</option>
                    {displayApartments.map((apt) => {
                      const occupant = assignedApartmentMap.get(apt.id);
                      const isOccupiedByOther = occupant && occupant.id !== selectedUser?.id;
                      const isCurrentlyMine = occupant && occupant.id === selectedUser?.id;

                      let label = `Căn ${apt.unit_number} (Tầng ${apt.floor?.floor_number || 1} • ${apt.area_sqm || 75} m²)`;
                      if (isCurrentlyMine) {
                        label += ' — [Hiện tại đang ở căn này]';
                      } else if (isOccupiedByOther) {
                        label += ` — [ĐÃ GÁN: ${occupant.full_name || occupant.email}] (Đã có người ở)`;
                      } else {
                        label += ' — [Trống - Sẵn sàng]';
                      }

                      return (
                        <option
                          key={apt.id}
                          value={apt.id}
                          disabled={Boolean(isOccupiedByOther)}
                          style={{
                            color: isOccupiedByOther ? '#94a3b8' : isCurrentlyMine ? '#38bdf8' : '#4ade80',
                            background: '#0f172a',
                          }}
                        >
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isAssigning ||
                      !assigningAptId ||
                      Boolean(
                        assignedApartmentMap.get(assigningAptId) &&
                        assignedApartmentMap.get(assigningAptId)?.id !== selectedUser?.id
                      )
                    }
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isAssigning && <Loader2 className="spin" size={16} />}
                    Xác Nhận Gán Căn Hộ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );

  if (asPage) {
    return content;
  }

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
