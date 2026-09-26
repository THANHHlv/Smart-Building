/**
 * Smart Building Cloud Platform — Motion Design Tokens
 * Master token definition for consistent, purposeful spring physics and easing curves.
 * Adheres to ThanhLe Biophilic Theme and WCAG AA/AAA (Zero CLS, prefers-reduced-motion).
 */

import { type Transition, type Variants } from 'framer-motion';

// ============================================================================
// 1. DURATION TOKENS (Phân loại thời lượng chuẩn)
// ============================================================================
export const MOTION_DURATIONS = {
  /** Micro-interaction: nút bấm, công tắc, icon, badge bounce (150–250ms) */
  micro: 0.18,
  microMs: 180,

  /** Chuyển trang, tab indicator, mở modal, drawer (300–450ms) */
  page: 0.35,
  pageMs: 350,

  /** Minh hoạ dữ liệu: count-up số liệu, vẽ biểu đồ, progress bar (500–800ms) */
  data: 0.65,
  dataMs: 650,
} as const;

// ============================================================================
// 2. EASING CURVES (Cubic-bezier tự nhiên mô phỏng vật lý thật)
// ============================================================================
export const MOTION_EASINGS = {
  /** Deceleration tự nhiên mượt mà (dành cho phần tử tiến vào màn hình) */
  easeOutNatural: [0.16, 1, 0.3, 1] as const,

  /** Chuyển động hai chiều cân đối */
  easeInOutNatural: [0.4, 0, 0.2, 1] as const,

  /** Acceleration dứt khoát khi phần tử biến mất */
  easeInNatural: [0.7, 0, 0.84, 0] as const,
};

// ============================================================================
// 3. SPRING PHYSICS CONFIGURATIONS (Lực kéo & Giảm chấn)
// ============================================================================
export const MOTION_SPRINGS = {
  /** Nhanh, đàn hồi gọn — Dành cho tabs, badges, toggle switch */
  snappy: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 28,
    mass: 0.8,
  },

  /** Êm dịu, đầm chắc — Dành cho chuyển trang, mở modal/drawer, card nhấc lên */
  gentle: {
    type: 'spring' as const,
    stiffness: 240,
    damping: 24,
    mass: 1,
  },

  /** Công tắc vật lý thật — Bật/tắt có phản lực rõ rệt */
  switchPhysics: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 32,
    mass: 0.7,
  },

  /** Chuông thông báo / Icon nhún nhẹ khi có dữ liệu mới (Bounce) */
  bounce: {
    type: 'spring' as const,
    stiffness: 480,
    damping: 14,
    mass: 0.6,
  },

  /** Đếm số chạy mượt mà không giật số (Count-up number) */
  counter: {
    stiffness: 75,
    damping: 18,
    mass: 0.8,
  },
} as const;

// ============================================================================
// 4. STAGGER PRESETS (Xuất hiện lần lượt tránh đập vào mắt cùng lúc)
// ============================================================================
export const STAGGER_PRESETS = {
  fast: 0.035, // 35ms trễ giữa các card danh sách dài
  normal: 0.05, // 50ms chuẩn cho card invoices, tickets
  relaxed: 0.08, // 80ms cho các khối lớn dashboard
};

/**
 * Variant cho Container danh sách có Stagger
 */
export const createStaggerContainer = (staggerDelay = STAGGER_PRESETS.normal): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
});

/**
 * Variant cho từng phần tử con trong danh sách Stagger (Zero CLS)
 */
export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: MOTION_SPRINGS.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15 },
  },
};

// ============================================================================
// 5. PAGE TRANSITION PRESETS (Chuyển trang có định hướng & Zero CLS)
// ============================================================================
export const createPageTransitionVariants = (direction: number = 1): Variants => ({
  initial: {
    opacity: 0,
    x: direction > 0 ? 16 : -16,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: MOTION_DURATIONS.page,
      ease: MOTION_EASINGS.easeOutNatural,
    },
  },
  exit: {
    opacity: 0,
    x: direction > 0 ? -12 : 12,
    scale: 0.995,
    transition: {
      duration: 0.2,
      ease: MOTION_EASINGS.easeInNatural,
    },
  },
});

// ============================================================================
// 6. MICRO-INTERACTION VARIANTS
// ============================================================================

/** Nút bấm phản hồi xúc giác nhẹ (Tap & Hover) */
export const buttonTapMotion = {
  whileHover: { scale: 1.015, transition: { duration: 0.15 } },
  whileTap: { scale: 0.97, transition: { duration: 0.1 } },
};

/** Input rung nhẹ khi validation lỗi */
export const errorShakeAnimation = {
  x: [0, -6, 6, -4, 4, -2, 2, 0],
  transition: {
    duration: 0.45,
    ease: [0.4, 0, 0.2, 1] as const,
  },
};

/** Thẻ khẩn cấp pulse 1 lần duy nhất lúc xuất hiện */
export const singlePulseAnimation = {
  scale: [0.98, 1.015, 1],
  boxShadow: [
    '0 2px 8px rgba(200, 82, 82, 0.08)',
    '0 8px 24px rgba(200, 82, 82, 0.28)',
    '0 2px 8px rgba(200, 82, 82, 0.08)',
  ],
  transition: {
    duration: 0.85,
    ease: MOTION_EASINGS.easeOutNatural,
    repeat: 0, // Tuyệt đối không lặp lại liên tục gây phân tâm
  },
};

/** Icon bồng bềnh êm ả cho Empty State */
export const floatingMotion = {
  y: [-3, 3, -3],
  transition: {
    duration: 3.6,
    repeat: Infinity,
    ease: [0.4, 0, 0.2, 1] as const,
  },
};

/**
 * Hàm điều chỉnh transition tôn trọng người dùng bật Reduced Motion
 */
export const getSafeTransition = (
  transition: Transition,
  prefersReduced: boolean | null
): Transition => {
  if (prefersReduced) {
    return { duration: 0.01 };
  }
  return transition;
};
