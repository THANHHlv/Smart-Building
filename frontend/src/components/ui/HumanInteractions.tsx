import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { HeartPulse, Check, X } from 'lucide-react';

// ==========================================
// 1. SỐ ĐẾM CHẠY MƯỢT MÀ (Count-Up Animation)
// ==========================================
interface CountUpNumberProps {
  value: number;
  decimals?: number;
  unit?: string;
  className?: string;
  isCurrencyVND?: boolean;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  decimals = 1,
  unit = '',
  className = '',
  isCurrencyVND = false,
}) => {
  const springValue = useSpring(0, {
    stiffness: 75,
    damping: 18,
    mass: 0.8,
  });

  const display = useTransform(springValue, (current) => {
    if (isCurrencyVND) {
      return Math.round(current).toLocaleString('vi-VN');
    }
    return current.toLocaleString('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <span
      className={className}
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
    >
      <motion.span>{display}</motion.span>
      {(unit || isCurrencyVND) && (
        <span
          style={{
            marginLeft: '4px',
            fontSize: '0.85em',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {isCurrencyVND ? '₫' : unit}
        </span>
      )}
    </span>
  );
};

// ==========================================
// 2. CHỈ BÁO NHỊP THỞ IOT (Breathing Indicator)
// ==========================================
export const BreathingIndicator: React.FC<{
  status: 'normal' | 'notice' | 'anomaly';
  size?: number;
}> = ({ status, size = 12 }) => {
  const colorMap = {
    normal: '#4A7C59', // Xanh xô thơm
    notice: '#B87319', // Hổ phách
    anomaly: '#C85252', // San hô dịu
  };

  const activeColor = colorMap[status] || colorMap.normal;

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-label={`Trạng thái: ${status}`}
    >
      {/* Vòng lan tỏa nhịp thở 3.5s */}
      <motion.div
        animate={{
          scale: [1, 2.2, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: activeColor,
        }}
      />
      {/* Điểm tâm phát sáng */}
      <div
        style={{
          width: `${Math.max(6, size * 0.6)}px`,
          height: `${Math.max(6, size * 0.6)}px`,
          borderRadius: '50%',
          backgroundColor: activeColor,
          boxShadow: `0 0 6px ${activeColor}88`,
        }}
      />
    </div>
  );
};

// ==========================================
// 3. THẺ DỮ LIỆU ẤM ÁP (Warm Card with Spring Physics)
// ==========================================
interface WarmCardProps {
  title: string;
  subtitle?: string;
  value: number;
  unit: string;
  statusText?: string;
  status?: 'normal' | 'notice' | 'anomaly';
  delay?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const WarmCard: React.FC<WarmCardProps> = ({
  title,
  subtitle,
  value,
  unit,
  statusText,
  status = 'normal',
  delay = 0,
  icon,
  onClick,
}) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      transition={{
        type: 'spring',
        stiffness: 240,
        damping: 22,
        delay,
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 22px',
        border: '1px solid #EFE9DF',
        boxShadow: '0 4px 18px rgba(45, 40, 37, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="focus-visible:ring-2 focus-visible:ring-[#D96B43] focus-visible:outline-none"
      tabIndex={onClick ? 0 : undefined}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D96B43',
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <BreathingIndicator status={status} />
      </header>

      <div style={{ fontSize: '1.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
        <CountUpNumber value={value} decimals={1} unit={unit} />
      </div>

      {statusText && (
        <footer
          style={{
            fontSize: '0.76rem',
            color: status === 'anomaly' ? '#C85252' : status === 'notice' ? '#B87319' : '#4A7C59',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
          }}
        >
          <span>•</span>
          <span>{statusText}</span>
        </footer>
      )}
    </motion.article>
  );
};

// ==========================================
// 4. THÔNG BÁO NHẬT KÝ CHĂM SÓC (Care Notice)
// ==========================================
interface CareNoticeProps {
  id: string | number;
  message: string;
  time: string;
  unit?: string;
  level?: 'critical' | 'high' | 'medium' | 'low';
  onDismiss?: (id: string | number) => void;
  onAction?: (id: string | number) => void;
}

export const CareNotice: React.FC<CareNoticeProps> = ({
  id,
  message,
  time,
  unit,
  level = 'medium',
  onDismiss,
  onAction,
}) => {
  const isAnomaly = level === 'critical' || level === 'high';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 30, height: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      style={{
        background: isAnomaly ? '#FFF8F6' : '#FAF8F4',
        border: `1px solid ${isAnomaly ? '#F6DFD7' : '#EFE9DF'}`,
        borderRadius: '14px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '10px',
        overflow: 'hidden',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: isAnomaly ? '#FDEEE8' : '#EFF6F1',
            color: isAnomaly ? '#D96B43' : '#4A7C59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <HeartPulse size={18} />
        </div>
        <div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {unit && <span style={{ fontWeight: 600, color: '#D96B43' }}>Căn {unit}: </span>}
            {message}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {time}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {onAction && (
          <button
            type="button"
            onClick={() => onAction(id)}
            style={{
              background: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D96B43]"
          >
            <Check size={13} />
            <span>Quan tâm</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(id)}
            aria-label="Ẩn thông báo"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </motion.article>
  );
};

// ==========================================
// 5. HUY HIỆU TRẠNG THÁI VỚI CHECKMARK VẼ DẦN (Status Badge Draw-In)
// ==========================================
interface StatusBadgeProps {
  status: 'completed' | 'paid' | 'in_progress' | 'pending' | 'open' | 'overdue' | 'cancelled';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const isComplete = status === 'completed' || status === 'paid';

  const config = {
    completed: { text: 'Hoàn thành', bg: 'rgba(74, 124, 89, 0.12)', color: '#4A7C59', border: 'rgba(74, 124, 89, 0.3)' },
    paid: { text: 'Đã thanh toán', bg: 'rgba(74, 124, 89, 0.12)', color: '#4A7C59', border: 'rgba(74, 124, 89, 0.3)' },
    in_progress: { text: 'Đang xử lý', bg: 'rgba(217, 107, 67, 0.12)', color: '#D96B43', border: 'rgba(217, 107, 67, 0.3)' },
    pending: { text: 'Chờ duyệt', bg: 'rgba(184, 115, 25, 0.12)', color: '#B87319', border: 'rgba(184, 115, 25, 0.3)' },
    open: { text: 'Mới tiếp nhận', bg: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4', border: 'rgba(6, 182, 212, 0.3)' },
    overdue: { text: 'Quá hạn', bg: 'rgba(200, 82, 82, 0.12)', color: '#C85252', border: 'rgba(200, 82, 82, 0.3)' },
    cancelled: { text: 'Đã huỷ', bg: 'rgba(142, 134, 126, 0.12)', color: '#8E867E', border: 'rgba(142, 134, 126, 0.3)' },
  }[status];

  const displayLabel = label || config.text;

  return (
    <motion.span
      layout
      initial={{ scale: 0.95, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '4px' : '6px',
        padding: size === 'sm' ? '2px 7px' : '4px 10px',
        borderRadius: size === 'sm' ? '6px' : '8px',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontSize: size === 'sm' ? '0.7rem' : '0.78rem',
        fontWeight: 600,
        lineHeight: 1.2,
        transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
      }}
    >
      {isComplete ? (
        <svg
          width={size === 'sm' ? 12 : 14}
          height={size === 'sm' ? 12 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke={config.color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M20 6L9 17l-5-5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </svg>
      ) : (
        <span
          style={{
            width: size === 'sm' ? '5px' : '6px',
            height: size === 'sm' ? '5px' : '6px',
            borderRadius: '50%',
            backgroundColor: config.color,
          }}
        />
      )}
      <span>{displayLabel}</span>
    </motion.span>
  );
};
