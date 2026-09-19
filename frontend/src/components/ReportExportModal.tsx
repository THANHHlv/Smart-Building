import React, { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { ReportExport } from '../types';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId?: string;
}

type ReportType = 'collection' | 'overdue' | 'tickets' | 'reconciliation';

interface ReportCardOption {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  color: string;
}

const REPORT_OPTIONS: ReportCardOption[] = [
  {
    type: 'collection',
    title: 'Báo Cáo Thu Phí Tháng',
    description: 'Tổng hợp doanh thu điện, nước, phí quản lý & đối chiếu số tiền đã phát hành vs đã thu.',
    icon: <BarChart3 size={24} />,
    badge: 'Tài Chính',
    color: '#4A7C59',
  },
  {
    type: 'overdue',
    title: 'Báo Cáo Công Nợ Căn Hộ',
    description: 'Danh sách các căn hộ quá hạn thanh toán, số ngày nợ và thông tin liên hệ đôn đốc thu hồi.',
    icon: <Clock size={24} />,
    badge: 'Công Nợ',
    color: '#D96B43',
  },
  {
    type: 'tickets',
    title: 'Báo Cáo Kỹ Thuật & Bảo Trì',
    description: 'Thống kê sự cố theo chuyên mục, thời gian xử lý SLA trung bình & đánh giá hài lòng của cư dân.',
    icon: <Wrench size={24} />,
    badge: 'Vận Hành',
    color: '#3B82F6',
  },
  {
    type: 'reconciliation',
    title: 'Báo Cáo Đối Soát Giao Dịch',
    description: 'Chi tiết mọi giao dịch cổng VNPay, MoMo, chuyển khoản & tiền mặt để khớp sổ ngân hàng.',
    icon: <CreditCard size={24} />,
    badge: 'Kế Toán',
    color: '#8B5CF6',
  },
];

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  buildingId,
}) => {
  const [selectedType, setSelectedType] = useState<ReportType>('collection');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');

  // Filter params
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [minOverdueDays, setMinOverdueDays] = useState<number>(1);
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');

  // Job states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [latestExport, setLatestExport] = useState<ReportExport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateReport = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const params: Record<string, any> = {
        building_id: buildingId,
        format,
      };

      if (selectedType === 'collection') {
        params.start_date = startDate;
        params.end_date = endDate;
      } else if (selectedType === 'overdue') {
        params.min_overdue_days = Number(minOverdueDays) || 1;
      } else if (selectedType === 'tickets') {
        params.start_date = startDate;
        params.end_date = endDate;
      } else if (selectedType === 'reconciliation') {
        params.start_date = startDate;
        params.end_date = endDate;
        if (gatewayFilter !== 'all') {
          params.gateway = gatewayFilter;
        }
      }

      const res = await api.exportReport(selectedType, params);
      setLatestExport(res);
    } catch (err: any) {
      console.error('Report export failed:', err);
      setErrorMsg(err.message || 'Không thể xuất báo cáo. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedOption = REPORT_OPTIONS.find((opt) => opt.type === selectedType);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 30, 28, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '94vh',
          backgroundColor: '#FAF7F2',
          borderRadius: '16px',
          border: '1px solid #E5DCCE',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.24)',
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
            padding: '18px 24px',
            borderBottom: '1px solid #E5DCCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(74, 124, 89, 0.12)',
                color: '#4A7C59',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#2D2825' }}>
                Trung Tâm Xuất Báo Cáo Ban Quản Lý
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#736B63' }}>
                Trích xuất số liệu vận hành định dạng bảng tính Excel (.xlsx) chuẩn nghiệp vụ kế toán
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '50%', color: '#736B63' }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* 1. Report Type Grid */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#453E38', marginBottom: '10px', display: 'block' }}>
              1. CHỌN LOẠI BÁO CÁO CẦN XUẤT
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              {REPORT_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setSelectedType(opt.type);
                      setLatestExport(null);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${opt.color}` : '1px solid #E5DCCE',
                      background: isSelected ? '#FFFFFF' : '#F5F1EA',
                      boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ color: opt.color }}>{opt.icon}</div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: `${opt.color}15`,
                          color: opt.color,
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D2825', marginBottom: '4px' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#736B63', lineHeight: '1.35' }}>
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Filter Parameters Section */}
          <div
            style={{
              padding: '18px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5DCCE',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Filter size={16} color="#4A7C59" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D2825' }}>
                2. BỘ LỌC DỮ LIỆU: {selectedOption?.title.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {selectedType !== 'overdue' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#554E46', display: 'block', marginBottom: '6px' }}>
                      Từ Ngày
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D6CCC0',
                        fontSize: '0.85rem',
                        backgroundColor: '#FAF7F2',
                        color: '#2D2825',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#554E46', display: 'block', marginBottom: '6px' }}>
                      Đến Ngày
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D6CCC0',
                        fontSize: '0.85rem',
                        backgroundColor: '#FAF7F2',
                        color: '#2D2825',
                      }}
                    />
                  </div>
                </>
              )}

              {selectedType === 'overdue' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#554E46', display: 'block', marginBottom: '6px' }}>
                    Số Ngày Quá Hạn Tối Thiểu
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOverdueDays}
                    onChange={(e) => setMinOverdueDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6CCC0',
                      fontSize: '0.85rem',
                      backgroundColor: '#FAF7F2',
                      color: '#2D2825',
                    }}
                  />
                </div>
              )}

              {selectedType === 'reconciliation' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#554E46', display: 'block', marginBottom: '6px' }}>
                    Cổng Thanh Toán
                  </label>
                  <select
                    value={gatewayFilter}
                    onChange={(e) => setGatewayFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6CCC0',
                      fontSize: '0.85rem',
                      backgroundColor: '#FAF7F2',
                      color: '#2D2825',
                    }}
                  >
                    <option value="all">Tất cả các cổng</option>
                    <option value="vnpay">Cổng VNPay</option>
                    <option value="momo">Ví MoMo</option>
                    <option value="bank_transfer">Chuyển khoản trực tiếp</option>
                    <option value="cash">Tiền mặt tại quầy BQL</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#554E46', display: 'block', marginBottom: '6px' }}>
                  Định Dạng Tệp
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormat('xlsx')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: format === 'xlsx' ? '2px solid #4A7C59' : '1px solid #D6CCC0',
                      background: format === 'xlsx' ? 'rgba(74, 124, 89, 0.1)' : '#FAF7F2',
                      color: format === 'xlsx' ? '#4A7C59' : '#554E46',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: format === 'csv' ? '2px solid #4A7C59' : '1px solid #D6CCC0',
                      background: format === 'csv' ? 'rgba(74, 124, 89, 0.1)' : '#FAF7F2',
                      color: format === 'csv' ? '#4A7C59' : '#554E46',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error notice if any */}
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(200, 82, 82, 0.1)',
                border: '1px solid rgba(200, 82, 82, 0.3)',
                color: '#C85252',
                fontSize: '0.82rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Success Download Card */}
          {latestExport && latestExport.status === 'completed' && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(74, 124, 89, 0.08)',
                border: '1px solid rgba(74, 124, 89, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={24} color="#4A7C59" />
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D2825' }}>
                    Tệp báo cáo đã sẵn sàng để tải về!
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#736B63' }}>
                    Dung lượng: {(latestExport.file_size_bytes / 1024).toFixed(1)} KB • Định dạng: {latestExport.format.toUpperCase()}
                  </div>
                </div>
              </div>

              <a
                href={latestExport.file_url || '#'}
                download
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#4A7C59',
                  color: '#FFFFFF',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(74, 124, 89, 0.3)',
                }}
              >
                <Download size={16} />
                <span>Tải Tệp Ngay</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5DCCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#736B63' }}>
            Báo cáo được lưu trữ 7 ngày và sẽ gửi kèm thông báo In-App cho kế toán
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleCreateReport}
              disabled={isExporting}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                fontSize: '0.84rem',
                backgroundColor: '#4A7C59',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Trích Xuất Dữ Liệu...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>Tạo Báo Cáo Excel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
