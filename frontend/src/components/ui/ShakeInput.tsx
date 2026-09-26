import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { errorShakeAnimation, MOTION_SPRINGS } from '../../tokens/motionTokens';

interface ShakeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  errorMessage?: string | null;
  triggerShakeKey?: any; // Khi prop này thay đổi và có errorMessage, input sẽ rung nhẹ
}

export const ShakeInput: React.FC<ShakeInputProps> = ({
  label,
  errorMessage,
  triggerShakeKey,
  id,
  className = '',
  style,
  ...props
}) => {
  const [shouldShake, setShouldShake] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (errorMessage) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, triggerShakeKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '0.84rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </label>
      )}

      <motion.div
        animate={shouldShake && !shouldReduceMotion ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
        transition={shouldShake && !shouldReduceMotion ? errorShakeAnimation.transition : undefined}
        style={{ width: '100%' }}
      >
        <input
          id={id}
          {...props}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            border: errorMessage ? '1.5px solid #C85252' : '1px solid #E5DFD5',
            backgroundColor: '#FFFFFF',
            fontSize: '0.88rem',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: errorMessage ? '0 0 0 3px rgba(200, 82, 82, 0.15)' : 'none',
            ...style,
          }}
          onFocus={(e) => {
            if (!errorMessage) {
              e.currentTarget.style.borderColor = '#D96B43';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217, 107, 67, 0.18)';
            }
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            if (!errorMessage) {
              e.currentTarget.style.borderColor = '#E5DFD5';
              e.currentTarget.style.boxShadow = 'none';
            }
            props.onBlur?.(e);
          }}
        />
      </motion.div>

      {/* Validation Error message slide-in */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={MOTION_SPRINGS.snappy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#C85252',
              fontSize: '0.78rem',
              fontWeight: 500,
              overflow: 'hidden',
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
