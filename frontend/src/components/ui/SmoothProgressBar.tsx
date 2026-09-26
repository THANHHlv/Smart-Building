import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION_SPRINGS } from '../../tokens/motionTokens';

interface SmoothProgressBarProps {
  progress: number; // 0 đến 100
  height?: number;
  color?: string;
  showLabel?: boolean;
  label?: string;
}

export const SmoothProgressBar: React.FC<SmoothProgressBarProps> = ({
  progress,
  height = 8,
  color = '#D96B43', // Terracotta Sun
  showLabel = false,
  label,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(showLabel || label) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          {label && <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>}
          {showLabel && (
            <span
              style={{
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Track */}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: `${height / 2}px`,
          backgroundColor: '#EFE9DF',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Animated Bar Fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={
            shouldReduceMotion
              ? { duration: 0.01 }
              : { ...MOTION_SPRINGS.gentle, mass: 0.6 }
          }
          style={{
            height: '100%',
            backgroundColor: color,
            borderRadius: `${height / 2}px`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 0 10px ${color}50`,
          }}
        >
          {/* Subtle light sheen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%)',
              opacity: 0.6,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};
