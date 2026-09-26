import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  Home,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Star,
  User,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  ResidentApartment,
  UpdateProfilePayload,
  UserProfile,
  UserProfileDetails,
} from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onProfileUpdated?: (updated: UserProfileDetails) => void;
  onApartmentSwitched?: (apartmentId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onApartmentSwitched,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'emergency' | 'apartments' | 'security'>('info');
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [apartments, setApartments] = useState<ResidentApartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [nationalId, setNationalId] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile and apartments
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [profData, aptsData] = await Promise.all([
        api.getMyProfile(),
        api.getMyApartments().catch(() => [] as ResidentApartment[]),
      ]);
      setProfile(profData);
      setApartments(aptsData);

      setFullName(profData.full_name || '');
      setPhone(profData.phone || '');
      setDateOfBirth(profData.date_of_birth || '');
      setGender((profData.gender as any) || 'male');
      setNationalId(profData.national_id_masked || '');
      setEmergencyName(profData.emergency_contact_name || '');
      setEmergencyPhone(profData.emergency_contact_phone || '');
      setAvatarPreview(profData.avatar_url || null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tải thông tin hồ sơ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle avatar file selection
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Chỉ chấp nhận tập tin định dạng hình ảnh (JPEG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    // Local instant preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    // Auto upload
    setIsUploadingAvatar(true);
    setErrorMessage(null);
    try {
      const res = await api.uploadMyAvatar(file);
      setSuccessMessage('Cập nhật ảnh đại diện thành công!');
      if (profile) {
        const updated = { ...profile, avatar_url: res.avatar_url };
        setProfile(updated);
        onProfileUpdated?.(updated);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải lên ảnh đại diện');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle saving personal info and emergency contact
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate phone if provided
    const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (phone.trim() && !vnPhoneRegex.test(phone.trim().replace(/[\s\-\.]/g, ''))) {
      setErrorMessage('Số điện thoại không đúng định dạng Việt Nam (10 số, đầu 03/05/07/08/09)');
      setIsSaving(false);
      return;
    }
    if (emergencyPhone.trim() && !vnPhoneRegex.test(emergencyPhone.trim().replace(/[\s\-\.]/g, ''))) {
      setErrorMessage('Số điện thoại liên hệ khẩn cấp không đúng định dạng');
      setIsSaving(false);
      return;
    }

    try {
      const payload: UpdateProfilePayload = {
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        date_of_birth: dateOfBirth || null,
        gender: gender,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.trim() || undefined,
      };

      // Only send national_id if changed and unmasked
      if (nationalId && !nationalId.includes('*')) {
        payload.national_id = nationalId.trim();
      }

      const updated = await api.updateMyProfile(payload);
      setProfile(updated);
      setNationalId(updated.national_id_masked || '');
      setSuccessMessage('Hồ sơ đã được lưu thành công!');
      onProfileUpdated?.(updated);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lưu hồ sơ thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // Set primary contact for an apartment
  const handleSetPrimary = async (aptId: string) => {
    setSettingPrimaryId(aptId);
    setErrorMessage(null);
    try {
      await api.setPrimaryContact(aptId);
      setApartments((prev) =>
        prev.map((apt) => ({
          ...apt,
          is_primary_contact: apt.apartment_id === aptId,
        }))
      );
      setSuccessMessage('Đã chuyển đổi người liên hệ chính thành công!');
      onApartmentSwitched?.(aptId);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể thiết lập người liên hệ chính');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  // Change password submit handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu mới và xác nhận mật khẩu không trùng khớp');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage('Đổi mật khẩu thành công! Mật khẩu mới đã có hiệu lực.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(45, 40, 37, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FBF9F5',
          borderRadius: '20px',
          boxShadow: '0 24px 48px rgba(45, 40, 37, 0.16)',
          border: '1px solid #EFE9DF',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        {/* Header with Warm Oasis styling */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #EFE9DF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <User size={20} />
            </div>
            <div>
              <h2
                id="profile-modal-title"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#2D2825',
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Hồ Sơ Của Tôi
              </h2>
              <p
                style={{
                  fontSize: '0.82rem',
                  color: '#6F6861',
                  margin: '2px 0 0 0',
                }}
              >
                Thông tin cá nhân & căn hộ liên kết trong ThanhLe Smart Tower
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ hồ sơ"
            style={{
              border: 'none',
              background: '#F3EEE5',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6F6861',
              transition: 'all 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback Alert Banners */}
        {successMessage && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(74, 124, 89, 0.12)',
              borderBottom: '1px solid rgba(74, 124, 89, 0.25)',
              color: '#4A7C59',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(200, 82, 82, 0.1)',
              borderBottom: '1px solid rgba(200, 82, 82, 0.25)',
              color: '#C85252',
              fontSize: '0.85rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#8E867E' }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 12px auto', color: '#D96B43' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Đang nạp thông tin hồ sơ của bạn...</p>
            </div>
          ) : (
            <>
              {/* Avatar & Quick Identity Card */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '1px solid #EFE9DF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
                }}
              >
                {/* Circle Avatar with Upload trigger */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: '#F3EEE5',
                      border: '3px solid #FFFFFF',
                      boxShadow: '0 4px 12px rgba(45, 40, 37, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                      fontWeight: 700,
                      color: '#D96B43',
                    }}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Ảnh đại diện"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      fullName?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'O'
                    )}
                  </div>

                  {/* Camera icon button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    aria-label="Thay đổi ảnh đại diện"
                    title="Tải lên ảnh đại diện mới"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#D96B43',
                      color: '#FFFFFF',
                      border: '2px solid #FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  >
                    {isUploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Identity info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: '#2D2825',
                      }}
                    >
                      {fullName || 'Chưa cập nhật họ tên'}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor:
                          currentUser?.role === 'admin'
                            ? 'rgba(67, 122, 130, 0.12)'
                            : 'rgba(74, 124, 89, 0.12)',
                        color: currentUser?.role === 'admin' ? '#437A82' : '#4A7C59',
                      }}
                    >
                      {currentUser?.role === 'admin' ? 'Ban Quản Lý' : 'Cư Dân'}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.84rem',
                      color: '#6F6861',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Mail size={13} />
                    <span>{currentUser?.email}</span>
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.75rem',
                      color: '#8E867E',
                    }}
                  >
                    Định dạng hỗ trợ: JPG, PNG, WebP (tối đa 5MB, tự động tối ưu hóa)
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div
                role="tablist"
                style={{
                  display: 'flex',
                  gap: '6px',
                  backgroundColor: '#F3EEE5',
                  padding: '4px',
                  borderRadius: '12px',
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'info'}
                  onClick={() => setActiveTab('info')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'info' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'info' ? '#2D2825' : '#6F6861',
                    fontWeight: activeTab === 'info' ? 700 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'info' ? '0 2px 4px rgba(45, 40, 37, 0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <User size={15} />
                  <span>Thông Tin Cá Nhân</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'emergency'}
                  onClick={() => setActiveTab('emergency')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'emergency' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'emergency' ? '#2D2825' : '#6F6861',
                    fontWeight: activeTab === 'emergency' ? 700 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'emergency' ? '0 2px 4px rgba(45, 40, 37, 0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <HeartHandshake size={15} />
                  <span>Liên Hệ Khẩn Cấp</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'apartments'}
                  onClick={() => setActiveTab('apartments')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'apartments' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'apartments' ? '#2D2825' : '#6F6861',
                    fontWeight: activeTab === 'apartments' ? 700 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'apartments' ? '0 2px 4px rgba(45, 40, 37, 0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Home size={15} />
                  <span>Căn Hộ ({apartments.length})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'security'}
                  onClick={() => setActiveTab('security')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'security' ? '#FFFFFF' : 'transparent',
                    color: activeTab === 'security' ? '#2D2825' : '#6F6861',
                    fontWeight: activeTab === 'security' ? 700 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'security' ? '0 2px 4px rgba(45, 40, 37, 0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <KeyRound size={15} />
                  <span>Đổi Mật Khẩu</span>
                </button>
              </div>

              {/* TAB 1: Personal Info */}
              {activeTab === 'info' && (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1px solid #EFE9DF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="profile-full-name"
                        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Họ và Tên
                      </label>
                      <input
                        id="profile-full-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="VD: Nguyễn Văn An"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FBF9F5',
                          fontSize: '0.88rem',
                          color: '#2D2825',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Email (Read only + verified) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label
                          htmlFor="profile-email"
                          style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D2825' }}
                        >
                          Địa Chỉ Email (Tài Khoản Xác Thực)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: '#4A7C59', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Đã kích hoạt
                        </span>
                      </div>
                      <input
                        id="profile-email"
                        type="email"
                        value={currentUser?.email || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#F3EEE5',
                          fontSize: '0.88rem',
                          color: '#6F6861',
                          cursor: 'not-allowed',
                          boxSizing: 'border-box',
                        }}
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#8E867E' }}>
                        Để đổi email, vui lòng liên hệ BQL hoặc thực hiện qua quy trình xác thực OTP bảo mật.
                      </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label
                        htmlFor="profile-phone"
                        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Số Điện Thoại Liên Hệ (10 số)
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 0912345678"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FBF9F5',
                          fontSize: '0.88rem',
                          color: '#2D2825',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Date of birth & Gender in 2 columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label
                          htmlFor="profile-dob"
                          style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                        >
                          Ngày Sinh
                        </label>
                        <input
                          id="profile-dob"
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            backgroundColor: '#FBF9F5',
                            fontSize: '0.88rem',
                            color: '#2D2825',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="profile-gender"
                          style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                        >
                          Giới Tính
                        </label>
                        <select
                          id="profile-gender"
                          value={gender}
                          onChange={(e) => setGender(e.target.value as any)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            backgroundColor: '#FBF9F5',
                            fontSize: '0.88rem',
                            color: '#2D2825',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="male">Nam</option>
                          <option value="female">Nữ</option>
                          <option value="other">Khác</option>
                        </select>
                      </div>
                    </div>

                    {/* National ID (CCCD masked) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label
                          htmlFor="profile-national-id"
                          style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D2825' }}
                        >
                          Số Định Danh CCCD / CMND
                        </label>
                        <span style={{ fontSize: '0.72rem', color: '#B87319', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Lock size={11} /> Che bảo mật
                        </span>
                      </div>
                      <input
                        id="profile-national-id"
                        type="text"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="VD: 037***1234 hoặc nhập số mới"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FBF9F5',
                          fontSize: '0.88rem',
                          color: '#2D2825',
                          boxSizing: 'border-box',
                        }}
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#8E867E' }}>
                        Hệ thống tự động che các ký tự ở giữa (VD: 037***1234) để bảo vệ danh tính của bạn.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn btn-primary"
                      style={{
                        padding: '10px 24px',
                        backgroundColor: '#D96B43',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      <span>Lưu Thay Đổi</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: Emergency Contact */}
              {activeTab === 'emergency' && (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Warm reassurance note */}
                  <div
                    style={{
                      backgroundColor: 'rgba(217, 107, 67, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      border: '1px solid rgba(217, 107, 67, 0.25)',
                      display: 'flex',
                      gap: '12px',
                    }}
                  >
                    <Info size={20} style={{ color: '#D96B43', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.83rem', color: '#6F6861', lineHeight: '1.5' }}>
                      <strong style={{ color: '#2D2825' }}>Lưu ý an tâm từ Ban Quản Lý:</strong>
                      <br />
                      Thông tin liên hệ khẩn cấp chỉ được sử dụng trong các tình huống kỹ thuật nghiêm trọng (rò rỉ nước, nguy cơ cháy nổ, an toàn chung của tòa nhà) khi không thể kết nối trực tiếp với bạn. Chúng tôi cam kết không sử dụng cho mục đích tiếp thị.
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1px solid #EFE9DF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <label
                        htmlFor="emergency-name"
                        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Họ Tên Người Liên Hệ Khẩn Cấp
                      </label>
                      <input
                        id="emergency-name"
                        type="text"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        placeholder="VD: Trần Thị Mai (Vợ / Người thân)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FBF9F5',
                          fontSize: '0.88rem',
                          color: '#2D2825',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="emergency-phone"
                        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Số Điện Thoại Người Liên Hệ Khẩn Cấp
                      </label>
                      <input
                        id="emergency-phone"
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="VD: 0908765432"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FBF9F5',
                          fontSize: '0.88rem',
                          color: '#2D2825',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn btn-primary"
                      style={{
                        padding: '10px 24px',
                        backgroundColor: '#D96B43',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      <span>Lưu Người Liên Hệ</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: Linked Apartments */}
              {activeTab === 'apartments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#6F6861' }}>
                    Danh sách các căn hộ bạn đang cư trú hoặc sở hữu trong khuôn viên tòa nhà:
                  </p>

                  {apartments.length === 0 ? (
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '36px',
                        textAlign: 'center',
                        border: '1px solid #EFE9DF',
                        color: '#8E867E',
                      }}
                    >
                      <Home size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>Chưa có căn hộ nào được liên kết với tài khoản này.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Vui lòng liên hệ BQL để gán căn hộ của bạn.</p>
                    </div>
                  ) : (
                    apartments.map((apt) => {
                      const isSetting = settingPrimaryId === apt.apartment_id;
                      return (
                        <div
                          key={apt.id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '18px 20px',
                            border: apt.is_primary_contact ? '2px solid #D96B43' : '1px solid #EFE9DF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                backgroundColor: apt.is_primary_contact
                                  ? 'rgba(217, 107, 67, 0.12)'
                                  : '#F3EEE5',
                                color: apt.is_primary_contact ? '#D96B43' : '#6F6861',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Home size={22} />
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                                  Căn {apt.unit_number}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    backgroundColor:
                                      apt.relationship === 'owner'
                                        ? 'rgba(74, 124, 89, 0.12)'
                                        : 'rgba(67, 122, 130, 0.12)',
                                    color: apt.relationship === 'owner' ? '#4A7C59' : '#437A82',
                                  }}
                                >
                                  {apt.relationship === 'owner'
                                    ? 'Chủ Hộ'
                                    : apt.relationship === 'tenant'
                                    ? 'Người Thuê'
                                    : apt.relationship === 'family_member'
                                    ? 'Thành Viên Gia Đình'
                                    : 'Khác'}
                                </span>
                                {apt.is_primary_contact && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      backgroundColor: 'rgba(217, 107, 67, 0.14)',
                                      color: '#D96B43',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <Star size={11} fill="#D96B43" />
                                    Người liên hệ chính
                                  </span>
                                )}
                              </div>
                              <p
                                style={{
                                  margin: '3px 0 0 0',
                                  fontSize: '0.8rem',
                                  color: '#6F6861',
                                }}
                              >
                                {apt.building_name} • Tầng {apt.floor_number}
                              </p>
                            </div>
                          </div>

                          <div>
                            {!apt.is_primary_contact ? (
                              <button
                                type="button"
                                disabled={isSetting}
                                onClick={() => handleSetPrimary(apt.apartment_id)}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid #EFE9DF',
                                  backgroundColor: '#FBF9F5',
                                  color: '#2D2825',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.2s',
                                }}
                              >
                                {isSetting && <Loader2 size={13} className="animate-spin" />}
                                <span>Đặt làm liên hệ chính</span>
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: '#4A7C59',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <CheckCircle2 size={14} /> Nhận thông báo chính
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: Đổi Mật Khẩu (Security) */}
              {activeTab === 'security' && (
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '24px',
                      border: '1px solid #EFE9DF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #EFE9DF', paddingBottom: '12px' }}>
                      <KeyRound size={18} color="#D96B43" />
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#2D2825' }}>
                          Thay Đổi Mật Khẩu Đăng Nhập
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#8E867E' }}>
                          Mật khẩu mặc định của các tài khoản hệ thống là <strong>123456</strong>
                        </p>
                      </div>
                    </div>

                    {/* Current Password */}
                    <div>
                      <label
                        htmlFor="modal-curr-pwd"
                        style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Mật khẩu hiện tại <span style={{ color: '#C85252' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="modal-curr-pwd"
                          type={showCurrentPassword ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Nhập mật khẩu hiện tại (VD: 123456)"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            paddingRight: '38px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            fontSize: '0.86rem',
                            backgroundColor: '#FBF9F5',
                            color: '#2D2825',
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#8E867E',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={showCurrentPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                        >
                          {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label
                        htmlFor="modal-new-pwd"
                        style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Mật khẩu mới (Tối thiểu 6 ký tự) <span style={{ color: '#C85252' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="modal-new-pwd"
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Nhập mật khẩu mới"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            paddingRight: '38px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            fontSize: '0.86rem',
                            backgroundColor: '#FBF9F5',
                            color: '#2D2825',
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#8E867E',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={showNewPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                        >
                          {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label
                        htmlFor="modal-confirm-pwd"
                        style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#2D2825', marginBottom: '6px' }}
                      >
                        Xác nhận mật khẩu mới <span style={{ color: '#C85252' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="modal-confirm-pwd"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            paddingRight: '38px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            fontSize: '0.86rem',
                            backgroundColor: '#FBF9F5',
                            color: '#2D2825',
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#8E867E',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                        >
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        style={{
                          padding: '9px 18px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          backgroundColor: '#FFFFFF',
                          color: '#6F6861',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Làm Lại
                      </button>
                      <button
                        type="submit"
                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                        style={{
                          padding: '9px 22px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#D96B43',
                          color: '#FFFFFF',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
                        }}
                      >
                        {isChangingPassword ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                        <span>Cập Nhật Mật Khẩu</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
