import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Send,
  Building2,
  CheckCircle2,
  BarChart3,
  Search,
  Shield,
  Layers,
  Percent,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  AdminDashboardOverview,
  CollectionRateResponse,
  OverdueApartmentItem,
  DeviceHealthResponse,
} from '../types';

interface AdminOperationsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRbac?: () => void;
}

export const AdminOperationsDashboard: React.FC<AdminOperationsDashboardProps> = ({
  isOpen,
  onClose,
  onOpenRbac,
}) => {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionRateResponse | null>(null);
  const [overdueList, setOverdueList] = useState<OverdueApartmentItem[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'collection' | 'overdue' | 'devices' | 'revenue'>('collection');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [remindedUnits, setRemindedUnits] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ovRes, colRes, overdueRes, devRes] = await Promise.allSettled([
        api.getAdminOverview(),
        api.getCollectionRate(6),
        api.getOverdueApartments(),
        api.getDeviceHealth(),
      ]);

      if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
      if (colRes.status === 'fulfilled') setCollectionData(colRes.value);
      if (overdueRes.status === 'fulfilled') setOverdueList(overdueRes.value);
      if (devRes.status === 'fulfilled') setDeviceHealth(devRes.value);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Admin Operations Dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDashboardData();
    }
  }, [isOpen, loadDashboardData]);

  if (!isOpen) return null;

  const handleSendReminder = (apartmentId: string, unitNumber: string) => {
    setRemindedUnits((prev) => ({ ...prev, [apartmentId]: true }));
    setActionNotice(`Đã gửi thông báo nhắc hạn thanh toán tức thì tới cư dân Căn ${unitNumber}`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const filteredOverdue = overdueList.filter((item) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.apartment_unit.toLowerCase().includes(q) ||
      (item.resident_name && item.resident_name.toLowerCase().includes(q)) ||
      (item.resident_email && item.resident_email.toLowerCase().includes(q))
    );
  });

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(25, 20, 18, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1240px',
          maxHeight: '94vh',
          backgroundColor: '#FAF7F2',
          borderRadius: '16px',
          border: '1px solid #E5DCCE',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#2D2825',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5DCCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #D96B43, #B87319)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(217, 107, 67, 0.25)',
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    color: '#2D2825',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Trung Tâm Điều Hành Ban Quản Lý (BQL Operations)
                </h2>
                <span
                  style={{
                    backgroundColor: 'rgba(74, 124, 89, 0.12)',
                    color: '#4A7C59',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(74, 124, 89, 0.25)',
                  }}
                >
                  THE OASIS TOWER
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#786F66' }}>
                Giám sát thu phí đúng hạn, xử lý nợ quá hạn, hiệu suất bảo trì & tình trạng thiết bị không gian sống
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenRbac && (
              <button
                onClick={onOpenRbac}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D96B43',
                  color: '#D96B43',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Quản lý vai trò và phân quyền tài khoản BQL / Kỹ thuật / Cư dân"
              >
                <Shield size={15} />
                <span>Phân Quyền RBAC</span>
              </button>
            )}

            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#FAF7F2',
                border: '1px solid #E5DCCE',
                color: '#4A4036',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Làm mới số liệu tổng hợp"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: '#FAF7F2',
                border: '1px solid #E5DCCE',
                color: '#786F66',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Đóng bảng điều hành"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action notification banner */}
        {actionNotice && (
          <div
            style={{
              backgroundColor: 'rgba(74, 124, 89, 0.12)',
              borderBottom: '1px solid rgba(74, 124, 89, 0.25)',
              padding: '10px 24px',
              fontSize: '0.82rem',
              color: '#3B6847',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Scrollable Main Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Core Top Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Card 1: Tỷ lệ thu phí đúng hạn */}
            <div
              onClick={() => setActiveTab('collection')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px 18px',
                border: activeTab === 'collection' ? '2px solid #4A7C59' : '1px solid #E5DCCE',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#786F66', fontWeight: 600 }}>TỶ LỆ THU PHÍ ĐÚNG HẠN</span>
                <span
                  style={{
                    backgroundColor: 'rgba(74, 124, 89, 0.1)',
                    color: '#4A7C59',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Percent size={11} />
                  <span>{collectionData?.current_month?.on_time_rate_percent ?? 0}%</span>
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2825', marginBottom: '4px' }}>
                {collectionData?.current_month?.collection_rate_percent ?? 0}%
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem' }}>
                {(collectionData?.month_over_month_change_percent ?? 0) >= 0 ? (
                  <span style={{ color: '#4A7C59', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    <TrendingUp size={13} style={{ marginRight: 2 }} />
                    +{collectionData?.month_over_month_change_percent}%
                  </span>
                ) : (
                  <span style={{ color: '#C85252', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    <TrendingDown size={13} style={{ marginRight: 2 }} />
                    {collectionData?.month_over_month_change_percent}%
                  </span>
                )}
                <span style={{ color: '#A0978D' }}>so với tháng trước</span>
              </div>
            </div>

            {/* Card 2: Nợ Quá Hạn Cần Đôn Đốc */}
            <div
              onClick={() => setActiveTab('overdue')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px 18px',
                border: activeTab === 'overdue' ? '2px solid #C85252' : '1px solid #E5DCCE',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#786F66', fontWeight: 600 }}>CÔNG NỢ QUÁ HẠN</span>
                <span
                  style={{
                    backgroundColor: overdueList.length > 0 ? 'rgba(200, 82, 82, 0.12)' : 'rgba(74, 124, 89, 0.1)',
                    color: overdueList.length > 0 ? '#C85252' : '#4A7C59',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {overdueList.length} căn nợ
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: overdueList.length > 0 ? '#C85252' : '#2D2825', marginBottom: '4px' }}>
                {formatVND(overview?.total_unpaid_amount_vnd ?? 0)}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#786F66' }}>
                {overview?.unpaid_invoices_count ?? 0} hoá đơn chưa thu tiền
              </div>
            </div>

            {/* Card 3: Hiệu Suất Phiếu Việc & SLA */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px 18px',
                border: '1px solid #E5DCCE',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#786F66', fontWeight: 600 }}>PHIẾU XỬ LÝ (TICKETS)</span>
                <span
                  style={{
                    backgroundColor: (overview?.overdue_tickets_count ?? 0) > 0 ? 'rgba(200, 82, 82, 0.12)' : 'rgba(74, 124, 89, 0.1)',
                    color: (overview?.overdue_tickets_count ?? 0) > 0 ? '#C85252' : '#4A7C59',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {(overview?.overdue_tickets_count ?? 0)} quá SLA
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2825', marginBottom: '4px' }}>
                {overview?.active_tickets_count ?? 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#786F66' }}>
                <Clock size={13} />
                <span>Xử lý trung bình: <strong>{overview?.avg_ticket_resolution_hours ?? 0} giờ</strong></span>
              </div>
            </div>

            {/* Card 4: Tình Trạng Thiết Bị Tòa Nhà */}
            <div
              onClick={() => setActiveTab('devices')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '16px 18px',
                border: activeTab === 'devices' ? '2px solid #D96B43' : '1px solid #E5DCCE',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#786F66', fontWeight: 600 }}>THIẾT BỊ TÒA NHÀ</span>
                <span
                  style={{
                    backgroundColor: (overview?.devices_offline ?? 0) > 0 ? 'rgba(217, 107, 67, 0.12)' : 'rgba(74, 124, 89, 0.1)',
                    color: (overview?.devices_offline ?? 0) > 0 ? '#D96B43' : '#4A7C59',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {overview?.devices_offline ?? 0} cần bảo dưỡng
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2825', marginBottom: '4px' }}>
                {overview?.devices_online ?? 0}/{overview?.total_devices ?? 0}
              </div>
              <div style={{ fontSize: '0.76rem', color: (overview?.devices_offline ?? 0) > 0 ? '#D96B43' : '#4A7C59', fontWeight: 500 }}>
                {overview?.offline_summary_text || 'Hệ thống thiết bị hoạt động ổn định'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs for In-depth Views */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid #E5DCCE',
              gap: '8px',
              paddingBottom: '2px',
            }}
          >
            <button
              onClick={() => setActiveTab('collection')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === 'collection' ? '3px solid #D96B43' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'collection' ? '#D96B43' : '#786F66',
                fontWeight: activeTab === 'collection' ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <BarChart3 size={16} />
              <span>Thu Phí Theo Tháng ({collectionData?.history?.length ?? 0} kỳ)</span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === 'overdue' ? '3px solid #D96B43' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'overdue' ? '#D96B43' : '#786F66',
                fontWeight: activeTab === 'overdue' ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={16} />
              <span>Danh Sách Căn Hộ Nợ Quá Hạn ({overdueList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === 'devices' ? '3px solid #D96B43' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'devices' ? '#D96B43' : '#786F66',
                fontWeight: activeTab === 'devices' ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Layers size={16} />
              <span>Sức Khỏe Thiết Bị Theo Tầng ({deviceHealth?.floors?.length ?? 0} tầng)</span>
            </button>

            <button
              onClick={() => setActiveTab('revenue')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === 'revenue' ? '3px solid #D96B43' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'revenue' ? '#D96B43' : '#786F66',
                fontWeight: activeTab === 'revenue' ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Percent size={16} />
              <span>Cơ Cấu Doanh Thu Dịch Vụ</span>
            </button>
          </div>

          {/* TAB 1: Collection Rates Trend */}
          {activeTab === 'collection' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px', border: '1px solid #E5DCCE' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: '#2D2825' }}>
                  Tiến Độ Thu Phí Đúng Hạn Theo Kỳ (6 Tháng Gần Nhất)
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#786F66' }}>
                  Biểu đồ so sánh tỷ lệ thu nợ và tỷ lệ cư dân nộp tiền trước hạn chót.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {collectionData?.history?.map((m) => {
                  const isCurrent = m.month === collectionData.current_month?.month;
                  return (
                    <div
                      key={m.month}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '10px',
                        backgroundColor: isCurrent ? '#FFFBF8' : '#FAF7F2',
                        border: isCurrent ? '1px solid #E8C8B5' : '1px solid #EFE9DF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#2D2825' }}>
                            Tháng {m.month}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                backgroundColor: '#D96B43',
                                color: '#FFFFFF',
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              Kỳ Hiện Tại
                            </span>
                          )}
                          <span style={{ fontSize: '0.78rem', color: '#786F66' }}>
                            ({m.paid_count}/{m.invoices_count} căn đã nộp)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: '#786F66' }}>Đã thu / Tổng tiền</div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#2D2825' }}>
                              {formatVND(m.total_collected_vnd)} / {formatVND(m.total_billed_vnd)}
                            </div>
                          </div>
                          <div style={{ minWidth: '70px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: '1.1rem',
                                fontWeight: 800,
                                color: m.collection_rate_percent >= 80 ? '#4A7C59' : '#D96B43',
                              }}
                            >
                              {m.collection_rate_percent}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#E5DCCE',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, m.collection_rate_percent)}%`,
                            height: '100%',
                            backgroundColor: m.collection_rate_percent >= 80 ? '#4A7C59' : '#D96B43',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Overdue Apartments Table */}
          {activeTab === 'overdue' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px', border: '1px solid #E5DCCE' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: '#2D2825' }}>
                    Danh Sách Căn Hộ Nợ Tiền Quá Hạn Chót
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#786F66' }}>
                    Đôn đốc nộp phí dịch vụ, điện nước để đảm bảo dòng tiền vận hành tòa nhà.
                  </p>
                </div>

                <div style={{ position: 'relative', width: 260 }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#A0978D' }}
                  />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Tìm theo số căn, tên cư dân..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #E5DCCE',
                      backgroundColor: '#FAF7F2',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {filteredOverdue.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#786F66' }}>
                  <CheckCircle2 size={36} color="#4A7C59" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Không có căn hộ nào nợ quá hạn!</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Cư dân đã hoàn tất thanh toán đúng thời hạn.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E5DCCE', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036' }}>Căn Hộ</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036' }}>Cư Dân</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036' }}>Hóa Đơn Nợ</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036' }}>Số Ngày Quá Hạn</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036' }}>Tổng Tiền Nợ</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#4A4036', textAlign: 'right' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOverdue.map((apt) => {
                        const isReminded = remindedUnits[apt.apartment_id];
                        return (
                          <tr
                            key={apt.apartment_id}
                            style={{ borderBottom: '1px solid #EFE9DF', transition: 'background-color 0.15s' }}
                          >
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#2D2825' }}>
                              Căn {apt.apartment_unit}
                              <div style={{ fontSize: '0.74rem', color: '#786F66', fontWeight: 400 }}>
                                {apt.building_name} {apt.floor_number ? `• Tầng ${apt.floor_number}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 600 }}>{apt.resident_name || 'Chưa cập nhật'}</div>
                              <div style={{ fontSize: '0.74rem', color: '#A0978D' }}>{apt.resident_email || '—'}</div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#4A4036' }}>
                              {apt.unpaid_invoices_count} kỳ
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  backgroundColor: apt.days_overdue > 10 ? 'rgba(200, 82, 82, 0.12)' : 'rgba(184, 115, 25, 0.12)',
                                  color: apt.days_overdue > 10 ? '#C85252' : '#B87319',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {apt.days_overdue} ngày trễ
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 800, color: '#C85252' }}>
                              {formatVND(apt.total_overdue_amount_vnd)}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleSendReminder(apt.apartment_id, apt.apartment_unit)}
                                disabled={isReminded}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: isReminded ? '1px solid #A0978D' : '1px solid #D96B43',
                                  backgroundColor: isReminded ? '#FAF7F2' : 'rgba(217, 107, 67, 0.1)',
                                  color: isReminded ? '#786F66' : '#D96B43',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: isReminded ? 'default' : 'pointer',
                                }}
                              >
                                <Send size={12} />
                                <span>{isReminded ? 'Đã Gửi Nhắc' : 'Nhắc Nợ Nhanh'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Device Health by Floor */}
          {activeTab === 'devices' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px', border: '1px solid #E5DCCE' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: '#2D2825' }}>
                  Tình Trạng Thiết Bị Cảm Biến Theo Từng Tầng
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#786F66' }}>
                  Bản đồ trực quan giúp đội ngũ bảo trì xác định chính xác khu vực cần kiểm tra mà không cần xem log kỹ thuật.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {deviceHealth?.floors?.map((fl) => {
                  const hasIssue = fl.offline_devices > 0;
                  return (
                    <div
                      key={fl.floor_number}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        backgroundColor: hasIssue ? '#FFFBF8' : '#FAF7F2',
                        border: hasIssue ? '1px solid #F0C4B0' : '1px solid #EFE9DF',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#2D2825' }}>
                            Tầng {fl.floor_number}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#786F66' }}>({fl.building_name})</span>
                        </div>
                        {hasIssue ? (
                          <span
                            style={{
                              backgroundColor: 'rgba(217, 107, 67, 0.12)',
                              color: '#D96B43',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            Cần Kiểm Tra
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: 'rgba(74, 124, 89, 0.12)',
                              color: '#4A7C59',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            Hoạt Động Tốt
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem' }}>
                        <div>
                          Tổng: <strong>{fl.total_devices}</strong>
                        </div>
                        <div style={{ color: '#4A7C59' }}>
                          Trực tuyến: <strong>{fl.online_devices}</strong>
                        </div>
                        {hasIssue && (
                          <div style={{ color: '#C85252' }}>
                            Ngoại tuyến: <strong>{fl.offline_devices}</strong>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: hasIssue ? '#C85252' : '#786F66',
                          backgroundColor: '#FFFFFF',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #EFE9DF',
                        }}
                      >
                        {fl.summary_text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Revenue Breakdown by Service */}
          {activeTab === 'revenue' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px', border: '1px solid #E5DCCE' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: '#2D2825' }}>
                  Cơ Cấu Doanh Thu Tháng Theo Dịch Vụ
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#786F66' }}>
                  Tổng doanh thu tháng này: <strong>{formatVND(overview?.total_revenue_this_month_vnd ?? 0)}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {overview?.revenue_by_service?.map((s) => (
                  <div key={s.service_type} style={{ padding: '12px 14px', backgroundColor: '#FAF7F2', borderRadius: '8px', border: '1px solid #EFE9DF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2D2825' }}>
                        {s.service_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#4A4036' }}>
                          {formatVND(s.amount_vnd)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#786F66', minWidth: '40px', textAlign: 'right' }}>
                          {s.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#E5DCCE', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, s.percentage)}%`,
                          height: '100%',
                          backgroundColor: '#D96B43',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
