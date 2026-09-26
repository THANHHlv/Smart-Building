import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  Home,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Star,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './ui/Toast';
import { MOTION_SPRINGS } from '../tokens/motionTokens';
import type {
  ResidentApartment,
  UpdateProfilePayload,
  UserProfile,
  UserProfileDetails,
} from '../types';

interface ProfilePageProps {
  currentUser: UserProfile | null;
  onProfileUpdated?: (updated: UserProfileDetails) => void;
  onSelectApartment?: (apartmentId: string) => void;
}

type TabKey = 'personal' | 'apartments' | 'emergency' | 'security';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  onProfileUpdated,
  onSelectApartment,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [apartments, setApartments] = useState<ResidentApartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [nationalId, setNationalId] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Change password states
  const [showPasswordForm, setShowPasswordForm] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Initial form values for dirty checking
  const [initialFormValues, setInitialFormValues] = useState<{
    fullName: string;
    phone: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    nationalId: string;
    emergencyName: string;
    emergencyPhone: string;
  }>({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    gender: 'male',
    nationalId: '',
    emergencyName: '',
    emergencyPhone: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if form is dirty
  const isDirty =
    fullName !== initialFormValues.fullName ||
    phone !== initialFormValues.phone ||
    dateOfBirth !== initialFormValues.dateOfBirth ||
    gender !== initialFormValues.gender ||
    nationalId !== initialFormValues.nationalId ||
    emergencyName !== initialFormValues.emergencyName ||
    emergencyPhone !== initialFormValues.emergencyPhone;

  // Load profile and apartments
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profData, aptsData] = await Promise.all([
        api.getMyProfile(),
        api.getMyApartments().catch(() => [] as ResidentApartment[]),
      ]);
      setProfile(profData);
      setApartments(aptsData);

      const fName = profData.full_name || '';
      const fPhone = profData.phone || '';
      const fDob = profData.date_of_birth || '';
      const fGender = (profData.gender as any) || 'male';
      const fNatId = profData.national_id_masked || '';
      const fEmName = profData.emergency_contact_name || '';
      const fEmPhone = profData.emergency_contact_phone || '';

      setFullName(fName);
      setPhone(fPhone);
      setDateOfBirth(fDob);
      setGender(fGender);
      setNationalId(fNatId);
      setEmergencyName(fEmName);
      setEmergencyPhone(fEmPhone);
      setAvatarPreview(profData.avatar_url || null);

      setInitialFormValues({
        fullName: fName,
        phone: fPhone,
        dateOfBirth: fDob,
        gender: fGender,
        nationalId: fNatId,
        emergencyName: fEmName,
        emergencyPhone: fEmPhone,
      });
    } catch (err: any) {
      toast.error('Lỗi tải hồ sơ', err.message || 'Không thể tải thông tin hồ sơ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard shortcut Ctrl/Cmd + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSaveProfile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, fullName, phone, dateOfBirth, gender, nationalId, emergencyName, emergencyPhone]);

  // Reset form to initial state
  const handleReset = () => {
    setFullName(initialFormValues.fullName);
    setPhone(initialFormValues.phone);
    setDateOfBirth(initialFormValues.dateOfBirth);
    setGender(initialFormValues.gender);
    setNationalId(initialFormValues.nationalId);
    setEmergencyName(initialFormValues.emergencyName);
    setEmergencyPhone(initialFormValues.emergencyPhone);
    toast.info('Đã khôi phục thông tin gốc', 'Các thay đổi chưa lưu đã được hoàn tác.');
  };

  // Avatar file upload handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Định dạng không hợp lệ', 'Chỉ chấp nhận tập tin hình ảnh (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Tệp quá lớn', 'Kích thước ảnh đại diện không được vượt quá 5MB.');
      return;
    }

    // Instant local preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    // Auto upload to server
    setIsUploadingAvatar(true);
    try {
      const res = await api.uploadMyAvatar(file);
      toast.success('Tải ảnh đại diện thành công!', 'Ảnh đại diện của bạn đã được cập nhật.');
      if (profile) {
        const updated = { ...profile, avatar_url: res.avatar_url };
        setProfile(updated);
        onProfileUpdated?.(updated);
      }
    } catch (err: any) {
      toast.error('Lỗi tải ảnh', err.message || 'Không thể tải lên ảnh đại diện');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Save profile submit handler
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    // Validate VN phone
    const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (phone.trim() && !vnPhoneRegex.test(phone.trim().replace(/[\s\-\.]/g, ''))) {
      toast.warning('Số điện thoại không đúng', 'Vui lòng nhập số điện thoại VN hợp lệ (10 số, đầu 03/05/07/08/09).');
      setIsSaving(false);
      return;
    }
    if (emergencyPhone.trim() && !vnPhoneRegex.test(emergencyPhone.trim().replace(/[\s\-\.]/g, ''))) {
      toast.warning('Số điện thoại khẩn cấp không đúng', 'Vui lòng nhập đúng định dạng số điện thoại Việt Nam.');
      setIsSaving(false);
      return;
    }

    // Validate DOB not in future
    if (dateOfBirth) {
      const today = new Date().toISOString().split('T')[0];
      if (dateOfBirth > today) {
        toast.warning('Ngày sinh không hợp lệ', 'Ngày sinh không thể nằm ở tương lai.');
        setIsSaving(false);
        return;
      }
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

      // Only send national_id if user updated it and it's not the masked placeholder
      if (nationalId && !nationalId.includes('*')) {
        payload.national_id = nationalId.trim();
      }

      const updated = await api.updateMyProfile(payload);
      setProfile(updated);
      setNationalId(updated.national_id_masked || '');

      setInitialFormValues({
        fullName: updated.full_name || '',
        phone: updated.phone || '',
        dateOfBirth: updated.date_of_birth || '',
        gender: (updated.gender as any) || 'male',
        nationalId: updated.national_id_masked || '',
        emergencyName: updated.emergency_contact_name || '',
        emergencyPhone: updated.emergency_contact_phone || '',
      });

      toast.success('Lưu hồ sơ thành công!', 'Thông tin cá nhân của bạn đã được cập nhật.');
      onProfileUpdated?.(updated);
    } catch (err: any) {
      toast.error('Lưu hồ sơ thất bại', err.message || 'Đã có lỗi xảy ra trong quá trình cập nhật');
    } finally {
      setIsSaving(false);
    }
  };

  // Set primary contact for an apartment
  const handleSetPrimary = async (aptId: string) => {
    setSettingPrimaryId(aptId);
    try {
      await api.setPrimaryContact(aptId);
      setApartments((prev) =>
        prev.map((apt) => ({
          ...apt,
          is_primary_contact: apt.apartment_id === aptId,
        }))
      );
      toast.success('Chuyển đổi thành công', 'Đã thiết lập căn hộ làm người liên hệ chính nhận thông báo & hóa đơn.');
      onSelectApartment?.(aptId);
    } catch (err: any) {
      toast.error('Thất bại', err.message || 'Không thể thiết lập người liên hệ chính');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  // Change password submit handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.warning('Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('Mật khẩu quá ngắn', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('Không trùng khớp', 'Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      toast.warning('Trùng mật khẩu cũ', 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success('Đổi mật khẩu thành công!', 'Mật khẩu mới của bạn đã có hiệu lực.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      toast.error('Đổi mật khẩu thất bại', err.message || 'Không thể đổi mật khẩu lúc này');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          color: 'var(--text-secondary)',
        }}
      >
        <Loader2 size={36} className="animate-spin" color="#D96B43" />
        <p style={{ marginTop: '16px', fontSize: '0.9rem', fontWeight: 500 }}>
          Đang tải thông tin hồ sơ của bạn...
        </p>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';
  const roleName = isAdmin ? 'Ban Quản Trị Tòa Nhà' : 'Cư Dân Tòa Nhà';

  return (
    <div
      className="profile-page-container"
      style={{
        maxWidth: '1160px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* 1. Profile Hero Banner (Cover & Identity) */}
      <section
        aria-label="Thông tin tổng quan tài khoản"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid #EFE9DF',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(45, 40, 37, 0.04)',
        }}
      >
        {/* Cover Photo / Biophilic Graphic Header */}
        <div
          style={{
            height: '140px',
            background: 'linear-gradient(135deg, #F5EBE1 0%, #EFE4D6 50%, #E3D4C2 100%)',
            position: 'relative',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
          }}
        >
          {/* Biophilic title */}
          <div
            style={{
              position: 'absolute',
              left: '24px',
              top: '20px',
              color: 'rgba(217, 107, 67, 0.25)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
            }}
          >
            ThanhLe Tower • Không Gian Sống Tiện Nghi
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#4A7C59',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(74, 124, 89, 0.25)',
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '4px 10px',
              }}
            >
              <span className="dot dot-green" style={{ width: 6, height: 6 }} />
              Tài Khoản Hoạt Động
            </span>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#D96B43',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(217, 107, 67, 0.25)',
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '4px 10px',
              }}
            >
              Cư Dân Chính Thức
            </span>
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div
          style={{
            padding: '0 28px 24px',
            marginTop: '-48px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          {/* Avatar & User Details */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
            {/* Avatar with Camera Overlay */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: 'var(--radius-full)',
                  background: '#FFFFFF',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(45, 40, 37, 0.12)',
                  border: '1px solid #EFE9DF',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={fullName || currentUser?.full_name || 'Avatar'}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      objectFit: 'cover',
                    }}
                    onError={() => setAvatarPreview(null)}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: 'linear-gradient(135deg, #FDF7F2, #F8EDE4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: 800,
                      color: '#D96B43',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {(fullName || currentUser?.full_name || '?')[0]?.toUpperCase()}
                  </div>
                )}

                {isUploadingAvatar && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.45)',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                    }}
                  >
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                )}
              </div>

              {/* Upload trigger button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  background: '#D96B43',
                  color: '#FFFFFF',
                  border: '2px solid #FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(217, 107, 67, 0.4)',
                  transition: 'transform 0.15s ease',
                }}
                title="Thay đổi ảnh đại diện (Tối đa 5MB, JPG/PNG/WebP)"
                aria-label="Tải lên ảnh đại diện mới"
              >
                <Camera size={15} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Name & Badges */}
            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                    margin: 0,
                  }}
                >
                  {fullName || currentUser?.full_name || 'Hồ Sơ Cư Dân'}
                </h1>
                <span
                  className="badge"
                  style={{
                    background: isAdmin ? 'rgba(6, 182, 212, 0.12)' : 'rgba(74, 124, 89, 0.12)',
                    color: isAdmin ? '#0284c7' : '#4A7C59',
                    border: isAdmin ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(74, 124, 89, 0.3)',
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    fontWeight: 700,
                  }}
                >
                  {roleName}
                </span>
                {(profile?.is_verified ?? currentUser?.is_verified) && (
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={12} />
                    Đã Xác Thực
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginTop: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={13} color="#8C827A" />
                  {currentUser?.email}
                </span>
                {phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={13} color="#8C827A" />
                    {phone}
                  </span>
                )}
                {currentUser?.apartment_unit && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Home size={13} color="#D96B43" />
                    Căn {currentUser.apartment_unit} {currentUser.building_name ? `• ${currentUser.building_name}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats / Action Status */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isDirty && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: '#D96B43',
                  fontWeight: 600,
                  background: 'rgba(217, 107, 67, 0.08)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(217, 107, 67, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={13} />
                Có thay đổi chưa lưu
              </span>
            )}

            <button
              type="button"
              onClick={() => handleSaveProfile()}
              disabled={isSaving || !isDirty}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: !isDirty ? 0.6 : 1,
                cursor: !isDirty ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Lưu Thay Đổi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Two-Column Layout (Sidebar Navigation + Content Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
        className="profile-grid-layout"
      >
        {/* Left Navigation Rail (Settings Categories) */}
        <aside
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #EFE9DF',
            padding: '12px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            position: 'sticky',
            top: '80px',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Cài Đặt Hồ Sơ
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'personal' ? 'rgba(217, 107, 67, 0.1)' : 'transparent',
                color: activeTab === 'personal' ? '#D96B43' : 'var(--text-primary)',
                fontWeight: activeTab === 'personal' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={16} color={activeTab === 'personal' ? '#D96B43' : '#8C827A'} />
              <span>Thông tin cá nhân</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('apartments')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'apartments' ? 'rgba(217, 107, 67, 0.1)' : 'transparent',
                color: activeTab === 'apartments' ? '#D96B43' : 'var(--text-primary)',
                fontWeight: activeTab === 'apartments' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Home size={16} color={activeTab === 'apartments' ? '#D96B43' : '#8C827A'} />
                <span>Căn hộ liên kết</span>
              </div>
              {apartments.length > 0 && (
                <span
                  style={{
                    background: activeTab === 'apartments' ? '#D96B43' : '#FAF7F2',
                    color: activeTab === 'apartments' ? '#FFFFFF' : 'var(--text-muted)',
                    borderRadius: '12px',
                    padding: '1px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {apartments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('emergency')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'emergency' ? 'rgba(217, 107, 67, 0.1)' : 'transparent',
                color: activeTab === 'emergency' ? '#D96B43' : 'var(--text-primary)',
                fontWeight: activeTab === 'emergency' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <HeartHandshake size={16} color={activeTab === 'emergency' ? '#D96B43' : '#8C827A'} />
              <span>Liên hệ khẩn cấp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'security' ? 'rgba(217, 107, 67, 0.1)' : 'transparent',
                color: activeTab === 'security' ? '#D96B43' : 'var(--text-primary)',
                fontWeight: activeTab === 'security' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <KeyRound size={16} color={activeTab === 'security' ? '#D96B43' : '#8C827A'} />
              <span>Đổi mật khẩu & Bảo mật</span>
            </button>
          </nav>

          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #EFE9DF',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              paddingLeft: '10px',
              paddingRight: '10px',
            }}
          >
            📞 Cần hỗ trợ thay đổi thông tin đặc biệt? Bạn có thể liên hệ trực tiếp quầy Lễ tân sảnh tầng 1 hoặc hotline <strong>1900 6868</strong>.
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === 'personal' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOTION_SPRINGS.gentle}
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #EFE9DF',
                padding: '28px',
                boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
              }}
            >
              <div style={{ marginBottom: '22px', borderBottom: '1px solid #EFE9DF', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Thông Tin Cá Nhân & Liên Lạc
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  Thông tin liên lạc cơ bản để Ban Quản Lý và Lễ tân hỗ trợ gia đình bạn thuận tiện và chu đáo nhất
                </p>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  {/* Họ và tên */}
                  <div>
                    <label
                      htmlFor="profile-full-name"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Họ và tên đầy đủ <span style={{ color: '#fb7185' }}>*</span>
                    </label>
                    <input
                      id="profile-full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn An"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        fontSize: '0.86rem',
                        background: '#FAF7F2',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label
                      htmlFor="profile-phone"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Số điện thoại liên lạc
                    </label>
                    <input
                      id="profile-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912345678 (10 số VN)"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        fontSize: '0.86rem',
                        background: '#FAF7F2',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Số điện thoại gồm 10 chữ số để Ban Quản Lý tiện liên hệ khi cần hỗ trợ
                    </span>
                  </div>

                  {/* Email (Readonly) */}
                  <div>
                    <label
                      htmlFor="profile-email-readonly"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Địa chỉ Email tài khoản
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="profile-email-readonly"
                        type="email"
                        disabled
                        value={currentUser?.email || ''}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          paddingRight: '100px',
                          borderRadius: '8px',
                          border: '1px solid #EFE9DF',
                          fontSize: '0.86rem',
                          background: '#F5EFE6',
                          color: 'var(--text-secondary)',
                          cursor: 'not-allowed',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#4A7C59',
                          background: 'rgba(74, 124, 89, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        Email Đăng Ký
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Email chính dùng để đăng nhập và nhận thông báo từ Ban Quản Lý. Nếu cần thay đổi, bạn vui lòng liên hệ Ban Quản Lý tại sảnh tầng 1.
                    </span>
                  </div>

                  {/* Ngày sinh */}
                  <div>
                    <label
                      htmlFor="profile-dob"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Ngày tháng năm sinh
                    </label>
                    <input
                      id="profile-dob"
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        fontSize: '0.86rem',
                        background: '#FAF7F2',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Giới tính */}
                <div>
                  <label
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}
                  >
                    Giới tính
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { key: 'male', label: 'Nam' },
                      { key: 'female', label: 'Nữ' },
                      { key: 'other', label: 'Khác' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: gender === item.key ? '1px solid #D96B43' : '1px solid #EFE9DF',
                          background: gender === item.key ? 'rgba(217, 107, 67, 0.08)' : '#FAF7F2',
                          color: gender === item.key ? '#D96B43' : 'var(--text-primary)',
                          fontWeight: gender === item.key ? 700 : 500,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={item.key}
                          checked={gender === item.key}
                          onChange={() => setGender(item.key as any)}
                          style={{ accentColor: '#D96B43' }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid #EFE9DF',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || isSaving}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    <RotateCcw size={14} />
                    <span>Hủy thay đổi</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!isDirty || isSaving}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '8px 20px' }}
                  >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>Lưu Thông Tin</span>
                  </button>
                </div>
              </form>
            </motion.section>
          )}

          {/* TAB 2: CĂN HỘ & CƯ TRÚ */}
          {activeTab === 'apartments' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOTION_SPRINGS.gentle}
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #EFE9DF',
                padding: '28px',
                boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ borderBottom: '1px solid #EFE9DF', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Căn Hộ Của Bạn & Thông Tin Cư Trú
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  Danh sách các căn hộ bạn đang sinh sống hoặc sở hữu trong tòa nhà. Bạn có thể chọn căn hộ liên hệ chính để nhận thông báo và hóa đơn sinh hoạt.
                </p>
              </div>

              {/* Explanatory Notice */}
              <div
                style={{
                  background: 'rgba(74, 124, 89, 0.08)',
                  border: '1px solid rgba(74, 124, 89, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '0.8rem',
                  color: '#2D2825',
                  lineHeight: 1.5,
                }}
              >
                <Info size={18} color="#4A7C59" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#4A7C59' }}>Lưu ý về liên hệ chính:</strong> Mỗi căn hộ có một người đại diện liên hệ chính để nhận bảng kê chi phí và các thông báo vận hành từ Ban Quản Lý, giúp gia đình thuận tiện theo dõi và tránh gửi trùng lặp.
                </div>
              </div>

              {/* Apartments List */}
              {apartments.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: '#FAF7F2',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed #EFE9DF',
                  }}
                >
                  <Home size={32} color="#8C827A" style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Bạn chưa được liên kết với căn hộ nào trong tòa nhà
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '4px auto 0' }}>
                    Vui lòng liên hệ với Ban Quản Lý tòa nhà để được gán quyền cư trú hoặc kích hoạt căn hộ mới chuyển đến.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {apartments.map((apt) => {
                    const isPrimary = apt.is_primary_contact;
                    const relationshipLabel =
                      apt.relationship === 'owner'
                        ? 'Chủ Hộ Sở Hữu'
                        : apt.relationship === 'tenant'
                        ? 'Người Thuê Nhà'
                        : apt.relationship === 'family_member'
                        ? 'Thành Viên Gia Đình'
                        : 'Khác';

                    return (
                      <div
                        key={apt.id}
                        style={{
                          borderRadius: 'var(--radius-md)',
                          border: isPrimary ? '1.5px solid #D96B43' : '1px solid #EFE9DF',
                          background: isPrimary ? 'rgba(217, 107, 67, 0.03)' : '#FAF7F2',
                          padding: '18px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '10px',
                              background: isPrimary ? '#D96B43' : '#EFE9DF',
                              color: isPrimary ? '#FFFFFF' : '#5C554E',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                            }}
                          >
                            <Home size={22} />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Căn Hộ {apt.unit_number}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(217, 107, 67, 0.1)',
                                  color: '#D96B43',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              >
                                {relationshipLabel}
                              </span>
                              {isPrimary && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#D96B43',
                                    color: '#FFFFFF',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Star size={11} fill="#FFFFFF" />
                                  Liên Hệ Chính
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              <span>{apt.building_name || 'Tòa nhà chính'}</span>
                              <span style={{ margin: '0 6px' }}>•</span>
                              <span>Tầng {apt.floor_number}</span>
                              {apt.moved_in_at && (
                                <>
                                  <span style={{ margin: '0 6px' }}>•</span>
                                  <span>Dọn đến: {new Date(apt.moved_in_at).toLocaleDateString('vi-VN')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(apt.apartment_id)}
                              disabled={settingPrimaryId === apt.apartment_id}
                              className="btn btn-secondary"
                              style={{
                                fontSize: '0.78rem',
                                padding: '6px 14px',
                                background: '#FFFFFF',
                                border: '1px solid #EFE9DF',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {settingPrimaryId === apt.apartment_id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Star size={13} color="#D96B43" />
                              )}
                              <span>Đặt làm liên hệ chính</span>
                            </button>
                          )}

                          {onSelectApartment && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectApartment(apt.apartment_id);
                                toast.info('Đã chọn căn hộ', `Đang xem thông tin căn hộ ${apt.unit_number}`);
                              }}
                              className="btn btn-ghost"
                              style={{
                                fontSize: '0.78rem',
                                padding: '6px 12px',
                                borderColor: 'var(--border-subtle)',
                              }}
                            >
                              Xem Căn Hộ
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {/* TAB 3: LIÊN HỆ KHẨN CẤP */}
          {activeTab === 'emergency' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOTION_SPRINGS.gentle}
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #EFE9DF',
                padding: '28px',
                boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
              }}
            >
              <div style={{ marginBottom: '22px', borderBottom: '1px solid #EFE9DF', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Thông Tin Liên Hệ Khẩn Cấp
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  Người thân gia đình mà Ban Quản Lý sẽ liên hệ khi căn hộ có sự cố hoặc tình huống cần hỗ trợ khẩn cấp
                </p>
              </div>

              {/* An tâm note */}
              <div
                style={{
                  background: 'rgba(217, 107, 67, 0.06)',
                  border: '1px solid rgba(217, 107, 67, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                <HeartHandshake size={20} color="#D96B43" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#D96B43' }}>Cam kết an tâm & bảo mật:</strong> Thông tin liên hệ khẩn cấp được lưu trữ hoàn toàn riêng biệt và bảo mật cao. Ban Quản Lý chỉ sử dụng số điện thoại này trong các tình huống khẩn cấp (như cảnh báo cháy, sự cố rò rỉ khí gas/nước nghiêm trọng, hoặc cấp cứu y tế tại căn hộ).
                </div>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  {/* Họ tên người liên hệ khẩn cấp */}
                  <div>
                    <label
                      htmlFor="profile-emergency-name"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Họ tên người liên hệ khẩn cấp
                    </label>
                    <input
                      id="profile-emergency-name"
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Ví dụ: Trần Thị Bình (Vợ/Chồng/Bố mẹ)"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        fontSize: '0.86rem',
                        background: '#FAF7F2',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  {/* Số điện thoại khẩn cấp */}
                  <div>
                    <label
                      htmlFor="profile-emergency-phone"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                    >
                      Số điện thoại khẩn cấp
                    </label>
                    <input
                      id="profile-emergency-phone"
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="0987654321"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        fontSize: '0.86rem',
                        background: '#FAF7F2',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Nên là số điện thoại luôn giữ liên lạc của người thân trong gia đình
                    </span>
                  </div>
                </div>

                {/* Save controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid #EFE9DF',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || isSaving}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    <RotateCcw size={14} />
                    <span>Hủy</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!isDirty || isSaving}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '8px 20px' }}
                  >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>Lưu Thông Tin Khẩn Cấp</span>
                  </button>
                </div>
              </form>
            </motion.section>
          )}

          {/* TAB 4: BẢO MẬT & ĐỊNH DANH */}
          {activeTab === 'security' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOTION_SPRINGS.gentle}
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #EFE9DF',
                padding: '28px',
                boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <div style={{ borderBottom: '1px solid #EFE9DF', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Bảo Mật & Giấy Tờ Tùy Thân
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  Quản lý thông tin định danh và bảo vệ an toàn cho tài khoản cư dân của bạn
                </p>
              </div>

              {/* Masked National ID Section */}
              <div
                style={{
                  background: '#FAF7F2',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #EFE9DF',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <ShieldCheck size={20} color="#4A7C59" />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Căn Cước Công Dân (CCCD / CMND)
                  </h3>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Thông tin dùng để đối chiếu khi làm thẻ cư dân, thẻ ra vào thang máy và đăng ký phương tiện gửi xe. Để bảo vệ sự riêng tư của gia đình, các chữ số ở giữa được tự động ẩn khi hiển thị.
                </p>

                <div style={{ marginTop: '14px', maxWidth: '340px' }}>
                  <label
                    htmlFor="profile-national-id"
                    style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                  >
                    Số CCCD / CMND
                  </label>
                  <input
                    id="profile-national-id"
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="037***1234 (Nhập số mới để cập nhật)"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      fontSize: '0.86rem',
                      fontFamily: 'var(--font-mono)',
                      background: '#FFFFFF',
                      color: 'var(--text-primary)',
                      letterSpacing: '0.05em',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Nhập 12 chữ số mới nếu bạn muốn cập nhật thông tin đối chiếu với Ban Quản Lý
                  </span>
                </div>
              </div>

              {/* Account Security Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #EFE9DF',
                    background: '#FAF7F2',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={15} color="#D96B43" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Mật khẩu đăng nhập
                        </span>
                      </div>
                      <span className="badge badge-healthy" style={{ fontSize: '0.7rem' }}>
                        ✓ Đang bảo vệ
                      </span>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                      Mật khẩu được lưu trữ an toàn. Mật khẩu mặc định hệ thống: <strong>123456</strong>
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.78rem',
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#FFFFFF',
                        border: '1px solid #E2D9CB',
                      }}
                    >
                      <KeyRound size={13} color="#D96B43" />
                      <span>{showPasswordForm ? 'Đóng biểu mẫu' : 'Đổi Mật Khẩu'}</span>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #EFE9DF',
                    background: '#FAF7F2',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircle2 size={15} color="#4A7C59" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Trạng thái tài khoản
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                    Tài khoản cư dân chính thức của tòa nhà ThanhLe Tower, đã sẵn sàng sử dụng
                  </p>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(74, 124, 89, 0.12)',
                      color: '#4A7C59',
                      border: '1px solid rgba(74, 124, 89, 0.25)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Đang hoạt động
                  </span>
                </div>
              </div>

              {/* Change Password Form (Accordion / Collapsible Section) */}
              {showPasswordForm && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={MOTION_SPRINGS.gentle}
                  style={{
                    background: '#FAF7F2',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid rgba(217, 107, 67, 0.35)',
                    padding: '22px',
                    boxShadow: '0 4px 16px rgba(217, 107, 67, 0.07)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <KeyRound size={18} color="#D96B43" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Thay Đổi Mật Khẩu Đăng Nhập
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
                    Mật khẩu mới yêu cầu tối thiểu 6 ký tự. Nếu tài khoản chưa đổi mật khẩu lần nào, mật khẩu hiện tại là <strong>123456</strong>.
                  </p>

                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      {/* Mật khẩu hiện tại */}
                      <div>
                        <label
                          htmlFor="change-current-pwd"
                          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                        >
                          Mật khẩu hiện tại <span style={{ color: '#fb7185' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="change-current-pwd"
                            type={showCurrentPassword ? 'text' : 'password'}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Mật khẩu hiện tại (VD: 123456)"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              paddingRight: '38px',
                              borderRadius: '8px',
                              border: '1px solid #EFE9DF',
                              fontSize: '0.86rem',
                              background: '#FFFFFF',
                              color: 'var(--text-primary)',
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
                              color: '#8C827A',
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

                      {/* Mật khẩu mới */}
                      <div>
                        <label
                          htmlFor="change-new-pwd"
                          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                        >
                          Mật khẩu mới (Tối thiểu 6 ký tự) <span style={{ color: '#fb7185' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="change-new-pwd"
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
                              background: '#FFFFFF',
                              color: 'var(--text-primary)',
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
                              color: '#8C827A',
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

                      {/* Xác nhận mật khẩu mới */}
                      <div>
                        <label
                          htmlFor="change-confirm-pwd"
                          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
                        >
                          Xác nhận mật khẩu mới <span style={{ color: '#fb7185' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="change-confirm-pwd"
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
                              background: '#FFFFFF',
                              color: 'var(--text-primary)',
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
                              color: '#8C827A',
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
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                      >
                        Hủy Bỏ
                      </button>
                      <button
                        type="submit"
                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '7px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isChangingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>Cập Nhật Mật Khẩu</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Save trigger if CCCD updated */}
              {isDirty && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid #EFE9DF',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || isSaving}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    <RotateCcw size={14} />
                    <span>Hủy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveProfile()}
                    disabled={!isDirty || isSaving}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '8px 20px' }}
                  >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>Lưu Thay Đổi</span>
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </main>
      </div>
    </div>
  );
};
