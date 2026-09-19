import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import type { UserWithRolesResponse, RoleItem, Building as BuildingType } from '../types';

interface RbacManagerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  onRolesUpdated?: () => void;
}

export const RbacManagerModal: React.FC<RbacManagerModalProps> = ({
  isOpen,
  onClose,
  asPage = false,
  onRolesUpdated,
}) => {
  const [users, setUsers] = useState<UserWithRolesResponse[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Assign role dialog state
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRolesResponse | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Revoke confirmation dialog state
  const [revokeTarget, setRevokeTarget] = useState<{
    user: UserWithRolesResponse;
    roleId: string;
    roleName: string;
  } | null>(null);

  // Notification message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uRes, rRes, bRes] = await Promise.allSettled([
        api.getAdminUsers(),
        api.getAdminRoles(),
        api.getBuildings(),
      ]);

      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      if (rRes.status === 'fulfilled') setRoles(rRes.value);
      if (bRes.status === 'fulfilled') setBuildings(bRes.value.items || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu RBAC:', err);
      showToast('Không thể tải danh sách tài khoản và vai trò', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen || asPage) {
      loadData();
    }
  }, [isOpen, asPage, loadData]);

  if (!isOpen && !asPage) return null;

  const handleOpenAssign = (user: UserWithRolesResponse) => {
    setSelectedUser(user);
    setSelectedRoleId(roles[0]?.id || '');
    setSelectedBuildingId(buildings[0]?.id || '');
    setIsAssignOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedRoleId) return;

    setIsSubmitting(true);
    try {
      await api.assignUserRole(selectedUser.id, {
        role_id: selectedRoleId,
        building_id: selectedBuildingId ? selectedBuildingId : undefined,
      });
      showToast(`Đã cấp vai trò thành công cho ${selectedUser.full_name || selectedUser.email}`);
      setIsAssignOpen(false);
      loadData();
      if (onRolesUpdated) onRolesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gán vai trò', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;

    setIsSubmitting(true);
    try {
      await api.revokeUserRole(revokeTarget.user.id, revokeTarget.roleId);
      showToast(`Đã thu hồi vai trò ${revokeTarget.roleName} của ${revokeTarget.user.full_name || revokeTarget.user.email}`);
      setRevokeTarget(null);
      loadData();
      if (onRolesUpdated) onRolesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi thu hồi vai trò', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.apartment_unit && u.apartment_unit.toLowerCase().includes(q)) ||
      u.roles.some((r) => r.role_name.toLowerCase().includes(q))
    );
  });

  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName) {
      case 'super_admin':
        return { bg: 'rgba(200, 82, 82, 0.14)', color: '#C85252', border: '1px solid rgba(200, 82, 82, 0.35)', label: 'Quản Trị Tối Cao' };
      case 'building_admin':
        return { bg: 'rgba(217, 107, 67, 0.14)', color: '#D96B43', border: '1px solid rgba(217, 107, 67, 0.35)', label: 'BQL Tòa Nhà' };
      case 'accountant':
        return { bg: 'rgba(184, 115, 25, 0.14)', color: '#B87319', border: '1px solid rgba(184, 115, 25, 0.35)', label: 'Kế Toán' };
      case 'technician':
        return { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563EB', border: '1px solid rgba(59, 130, 246, 0.35)', label: 'Kỹ Thuật' };
      case 'resident':
        return { bg: 'rgba(74, 124, 89, 0.14)', color: '#4A7C59', border: '1px solid rgba(74, 124, 89, 0.35)', label: 'Cư Dân' };
      default:
        return { bg: '#FAF7F2', color: '#786F66', border: '1px solid #E5DCCE', label: roleName };
    }
  };

  const content = (
    <div
      className="page-view-container animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '1080px',
        maxHeight: asPage ? 'none' : '90vh',
        minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
        backgroundColor: '#FAF7F2',
        borderRadius: '16px',
        border: '1px solid #E5DCCE',
        boxShadow: asPage ? '0 2px 12px rgba(45, 40, 37, 0.05)' : '0 20px 50px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#2D2825',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5DCCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 107, 67, 0.14)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#2D2825' }}>
                Quản Trị Phân Quyền Vai Trò (RBAC Management)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#786F66' }}>
                Cấu hình ma trận quyền hạn (Super Admin, BQL, Kế toán, Kỹ thuật, Cư dân) theo phạm vi tòa nhà
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={loadData}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                backgroundColor: '#FAF7F2',
                border: '1px solid #E5DCCE',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                color: '#4A4036',
              }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>

            {!asPage && onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: '8px',
                  backgroundColor: '#FAF7F2',
                  border: '1px solid #E5DCCE',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#786F66',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: toastMessage.type === 'success' ? 'rgba(74, 124, 89, 0.12)' : 'rgba(200, 82, 82, 0.12)',
              borderBottom: toastMessage.type === 'success' ? '1px solid rgba(74, 124, 89, 0.25)' : '1px solid rgba(200, 82, 82, 0.25)',
              color: toastMessage.type === 'success' ? '#3B6847' : '#C85252',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Search & Info Banner */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #E5DCCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#FAF7F2',
          }}
        >
          <div style={{ position: 'relative', width: '320px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#A0978D' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm người dùng theo tên, email, vai trò..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #E5DCCE',
                backgroundColor: '#FFFFFF',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#786F66' }}>
            <Info size={14} color="#D96B43" />
            <span>Quyền hạn được kiểm soát theo nguyên tắc <strong>Least Privilege</strong> (Tối thiểu đặc quyền)</span>
          </div>
        </div>

        {/* User Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5DCCE', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E5DCCE', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4A4036' }}>Tài Khoản</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4A4036' }}>Căn Hộ / Tòa Nhà</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4A4036' }}>Vai Trò Được Cấp (RBAC)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4A4036', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #EFE9DF' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#2D2825' }}>
                        {user.full_name || 'Chưa đặt tên'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#786F66', fontFamily: 'monospace' }}>
                        {user.email}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {user.apartment_unit ? (
                        <div style={{ fontWeight: 600, color: '#4A4036' }}>
                          Căn {user.apartment_unit}
                        </div>
                      ) : (
                        <span style={{ color: '#A0978D', fontSize: '0.76rem' }}>Tài khoản vận hành</span>
                      )}
                      <div style={{ fontSize: '0.72rem', color: '#786F66' }}>
                        {user.building_name || 'Toàn hệ thống'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {user.roles.length === 0 ? (
                          <span style={{ fontSize: '0.74rem', color: '#A0978D', fontStyle: 'italic' }}>
                            Chưa gán vai trò (Mặc định: {user.legacy_role})
                          </span>
                        ) : (
                          user.roles.map((r) => {
                            const badge = getRoleBadgeStyle(r.role_name);
                            return (
                              <span
                                key={r.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: badge.border,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                }}
                              >
                                <span>{badge.label}</span>
                                {r.building_name && (
                                  <span style={{ fontSize: '0.66rem', opacity: 0.85, fontWeight: 500 }}>
                                    ({r.building_name})
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    setRevokeTarget({
                                      user,
                                      roleId: r.role_id,
                                      roleName: badge.label,
                                    })
                                  }
                                  title={`Thu hồi vai trò ${badge.label}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: badge.color,
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    marginLeft: '2px',
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenAssign(user)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #D96B43',
                          backgroundColor: 'rgba(217, 107, 67, 0.08)',
                          color: '#D96B43',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <UserPlus size={13} />
                        <span>Thêm Vai Trò</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assign Role Sub-Modal */}
        {isAssignOpen && selectedUser && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              zIndex: 10010,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <form
              onSubmit={handleConfirmAssign}
              style={{
                width: '100%',
                maxWidth: '460px',
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E5DCCE',
                padding: '24px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                  Gán Vai Trò Mới
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#786F66' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#786F66' }}>
                Tài khoản: <strong>{selectedUser.full_name || selectedUser.email}</strong> ({selectedUser.email})
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#4A4036', marginBottom: '6px' }}>
                  Chọn Vai Trò:
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E5DCCE',
                    backgroundColor: '#FAF7F2',
                    fontSize: '0.84rem',
                    color: '#2D2825',
                  }}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#4A4036', marginBottom: '6px' }}>
                  Phạm Vi Tòa Nhà (Tùy chọn):
                </label>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E5DCCE',
                    backgroundColor: '#FAF7F2',
                    fontSize: '0.84rem',
                    color: '#2D2825',
                  }}
                >
                  <option value="">Toàn hệ thống (Không giới hạn)</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E5DCCE',
                    backgroundColor: '#FAF7F2',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#D96B43',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Gán'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Revoke Confirmation Sub-Modal */}
        {revokeTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              zIndex: 10010,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E5DCCE',
                padding: '24px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#C85252' }}>
                <ShieldAlert size={24} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Xác Nhận Thu Hồi Vai Trò
                </h3>
              </div>

              <p style={{ margin: 0, fontSize: '0.84rem', color: '#4A4036', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn thu hồi vai trò <strong>{revokeTarget.roleName}</strong> của tài khoản{' '}
                <strong>{revokeTarget.user.full_name || revokeTarget.user.email}</strong>?
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E5DCCE',
                    backgroundColor: '#FAF7F2',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#C85252',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? 'Đang thu hồi...' : 'Xác Nhận Thu Hồi'}
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(25, 20, 18, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {content}
    </div>
  );
};
