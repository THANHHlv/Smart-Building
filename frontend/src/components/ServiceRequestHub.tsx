import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  Loader2,
  Sparkles,
  Truck,
  Users,
  Wrench,
  X,
  AlertCircle,
  ChevronRight,
  CalendarCheck,
  Ban,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Amenity,
  AmenityBooking,
  AmenitySlotsResponse,
  ServiceRequest,
  ServiceRequestType,
  UserProfile,
} from '../types';

interface ServiceRequestHubProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  currentUser: UserProfile | null;
  onRefreshNeeded?: () => void;
  onSuccess?: () => void;
}

type MainTab = 'create_request' | 'book_amenity' | 'history';

export const ServiceRequestHub: React.FC<ServiceRequestHubProps> = ({
  isOpen,
  onClose,
  asPage = false,
  currentUser,
  onRefreshNeeded,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('create_request');
  const [selectedCategory, setSelectedCategory] = useState<ServiceRequestType | null>(null);

  // Form states for service requests
  const [cleaningPackage, setCleaningPackage] = useState<'standard' | 'deep_clean'>('standard');
  const [cleaningHours, setCleaningHours] = useState('2');
  const [hasPets, setHasPets] = useState(false);

  const [maintenanceDevice, setMaintenanceDevice] = useState('air_conditioner');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');

  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'electric_bike'>('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [registrationType, setRegistrationType] = useState<'new' | 'update_plate'>('new');

  const [cardType, setCardType] = useState<'resident' | 'elevator' | 'parking'>('resident');
  const [cardQuantity, setCardQuantity] = useState('1');
  const [cardReason, setCardReason] = useState<'lost' | 'damaged' | 'additional'>('lost');

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledSlot, setScheduledSlot] = useState('08:00 - 10:00');
  const [generalNotes, setGeneralNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);

  // Amenity Booking states
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [slotsData, setSlotsData] = useState<AmenitySlotsResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [amenityNotes, setAmenityNotes] = useState('');

  // History state
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [myBookings, setMyBookings] = useState<AmenityBooking[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Load amenities list
  useEffect(() => {
    if (!isOpen && !asPage) return;
    const fetchAmenities = async () => {
      try {
        const res = await api.getAmenities();
        setAmenities(res);
        if (res.length > 0 && !selectedAmenityId) {
          setSelectedAmenityId(res[0].id);
        }
      } catch (err) {
        console.error('Failed to load amenities:', err);
      }
    };
    fetchAmenities();
  }, [isOpen, asPage]);

  // Load available slots when amenity or date changes
  useEffect(() => {
    if (!isOpen || !selectedAmenityId || !bookingDate) return;
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        const res = await api.getAmenityAvailableSlots(selectedAmenityId, bookingDate);
        setSlotsData(res);
      } catch (err) {
        console.error('Failed to fetch slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [isOpen, selectedAmenityId, bookingDate]);

  // Load History
  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const [reqs, bks] = await Promise.all([
        api.getMyServiceRequests(),
        api.getMyAmenityBookings(),
      ]);
      setMyRequests(reqs);
      setMyBookings(bks);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if ((isOpen || asPage) && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, asPage, activeTab]);

  if (!isOpen && !asPage) return null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setSubmitting(true);
    setSubmitErrorMsg(null);
    setSubmitSuccessMsg(null);

    let title = '';
    let description = '';
    let notes: Record<string, any> = {};

    if (selectedCategory === 'cleaning') {
      title = `Đặt lịch dọn vệ sinh căn hộ (${cleaningPackage === 'deep_clean' ? 'Tổng vệ sinh' : 'Dọn dẹp theo giờ'})`;
      description = `Cư dân đặt lịch dọn dẹp ${cleaningHours} giờ vào khung giờ ${scheduledSlot}. ${generalNotes}`;
      notes = { package: cleaningPackage, hours: cleaningHours, has_pets: hasPets, extra: generalNotes };
    } else if (selectedCategory === 'periodic_maintenance') {
      const devNameMap: Record<string, string> = {
        air_conditioner: 'Điều hòa nhiệt độ',
        water_heater: 'Bình nước nóng',
        water_filter: 'Lưới lọc & van nước',
        electrical: 'Aptomat & hệ thống chiếu sáng',
      };
      title = `Bảo trì định kỳ: ${devNameMap[maintenanceDevice] || maintenanceDevice}`;
      description = maintenanceDescription || `Yêu cầu kiểm tra, bảo dưỡng định kỳ thiết bị ${devNameMap[maintenanceDevice] || maintenanceDevice}`;
      notes = { device_type: maintenanceDevice, extra: generalNotes };
    } else if (selectedCategory === 'vehicle_registration') {
      const vTypeMap = { car: 'Ô tô', motorcycle: 'Xe máy', electric_bike: 'Xe đạp điện' };
      title = `Đăng ký gửi xe (${vTypeMap[vehicleType]}): Biển số ${licensePlate.toUpperCase()}`;
      description = `Đăng ký ${registrationType === 'new' ? 'gửi xe mới' : 'đổi biển số'} loại xe ${vTypeMap[vehicleType]}, nhãn hiệu: ${vehicleBrand}.`;
      notes = { vehicle_type: vehicleType, license_plate: licensePlate.toUpperCase(), brand: vehicleBrand, reg_type: registrationType };
    } else if (selectedCategory === 'access_card') {
      const cTypeMap = { resident: 'Thẻ cư dân', elevator: 'Thẻ thang máy', parking: 'Thẻ gửi xe' };
      const reasonMap = { lost: 'Bị mất', damaged: 'Hư hỏng/gãy', additional: 'Cấp thêm cho người nhà' };
      title = `Yêu cầu cấp lại: ${cardQuantity} ${cTypeMap[cardType]}`;
      description = `Lý do cấp lại: ${reasonMap[cardReason]}. Số lượng: ${cardQuantity}. ${generalNotes}`;
      notes = { card_type: cardType, quantity: cardQuantity, reason: cardReason, extra: generalNotes };
    }

    try {
      await api.createServiceRequest({
        request_type: selectedCategory,
        title,
        description,
        scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        scheduled_slot: scheduledSlot,
        notes,
      });
      setSubmitSuccessMsg('Yêu cầu dịch vụ đã được gửi đến Ban Quản Lý thành công!');
      setSelectedCategory(null);
      setGeneralNotes('');
      if (onRefreshNeeded) onRefreshNeeded();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSubmitErrorMsg(err.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenityId || !selectedSlot || !bookingDate) return;

    setSubmitting(true);
    setSubmitErrorMsg(null);
    setSubmitSuccessMsg(null);

    try {
      await api.createAmenityBooking(selectedAmenityId, {
        booking_date: bookingDate,
        time_slot: selectedSlot,
        notes: amenityNotes,
      });
      setSubmitSuccessMsg(`Đặt tiện ích thành công cho khung giờ ${selectedSlot} ngày ${bookingDate}!`);
      setSelectedSlot(null);
      setAmenityNotes('');
      // Refresh slots
      const res = await api.getAmenityAvailableSlots(selectedAmenityId, bookingDate);
      setSlotsData(res);
      if (onRefreshNeeded) onRefreshNeeded();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSubmitErrorMsg(err.message || 'Đặt chỗ thất bại hoặc slot đã có người đặt trước.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn huỷ lịch đặt tiện ích này? Khung giờ sẽ được giải phóng cho cư dân khác.')) {
      return;
    }
    setCancellingBookingId(bookingId);
    try {
      await api.cancelAmenityBooking(bookingId);
      await loadHistory();
      if (selectedAmenityId) {
        const res = await api.getAmenityAvailableSlots(selectedAmenityId, bookingDate);
        setSlotsData(res);
      }
      if (onRefreshNeeded) onRefreshNeeded();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Không thể huỷ lịch đặt.');
    } finally {
      setCancellingBookingId(null);
    }
  };

  const content = (
    <div
      className="page-view-container animate-fade-in"
      style={{
        width: '100%',
        maxWidth: asPage ? '100%' : '920px',
        maxHeight: asPage ? 'none' : '92vh',
        minHeight: asPage ? 'calc(100vh - 160px)' : undefined,
        backgroundColor: '#FBF9F5',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid #EFE9DF',
        boxShadow: asPage ? '0 2px 12px rgba(45, 40, 37, 0.05)' : '0 24px 64px rgba(45, 40, 37, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#2D2825',
        fontFamily: 'var(--font-sans)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2
                id="service-hub-title"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  color: '#2D2825',
                }}
              >
                Yêu Cầu & Đặt Lịch Tiện Ích
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6F6861' }}>
                Không gian sống tiện nghi • Tự phục vụ 24/7 cho căn hộ {currentUser?.apartment_unit || ''}
              </p>
            </div>
          </div>
          {!asPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#8E867E',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #EFE9DF',
            background: '#F3EEE5',
            padding: '0 24px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveTab('create_request'); setSelectedCategory(null); }}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'create_request' ? '3px solid #D96B43' : '3px solid transparent',
              color: activeTab === 'create_request' ? '#D96B43' : '#6F6861',
              fontWeight: activeTab === 'create_request' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Wrench size={16} />
            <span>Yêu Cầu Dịch Vụ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('book_amenity')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'book_amenity' ? '3px solid #D96B43' : '3px solid transparent',
              color: activeTab === 'book_amenity' ? '#D96B43' : '#6F6861',
              fontWeight: activeTab === 'book_amenity' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Calendar size={16} />
            <span>Đặt Tiện Ích Chung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #D96B43' : '3px solid transparent',
              color: activeTab === 'history' ? '#D96B43' : '#6F6861',
              fontWeight: activeTab === 'history' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Clock size={16} />
            <span>Lịch Sử Của Tôi</span>
          </button>
        </div>

        {/* Global Notifications inside Modal */}
        {submitSuccessMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(74, 124, 89, 0.12)',
              border: '1px solid rgba(74, 124, 89, 0.3)',
              color: '#4A7C59',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{submitSuccessMsg}</span>
          </div>
        )}

        {submitErrorMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(200, 82, 82, 0.12)',
              border: '1px solid rgba(200, 82, 82, 0.3)',
              color: '#C85252',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={18} />
            <span>{submitErrorMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* TAB 1: SERVICE REQUESTS */}
          {activeTab === 'create_request' && (
            <div>
              {!selectedCategory ? (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: '#2D2825' }}>
                    Chọn loại dịch vụ bạn muốn yêu cầu:
                  </h3>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {/* Card 1: Vệ sinh */}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('cleaning')}
                      style={{
                        padding: '20px',
                        background: '#FFFFFF',
                        border: '1px solid #EFE9DF',
                        borderRadius: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        boxShadow: '0 4px 12px rgba(45, 40, 37, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#D96B43';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#EFE9DF';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          background: 'rgba(67, 122, 130, 0.1)',
                          color: '#437A82',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Droplets size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#2D2825' }}>
                          Dọn Vệ Sinh Căn Hộ
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6F6861', lineHeight: 1.4 }}>
                          Dọn dẹp theo giờ, tổng vệ sinh định kỳ, lau kính và hút bụi nệm sofa.
                        </p>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#D96B43', fontWeight: 600 }}>
                        <span>Tạo yêu cầu</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>

                    {/* Card 2: Bảo trì định kỳ */}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('periodic_maintenance')}
                      style={{
                        padding: '20px',
                        background: '#FFFFFF',
                        border: '1px solid #EFE9DF',
                        borderRadius: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        boxShadow: '0 4px 12px rgba(45, 40, 37, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#D96B43';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#EFE9DF';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          background: 'rgba(74, 124, 89, 0.1)',
                          color: '#4A7C59',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Wrench size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#2D2825' }}>
                          Bảo Trì Thiết Bị Định Kỳ
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6F6861', lineHeight: 1.4 }}>
                          Bảo dưỡng điều hòa, súc rửa bình nước nóng, kiểm tra lưới lọc van nước.
                        </p>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#D96B43', fontWeight: 600 }}>
                        <span>Tạo yêu cầu</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>

                    {/* Card 3: Gửi xe */}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('vehicle_registration')}
                      style={{
                        padding: '20px',
                        background: '#FFFFFF',
                        border: '1px solid #EFE9DF',
                        borderRadius: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        boxShadow: '0 4px 12px rgba(45, 40, 37, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#D96B43';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#EFE9DF';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          background: 'rgba(217, 107, 67, 0.1)',
                          color: '#D96B43',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Truck size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#2D2825' }}>
                          Đăng Ký Gửi Xe
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6F6861', lineHeight: 1.4 }}>
                          Đăng ký thêm slot xe mới, cập nhật đổi biển số xe ô tô hoặc xe máy.
                        </p>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#D96B43', fontWeight: 600 }}>
                        <span>Tạo yêu cầu</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>

                    {/* Card 4: Thẻ cư dân */}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('access_card')}
                      style={{
                        padding: '20px',
                        background: '#FFFFFF',
                        border: '1px solid #EFE9DF',
                        borderRadius: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        boxShadow: '0 4px 12px rgba(45, 40, 37, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#D96B43';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#EFE9DF';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          background: 'rgba(184, 115, 25, 0.1)',
                          color: '#B87319',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#2D2825' }}>
                          Cấp Lại Thẻ Ra Vào
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6F6861', lineHeight: 1.4 }}>
                          Yêu cầu cấp lại thẻ thang máy, thẻ xe bị mất hoặc cấp thêm cho người thân.
                        </p>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#D96B43', fontWeight: 600 }}>
                        <span>Tạo yêu cầu</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Dedicated Form Per Service */
                <form onSubmit={handleCreateServiceRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#D96B43',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ← Chọn dịch vụ khác
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#6F6861' }}>
                      Căn hộ thụ hưởng: <strong>{currentUser?.apartment_unit || 'Chưa gán'}</strong>
                    </span>
                  </div>

                  {/* FORM 1: Dọn vệ sinh */}
                  {selectedCategory === 'cleaning' && (
                    <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #EFE9DF' }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                        Dọn Vệ Sinh Căn Hộ
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Gói vệ sinh
                          </label>
                          <select
                            value={cleaningPackage}
                            onChange={(e) => setCleaningPackage(e.target.value as any)}
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
                            <option value="standard">Dọn dẹp tiêu chuẩn theo giờ</option>
                            <option value="deep_clean">Tổng vệ sinh chuyên sâu toàn diện</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Thời lượng ước tính
                          </label>
                          <select
                            value={cleaningHours}
                            onChange={(e) => setCleaningHours(e.target.value)}
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
                            <option value="2">2 Giờ (Căn 1-2 phòng ngủ)</option>
                            <option value="3">3 Giờ (Căn 2-3 phòng ngủ)</option>
                            <option value="4">4 Giờ (Tổng vệ sinh sâu)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#2D2825', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={hasPets}
                            onChange={(e) => setHasPets(e.target.checked)}
                            style={{ accentColor: '#D96B43', width: 16, height: 16 }}
                          />
                          <span>Căn hộ có nuôi thú cưng (chó, mèo) để nhân viên chuẩn bị máy hút lông chuyên dụng</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* FORM 2: Bảo trì định kỳ */}
                  {selectedCategory === 'periodic_maintenance' && (
                    <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #EFE9DF' }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                        Bảo Trì Thiết Bị Định Kỳ
                      </h4>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                          Hạng mục thiết bị cần bảo dưỡng
                        </label>
                        <select
                          value={maintenanceDevice}
                          onChange={(e) => setMaintenanceDevice(e.target.value)}
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
                          <option value="air_conditioner">Điều hòa nhiệt độ (Vệ sinh dàn lạnh, bơm gas)</option>
                          <option value="water_heater">Bình nóng lạnh (Súc rửa cặn, kiểm tra rơ le chống giật)</option>
                          <option value="water_filter">Hệ thống van nước, lưới lọc đầu vòi sen</option>
                          <option value="electrical">Kiểm tra tủ điện, aptomat và ổ cắm công suất lớn</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                          Mô tả tình trạng hiện tại
                        </label>
                        <textarea
                          value={maintenanceDescription}
                          onChange={(e) => setMaintenanceDescription(e.target.value)}
                          rows={3}
                          placeholder="Ví dụ: Điều hòa phòng khách làm lạnh hơi chậm, phát ra tiếng kêu nhẹ ở cánh gió gió..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                            background: '#FBF9F5',
                            fontSize: '0.88rem',
                            color: '#2D2825',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* FORM 3: Đăng ký xe */}
                  {selectedCategory === 'vehicle_registration' && (
                    <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #EFE9DF' }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                        Đăng Ký Gửi Xe & Cập Nhật Biển Số
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Loại phương tiện
                          </label>
                          <select
                            value={vehicleType}
                            onChange={(e) => setVehicleType(e.target.value as any)}
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
                            <option value="motorcycle">Xe máy (xăng / điện)</option>
                            <option value="car">Xe ô tô 4-7 chỗ</option>
                            <option value="electric_bike">Xe đạp điện</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Hình thức đăng ký
                          </label>
                          <select
                            value={registrationType}
                            onChange={(e) => setRegistrationType(e.target.value as any)}
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
                            <option value="new">Đăng ký chỗ gửi xe mới</option>
                            <option value="update_plate">Đổi biển số xe đã đăng ký</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Biển số xe *
                          </label>
                          <input
                            type="text"
                            required
                            value={licensePlate}
                            onChange={(e) => setLicensePlate(e.target.value)}
                            placeholder="Ví dụ: 51A-987.65"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #EFE9DF',
                              background: '#FBF9F5',
                              fontSize: '0.88rem',
                              color: '#2D2825',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Hãng xe / Màu xe
                          </label>
                          <input
                            type="text"
                            value={vehicleBrand}
                            onChange={(e) => setVehicleBrand(e.target.value)}
                            placeholder="Ví dụ: Honda SH màu xám xi măng"
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
                    </div>
                  )}

                  {/* FORM 4: Cấp lại thẻ */}
                  {selectedCategory === 'access_card' && (
                    <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #EFE9DF' }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#2D2825' }}>
                        Cấp Lại Thẻ Cư Dân / Thang Máy
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Loại thẻ cần cấp
                          </label>
                          <select
                            value={cardType}
                            onChange={(e) => setCardType(e.target.value as any)}
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
                            <option value="resident">Thẻ từ cư dân (Vào cổng + sảnh)</option>
                            <option value="elevator">Thẻ thang máy phân tầng</option>
                            <option value="parking">Thẻ gửi xe ô tô/xe máy</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                            Số lượng
                          </label>
                          <select
                            value={cardQuantity}
                            onChange={(e) => setCardQuantity(e.target.value)}
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
                            <option value="1">1 Thẻ</option>
                            <option value="2">2 Thẻ</option>
                            <option value="3">3 Thẻ</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                          Lý do yêu cầu
                        </label>
                        <select
                          value={cardReason}
                          onChange={(e) => setCardReason(e.target.value as any)}
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
                          <option value="lost">Bị mất thẻ (Cần khóa thẻ cũ để đảm bảo an ninh)</option>
                          <option value="damaged">Thẻ bị nứt vỡ hoặc chập chip từ không quẹt được</option>
                          <option value="additional">Đăng ký thêm thẻ cho thành viên mới trong gia đình</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Common Scheduling Row */}
                  <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #EFE9DF' }}>
                    <h5 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700, color: '#2D2825' }}>
                      Thời Gian Thuận Tiện & Ghi Chú Thêm
                    </h5>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                          Ngày hẹn mong muốn
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
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

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                          Khung giờ thuận tiện
                        </label>
                        <select
                          value={scheduledSlot}
                          onChange={(e) => setScheduledSlot(e.target.value)}
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
                          <option value="08:00 - 10:00">08:00 - 10:00 (Đầu giờ sáng)</option>
                          <option value="10:00 - 12:00">10:00 - 12:00 (Cuối buổi sáng)</option>
                          <option value="14:00 - 16:00">14:00 - 16:00 (Đầu giờ chiều)</option>
                          <option value="16:00 - 18:00">16:00 - 18:00 (Cuối buổi chiều)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                        Ghi chú bổ sung cho BQL / Kỹ thuật viên
                      </label>
                      <input
                        type="text"
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                        placeholder="Ví dụ: Vui lòng gọi điện trước khi lên căn hộ 10 phút..."
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

                  {/* Submit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        background: '#FFFFFF',
                        color: '#6F6861',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                      }}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#D96B43',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(217, 107, 67, 0.3)',
                      }}
                    >
                      {submitting && <Loader2 size={16} className="animate-spin" />}
                      <span>Gửi Yêu Cầu</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: AMENITY BOOKINGS */}
          {activeTab === 'book_amenity' && (
            <div>
              {/* Step 1: Amenity Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#2D2825', marginBottom: '10px' }}>
                  1. Chọn tiện ích cộng đồng:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {amenities.map((item) => {
                    const isSelected = selectedAmenityId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedAmenityId(item.id)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #D96B43' : '1px solid #EFE9DF',
                          background: isSelected ? 'rgba(217, 107, 67, 0.06)' : '#FFFFFF',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#D96B43' : '#2D2825' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#6F6861', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={12} />
                          <span>Sức chứa: {item.capacity} người</span>
                        </div>
                        {item.requires_approval ? (
                          <span style={{ fontSize: '0.7rem', color: '#B87319', fontWeight: 600 }}>
                            Cần BQL duyệt
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#4A7C59', fontWeight: 600 }}>
                            Xác nhận tự động tức thì
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Date Selector */}
              <div style={{ marginBottom: '20px', background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #EFE9DF' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#2D2825', marginBottom: '8px' }}>
                  2. Chọn ngày sử dụng tiện ích:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBookingDate(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                      background: '#FBF9F5',
                      fontSize: '0.88rem',
                      color: '#2D2825',
                      fontWeight: 600,
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#6F6861' }}>
                    Slot còn trống hiển thị sáng màu. Slot đã kín được làm mờ và khóa chọn.
                  </span>
                </div>
              </div>

              {/* Step 3: Interactive Slot Grid (Restaurant-Style Availability) */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825' }}>
                    3. Lịch khung giờ (Slot Matrix):
                  </label>
                  {loadingSlots && <span style={{ fontSize: '0.78rem', color: '#6F6861' }}>Đang tải trạng thái slot...</span>}
                </div>

                {slotsData ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {slotsData.slots.map((slot) => {
                      const isSelected = selectedSlot === slot.time_slot;
                      const isAvailable = slot.is_available;

                      return (
                        <button
                          key={slot.time_slot}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedSlot(slot.time_slot)}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            border: isSelected
                              ? '2px solid #D96B43'
                              : isAvailable
                              ? '1px solid rgba(74, 124, 89, 0.4)'
                              : '1px solid #EFE9DF',
                            background: isSelected
                              ? 'rgba(217, 107, 67, 0.12)'
                              : isAvailable
                              ? '#FFFFFF'
                              : '#F3EEE5',
                            opacity: isAvailable ? 1 : 0.6,
                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isAvailable ? '#2D2825' : '#8E867E' }}>
                              {slot.time_slot}
                            </span>
                            {isAvailable ? (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4A7C59' }} />
                            ) : (
                              <Ban size={14} color="#8E867E" />
                            )}
                          </div>

                          <div style={{ fontSize: '0.76rem' }}>
                            {isAvailable ? (
                              <span style={{ color: '#4A7C59', fontWeight: 600 }}>Còn trống • Nhấp để đặt</span>
                            ) : slot.is_own_booking ? (
                              <span style={{ color: '#D96B43', fontWeight: 600 }}>Lịch đặt của bạn</span>
                            ) : (
                              <span style={{ color: '#8E867E' }}>Đã kín slot</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#6F6861' }}>
                    Chọn tiện ích và ngày để kiểm tra lịch khung giờ
                  </div>
                )}
              </div>

              {/* Step 4: Confirm Booking Panel */}
              {selectedSlot && (
                <form
                  onSubmit={handleBookAmenity}
                  style={{
                    background: '#FFFFFF',
                    padding: '20px',
                    borderRadius: '14px',
                    border: '1px solid rgba(217, 107, 67, 0.35)',
                    boxShadow: '0 8px 24px rgba(217, 107, 67, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarCheck size={18} color="#D96B43" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2D2825' }}>
                        Xác nhận đặt: {slotsData?.amenity_name} — Khung giờ {selectedSlot}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#6F6861' }}>
                      Ngày: <strong>{bookingDate}</strong>
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6F6861', marginBottom: '6px' }}>
                      Mục đích sử dụng / Ghi chú cho ban quản lý
                    </label>
                    <input
                      type="text"
                      value={amenityNotes}
                      onChange={(e) => setAmenityNotes(e.target.value)}
                      placeholder="Ví dụ: Họp hội đồng cư dân tầng 4, liên hoan gia đình..."
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #EFE9DF',
                        background: '#FFFFFF',
                        color: '#6F6861',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Bỏ chọn slot
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '8px 22px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#D96B43',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(217, 107, 67, 0.25)',
                      }}
                    >
                      {submitting && <Loader2 size={15} className="animate-spin" />}
                      <span>Xác Nhận Giữ Chỗ</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6F6861' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <div>Đang tải lịch sử yêu cầu & đặt lịch...</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Amenity Reservations Section */}
                  <div>
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.96rem', fontWeight: 700, color: '#2D2825' }}>
                      Lịch Đặt Tiện Ích Cộng Đồng ({myBookings.length})
                    </h4>

                    {myBookings.length === 0 ? (
                      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', textAlign: 'center', color: '#6F6861', border: '1px solid #EFE9DF' }}>
                        Chưa có lịch đặt tiện ích nào. Bạn có thể sang tab "Đặt Tiện Ích Chung" để chọn khung giờ.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myBookings.map((b) => {
                          const isCancelled = b.status === 'cancelled';
                          const statusColor =
                            b.status === 'confirmed' ? '#4A7C59' : b.status === 'pending' ? '#B87319' : '#8E867E';

                          return (
                            <div
                              key={b.id}
                              style={{
                                background: '#FFFFFF',
                                padding: '14px 18px',
                                borderRadius: '12px',
                                border: '1px solid #EFE9DF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#2D2825' }}>
                                  {b.amenity_name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6F6861', marginTop: '2px' }}>
                                  Ngày: <strong>{b.booking_date}</strong> • Khung giờ: <strong>{b.time_slot}</strong>
                                  {b.notes && <span> • "{b.notes}"</span>}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    background: isCancelled ? '#F3EEE5' : 'rgba(74, 124, 89, 0.1)',
                                    color: statusColor,
                                  }}
                                >
                                  {b.status === 'confirmed' ? 'Đã xác nhận' : b.status === 'pending' ? 'Chờ duyệt' : 'Đã huỷ'}
                                </span>

                                {!isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelBooking(b.id)}
                                    disabled={cancellingBookingId === b.id}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #EFE9DF',
                                      background: '#FFFFFF',
                                      color: '#C85252',
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {cancellingBookingId === b.id ? 'Đang huỷ...' : 'Huỷ lịch'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Service Requests Section */}
                  <div>
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.96rem', fontWeight: 700, color: '#2D2825' }}>
                      Yêu Cầu Dịch Vụ Căn Hộ ({myRequests.length})
                    </h4>

                    {myRequests.length === 0 ? (
                      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', textAlign: 'center', color: '#6F6861', border: '1px solid #EFE9DF' }}>
                        Chưa có yêu cầu dịch vụ tự phục vụ nào được tạo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myRequests.map((r) => {
                          const statusBg =
                            r.ticket_status === 'resolved' || r.ticket_status === 'closed'
                              ? 'rgba(74, 124, 89, 0.1)'
                              : 'rgba(217, 107, 67, 0.1)';
                          const statusColor =
                            r.ticket_status === 'resolved' || r.ticket_status === 'closed'
                              ? '#4A7C59'
                              : '#D96B43';

                          return (
                            <div
                              key={r.id}
                              style={{
                                background: '#FFFFFF',
                                padding: '14px 18px',
                                borderRadius: '12px',
                                border: '1px solid #EFE9DF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#2D2825' }}>
                                  {r.ticket_title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6F6861', marginTop: '2px' }}>
                                  Khung giờ hẹn: <strong>{r.scheduled_slot || 'Linh hoạt'}</strong>
                                  {r.technician_name && (
                                    <span> • Kỹ thuật viên phụ trách: <strong>{r.technician_name}</strong></span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    background: statusBg,
                                    color: statusColor,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {r.ticket_status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );

  if (asPage) return content;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-hub-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(45, 40, 37, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {content}
    </div>
  );
};
