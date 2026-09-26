import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  Flame,
  GripVertical,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import {
  MOTION_SPRINGS,
  createStaggerContainer,
  staggerItemVariants,
  singlePulseAnimation,
} from '../tokens/motionTokens';
import { SpringSwitch } from './ui/SpringSwitch';
import { ShakeInput } from './ui/ShakeInput';
import { WarmSkeletonCard } from './ui/WarmSkeleton';
import { WarmEmptyState } from './ui/WarmEmptyState';
import { SmoothProgressBar } from './ui/SmoothProgressBar';
import { CountUpNumber, StatusBadge } from './ui/HumanInteractions';
import { useToast } from './ui/Toast';

export const AnimationShowcase: React.FC = () => {
  const { success, warning, error, info } = useToast();

  // Category 1: Navigation State
  const [subTab, setSubTab] = useState<'kpi' | 'cards' | 'charts'>('kpi');

  // Category 2: Data & Numerals State
  const [metricValue, setMetricValue] = useState(14850000);
  const [energyValue, setEnergyValue] = useState(428.6);
  const [statusSample, setStatusSample] = useState<'in_progress' | 'completed' | 'pending'>('in_progress');
  const [staggerKey, setStaggerKey] = useState(0);

  // Category 3: Micro-interactions State
  const [switch1, setSwitch1] = useState(true);
  const [inputVal, setInputVal] = useState('0987654321');
  const [inputError, setInputError] = useState<string | null>(null);
  const [shakeTriggerKey, setShakeTriggerKey] = useState(0);

  // Category 4: Loading & Empty States
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [progressVal, setProgressVal] = useState(65);

  // Category 5: Kanban Mini State
  const kanbanCards = [
    { id: 't1', title: 'Kiểm tra áp lực nước căn Penthouse 3201', pri: 'critical', cat: 'plumbing' },
    { id: 't2', title: 'Cân chỉnh biến tần thang máy tháp A', pri: 'high', cat: 'elevator' },
    { id: 't3', title: 'Đèn cảm ứng hành lang tầng 12 nhấp nháy', pri: 'medium', cat: 'electrical' },
  ];

  // Category 6: Urgent & Notification Pulse State
  const [urgentPulseKey, setUrgentPulseKey] = useState(0);
  const [unreadBellCount, setUnreadBellCount] = useState(3);

  // Randomize Numerals
  const randomizeMetrics = () => {
    setMetricValue(Math.floor(Math.random() * 25000000) + 5000000);
    setEnergyValue(parseFloat((Math.random() * 800 + 100).toFixed(1)));
    setStatusSample(prev => prev === 'in_progress' ? 'completed' : prev === 'completed' ? 'pending' : 'in_progress');
    setStaggerKey(prev => prev + 1);
  };

  const triggerInputError = () => {
    setInputError('Số điện thoại không hợp lệ hoặc đã được sử dụng!');
    setShakeTriggerKey(prev => prev + 1);
  };

  const clearInputError = () => {
    setInputError(null);
  };

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1360px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}
    >
      {/* Header Banner */}
      <header
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF6F0 100%)',
          border: '1px solid #EFE9DF',
          borderRadius: '20px',
          padding: '28px 32px',
          boxShadow: '0 4px 24px rgba(45, 40, 37, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(217, 107, 67, 0.12)',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wand2 size={22} />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Hệ Thống Chuyển Động Chuẩn — ThanhLe Motion System
            </h1>
          </div>
          <p
            style={{
              margin: '8px 0 0 0',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              maxWidth: '680px',
              lineHeight: 1.5,
            }}
          >
            Quy chuẩn 6 danh mục animation: Easing tự nhiên Spring Physics, độ trễ Stagger 50ms, Zero CLS (Layout Shift = 0)
            và tuân thủ nghiêm ngặt khả năng tiếp cận WCAG AA/AAA.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={randomizeMetrics}
            className="interactive-btn focus-ring-accent"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 18px',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(217, 107, 67, 0.28)',
            }}
          >
            <RotateCcw size={16} />
            <span>Kích Hoạt Chạy Lại (Re-run)</span>
          </button>
        </div>
      </header>

      {/* Grid Danh mục 1 & 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* 1. CHUYỂN TRANG & ĐIỀU HƯỚNG */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D96B43', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danh mục 1
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Chuyển Tab & Điều Hướng Trượt Mượt (Layout Animation)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Chỉ báo underline trượt mượt bằng Framer Motion `layoutId`, không nhảy cóc thô cứng.
            </p>
          </div>

          {/* Interactive Tab Strip */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#FAF8F4',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid #EFE9DF',
              gap: '4px',
            }}
          >
            {[
              { id: 'kpi', label: 'Chỉ Số Toàn Nhà' },
              { id: 'cards', label: 'Thẻ Dịch Vụ' },
              { id: 'charts', label: 'Đồ Thị Tiêu Thụ' },
            ].map((tab) => {
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: isActive ? '#D96B43' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="showcaseSubTabIndicator"
                      transition={MOTION_SPRINGS.snappy}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(45, 40, 37, 0.06)',
                        zIndex: 0,
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Cross-fade with Spring */}
          <div style={{ minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              {subTab === 'kpi' && (
                <motion.div
                  key="kpi"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={MOTION_SPRINGS.gentle}
                  style={{
                    width: '100%',
                    backgroundColor: '#FDFCFA',
                    border: '1px solid #EFE9DF',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-around',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Điện Năng Ban Mai</div>
                    <div style={{ fontSize: '1.4rem', color: '#D96B43', marginTop: '4px' }}>
                      <CountUpNumber value={energyValue} decimals={1} unit="kWh" />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Nước Sạch Dự trữ</div>
                    <div style={{ fontSize: '1.4rem', color: '#437A82', marginTop: '4px' }}>
                      <CountUpNumber value={84.2} decimals={1} unit="m³" />
                    </div>
                  </div>
                </motion.div>
              )}

              {subTab === 'cards' && (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={MOTION_SPRINGS.gentle}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#F6FAF7',
                    border: '1px solid #D3E6DA',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <CheckCircle2 color="#4A7C59" size={24} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#2D2825' }}>
                      Hệ thống tiện ích hoạt động ổn định
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#4A7C59', marginTop: '2px' }}>
                      Tất cả 12 khu vực công cộng sẵn sàng phục vụ cư dân
                    </div>
                  </div>
                </motion.div>
              )}

              {subTab === 'charts' && (
                <motion.div
                  key="charts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={MOTION_SPRINGS.gentle}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#FFFDF9',
                    border: '1px solid #F4E5CC',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600 }}>Tỷ lệ thu phí toà nhà</span>
                    <span style={{ color: '#B87319', fontWeight: 700 }}>94.6%</span>
                  </div>
                  <SmoothProgressBar progress={94.6} color="#B87319" height={10} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* 2. DỮ LIỆU & SỐ LIỆU (Count-Up, Stagger, Status Draw-in) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4A7C59', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danh mục 2
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Số Đếm Chạy (Count-Up) & Stagger Danh Sách
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Đếm số tiền tệ VND với tabular-nums mượt mà; Checkmark vẽ dần bằng SVG pathLength.
            </p>
          </div>

          {/* Count-Up Metric Card */}
          <div
            style={{
              padding: '18px',
              backgroundColor: '#FAF8F4',
              borderRadius: '14px',
              border: '1px solid #EFE9DF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Tổng Tiền Cần Thu Chu Kỳ Này</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2825', marginTop: '2px' }}>
                <CountUpNumber value={metricValue} isCurrencyVND={true} />
              </div>
            </div>
            <StatusBadge status={statusSample} />
          </div>

          {/* Staggered Feed Demo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Stagger List (Card xuất hiện trễ nhau 50ms):
            </div>
            <motion.div
              key={staggerKey}
              variants={createStaggerContainer(0.05)}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {[
                { title: 'Hoá đơn P.702 — Tiền điện sinh hoạt', time: '10 phút trước', price: 1250000 },
                { title: 'Phiếu việc #WO-104 — Bảo dưỡng lọc gió', time: '25 phút trước', price: 350000 },
                { title: 'Đặt phòng Yoga sáng mai — Căn 1403', time: '1 giờ trước', price: 0 },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={staggerItemVariants}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #EFE9DF',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.time}</div>
                  </div>
                  {item.price > 0 && (
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D96B43' }}>
                      <CountUpNumber value={item.price} isCurrencyVND={true} />
                    </span>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      </div>

      {/* Grid Danh mục 3 & 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* 3. TƯƠNG TÁC & PHẢN HỒI (Micro-interactions) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#B87319', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danh mục 3
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Micro-interactions: Switch, Shake & Toast
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Công tắc vật lý SpringSwitch, ô nhập rung lỗi khi sai định dạng, và Toast vuốt đóng.
            </p>
          </div>

          {/* SpringSwitch Demo */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#FAF8F4',
              borderRadius: '12px',
              border: '1px solid #EFE9DF',
            }}
          >
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tự động trừ tiền qua ví (Auto-Pay)</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Lực gạt vật lý tự nhiên (stiffness: 500, damping: 32)</div>
            </div>
            <SpringSwitch checked={switch1} onChange={setSwitch1} id="demo-switch-1" />
          </div>

          {/* ShakeInput Demo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ShakeInput
              id="showcase-shake-input"
              label="Số điện thoại cư dân"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              errorMessage={inputError}
              triggerShakeKey={shakeTriggerKey}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={triggerInputError}
                className="interactive-btn focus-ring-accent"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(200, 82, 82, 0.1)',
                  color: '#C85252',
                  border: '1px solid rgba(200, 82, 82, 0.25)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mô phỏng lỗi rung (Shake)
              </button>
              {inputError && (
                <button
                  type="button"
                  onClick={clearInputError}
                  className="interactive-btn focus-ring-accent"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FAF8F4',
                    color: 'var(--text-secondary)',
                    border: '1px solid #E5DFD5',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Xoá lỗi
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification Launchers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Bắn Toast Thông Báo Góc Màn Hình (Kéo vuốt sang phải để đóng):
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => success('Thanh toán thành công!', 'Hoá đơn tiền điện T9/2026 đã được quyết toán.')}
                className="interactive-btn focus-ring-accent"
                style={{
                  backgroundColor: '#4A7C59',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Thành công
              </button>
              <button
                type="button"
                onClick={() => warning('Nhắc nhở hạn nộp phí', 'Phí quản lý tháng này sắp đến hạn trong 2 ngày nữa.')}
                className="interactive-btn focus-ring-accent"
                style={{
                  backgroundColor: '#B87319',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Lưu ý
              </button>
              <button
                type="button"
                onClick={() => error('Lỗi kết nối bộ cảm biến', 'Không nhận được telemetry từ van nước căn hộ 1004.')}
                className="interactive-btn focus-ring-accent"
                style={{
                  backgroundColor: '#C85252',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Lỗi
              </button>
            </div>
          </div>
        </section>

        {/* 4. TRẠNG THÁI TẢI & RỖNG (Loading & Empty states) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#437A82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Danh mục 4
              </div>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tải Ấm Áp (Shimmer) & Trạng Thái Rỗng (Floating)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Skeleton tông Linen ấm thay vì xám lạnh; Empty state icon bồng bềnh êm ả.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => { setShowSkeleton(!showSkeleton); setShowEmpty(false); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5DFD5',
                  background: showSkeleton ? '#D96B43' : '#FAF8F4',
                  color: showSkeleton ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {showSkeleton ? 'Hiện Dữ Liệu' : 'Thử Skeleton'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmpty(!showEmpty); setShowSkeleton(false); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5DFD5',
                  background: showEmpty ? '#D96B43' : '#FAF8F4',
                  color: showEmpty ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {showEmpty ? 'Hiện Dữ Liệu' : 'Thử Empty'}
              </button>
            </div>
          </div>

          {/* Shimmer / Content Container */}
          <div style={{ minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showSkeleton ? (
              <WarmSkeletonCard count={2} />
            ) : showEmpty ? (
              <WarmEmptyState
                compact={true}
                title="Chưa có hoá đơn nào trong tháng"
                description="Bạn đã thanh toán đầy đủ các khoản dịch vụ kỳ trước. An tâm tận hưởng không gian sống!"
                action={{
                  label: 'Xem lịch sử giao dịch',
                  onClick: () => info('Lịch sử giao dịch', 'Mở danh sách các giao dịch đã hoàn tất.'),
                }}
              />
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid #EFE9DF',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      Căn hộ 1208 — Gói Dịch vụ Gia Đình Cao Cấp
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Bao gồm nước sinh hoạt, xử lý rác tái chế & bảo trì định kỳ
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59' }}>Hoạt Động</span>
                </div>

                {/* Progress bar */}
                <div>
                  <SmoothProgressBar
                    progress={progressVal}
                    showLabel={true}
                    label="Tiến độ xuất sao kê báo cáo tháng"
                    color="#D96B43"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressVal}
                    onChange={(e) => setProgressVal(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '6px', accentColor: '#D96B43' }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Grid Danh mục 5 & 6 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* 5. KANBAN & KÉO-THẢ (Physics Demo) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D96B43', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danh mục 5
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Kanban Card Lift, Nhường Chỗ & Settle (Spring Physics)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Card khi click hoặc kéo có phản hồi xúc giác nổi lên (lift with shadow), các card khác tự giãn nhường chỗ (`layout`).
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#FAF8F4',
              borderRadius: '14px',
              border: '1px solid #E5DFD5',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {kanbanCards.map((c) => (
              <motion.div
                key={c.id}
                layout
                whileHover={{
                  y: -3,
                  boxShadow: '0 8px 20px rgba(45, 40, 37, 0.08)',
                  borderColor: '#D96B43',
                  transition: { duration: 0.18 },
                }}
                whileTap={{
                  scale: 1.02,
                  rotate: -0.6,
                  boxShadow: '0 14px 28px rgba(217, 107, 67, 0.18)',
                  cursor: 'grabbing',
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #EFE9DF',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'grab',
                }}
              >
                <GripVertical size={16} color="var(--text-muted)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.title}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: c.pri === 'critical' ? 'rgba(200, 82, 82, 0.12)' : 'rgba(217, 107, 67, 0.12)',
                        color: c.pri === 'critical' ? '#C85252' : '#D96B43',
                      }}
                    >
                      {c.pri.toUpperCase()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 6. BẢNG TIN & CHUÔNG THÔNG BÁO (Urgent Pulse & Bell Bounce) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #EFE9DF',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#C85252', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danh mục 6
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Tin Khẩn Pulse 1 Lần & Chuông Bounce Khi Có Tin Mới
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Bài khẩn cấp chỉ nhấn mạnh đúng 1 lần khi đăng để tránh nhức mắt; Chuông nhún nảy đúng sự kiện thực tế.
            </p>
          </div>

          {/* Urgent Post with Single Pulse Demo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <motion.article
              key={urgentPulseKey}
              animate={singlePulseAnimation}
              style={{
                backgroundColor: '#FFF8F7',
                border: '1px solid #F6D9D7',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(200, 82, 82, 0.15)',
                  color: '#C85252',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Flame size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#C85252' }}>
                  Thông báo khẩn: Diễn tập phòng cháy chữa cháy Tầng 15
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                  Diễn ra từ 09:30 - 10:30 sáng thứ 7. Thang máy sẽ tạm khóa và chuyển sang nguồn điện cứu hỏa dự phòng.
                </div>
              </div>
            </motion.article>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setUrgentPulseKey(prev => prev + 1)}
                className="interactive-btn focus-ring-accent"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(200, 82, 82, 0.12)',
                  color: '#C85252',
                  border: '1px solid rgba(200, 82, 82, 0.3)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Kích hoạt Pulse 1 lần
              </button>

              {/* Notification Bell Bounce Demo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Badge chuông thông báo:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#FAF8F4',
                      border: '1px solid #E5DFD5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Bell size={18} color="var(--text-primary)" />
                  </button>

                  <AnimatePresence>
                    {unreadBellCount > 0 && (
                      <motion.span
                        key={unreadBellCount}
                        initial={{ scale: 0.5, y: -4 }}
                        animate={{ scale: [0.8, 1.25, 1], y: 0 }}
                        transition={MOTION_SPRINGS.bounce}
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          backgroundColor: '#D96B43',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(217, 107, 67, 0.4)',
                        }}
                      >
                        {unreadBellCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => setUnreadBellCount(prev => prev + 1)}
                  className="interactive-btn focus-ring-accent"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#FAF8F4',
                    border: '1px solid #E5DFD5',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  +1 Tin mới
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
