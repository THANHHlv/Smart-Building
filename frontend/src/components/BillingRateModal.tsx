import React, { useState } from 'react';
import {
  Building2,
  Car,
  DollarSign,
  Droplets,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { api } from '../services/api';

interface BillingRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId?: string;
  onRateUpdated?: () => void;
}

export const BillingRateModal: React.FC<BillingRateModalProps> = ({
  isOpen,
  onClose,
  buildingId = 'bld-001',
  onRateUpdated,
}) => {
  const [waterPrice, setWaterPrice] = useState<number>(18000);
  const [mgmtFee, setMgmtFee] = useState<number>(15000);
  const [parkingFee, setParkingFee] = useState<number>(120000);
  const [effectiveDate, setEffectiveDate] = useState<string>(() => {
    // Default to the 1st of next month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.updateBillingRates({
        building_id: buildingId,
        water_price_per_m3: Number(waterPrice),
        management_fee_per_sqm: Number(mgmtFee),
        parking_fee_per_slot: Number(parkingFee),
        effective_date: effectiveDate,
      });

      setSuccessMsg(`Đã cập nhật biểu giá mới có hiệu lực từ ngày ${effectiveDate}!`);
      onRateUpdated?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to update billing rates:', err);
      setErrorMsg(err.message || 'Không thể cập nhật biểu giá. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 30, 28, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 10006,
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
          maxWidth: '580px',
          backgroundColor: '#FAF7F2',
          borderRadius: '16px',
          border: '1px solid #E5DCCE',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#2D2825' }}>
                Cập Nhật Biểu Giá Tiện Ích & Phí Quản Lý
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#736B63' }}>
                Thiết lập đơn giá mới có hiệu lực theo thời gian cho tòa nhà
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', color: '#736B63' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Warning Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 107, 67, 0.08)',
              border: '1px solid rgba(217, 107, 67, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <ShieldAlert size={20} color="#D96B43" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: '#554E46', lineHeight: '1.4' }}>
              <strong>Nguyên tắc bảo toàn dữ liệu lịch sử:</strong> Đơn giá mới sẽ chỉ áp dụng cho các kỳ hóa đơn phát hành từ ngày hiệu lực trở đi. Tất cả hóa đơn đã phát hành trước đó hoàn toàn không bị ảnh hưởng.
            </div>
          </div>

          {/* Effective Date Picker */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#332D27', display: 'block', marginBottom: '6px' }}>
              Ngày Bắt Đầu Có Hiệu Lực (Effective Date) *
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #D6CCC0',
                fontSize: '0.85rem',
                backgroundColor: '#FFFFFF',
                color: '#2D2825',
              }}
            />
          </div>

          {/* Rate Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#332D27', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Droplets size={14} color="#3B82F6" />
                <span>Đơn Giá Nước (VND/m³) *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={100}
                value={waterPrice}
                onChange={(e) => setWaterPrice(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D6CCC0',
                  fontSize: '0.85rem',
                  backgroundColor: '#FFFFFF',
                  color: '#2D2825',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#332D27', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Building2 size={14} color="#4A7C59" />
                <span>Phí Quản Lý (VND/m²) *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={500}
                value={mgmtFee}
                onChange={(e) => setMgmtFee(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D6CCC0',
                  fontSize: '0.85rem',
                  backgroundColor: '#FFFFFF',
                  color: '#2D2825',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#332D27', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Car size={14} color="#8B5CF6" />
                <span>Phí Gửi Xe (VND/slot/tháng) *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={5000}
                value={parkingFee}
                onChange={(e) => setParkingFee(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D6CCC0',
                  fontSize: '0.85rem',
                  backgroundColor: '#FFFFFF',
                  color: '#2D2825',
                }}
              />
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(200,82,82,0.1)', color: '#C85252', fontSize: '0.8rem' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(74,124,89,0.1)', color: '#4A7C59', fontSize: '0.8rem', fontWeight: 600 }}>
              {successMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '0.84rem',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Lưu...</span>
                </>
              ) : (
                <span>Lưu Biểu Giá Mới</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
