import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION_SPRINGS } from '../../tokens/motionTokens';

interface SpringSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  activeColor?: string;
  inactiveColor?: string;
  id?: string;
}

export const SpringSwitch: React.FC<SpringSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  activeColor = '#D96B43', // Terracotta Sun
  inactiveColor = '#E2D9CB', // Linen / Warm Slate Muted
  id,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const dimensions = {
    sm: { width: 36, height: 20, circle: 14, offset: 3 },
    md: { width: 44, height: 24, circle: 18, offset: 3 },
    lg: { width: 54, height: 30, circle: 24, offset: 3 },
  }[size];

  const toggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        className="focus-ring-accent"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          borderRadius: `${dimensions.height / 2}px`,
          backgroundColor: checked ? activeColor : inactiveColor,
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: checked
            ? `0 2px 8px ${activeColor}40`
            : 'inset 0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <motion.div
          layout={!shouldReduceMotion}
          transition={MOTION_SPRINGS.switchPhysics}
          style={{
            width: `${dimensions.circle}px`,
            height: `${dimensions.circle}px`,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 6px rgba(45, 40, 37, 0.22)',
            position: 'absolute',
            left: checked
              ? `${dimensions.width - dimensions.circle - dimensions.offset}px`
              : `${dimensions.offset}px`,
          }}
          whileTap={!shouldReduceMotion && !disabled ? { scaleX: 1.18, scaleY: 0.92 } : undefined}
        />
      </button>

      {label && (
        <span
          style={{
            fontSize: size === 'sm' ? '0.78rem' : '0.85rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
};
