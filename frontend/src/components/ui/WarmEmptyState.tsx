import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { floatingMotion } from '../../tokens/motionTokens';

interface WarmEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export const WarmEmptyState: React.FC<WarmEmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  compact = false,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '28px 20px' : '48px 24px',
        background: '#FAF8F4',
        border: '1px dashed #E5DFD5',
        borderRadius: '16px',
        width: '100%',
      }}
    >
      {/* Floating Animated Icon */}
      <motion.div
        animate={!shouldReduceMotion ? { y: [-3, 3, -3] } : undefined}
        transition={floatingMotion.transition}
        style={{
          width: compact ? '48px' : '64px',
          height: compact ? '48px' : '64px',
          borderRadius: compact ? '14px' : '18px',
          background: '#FFFFFF',
          border: '1px solid #EFE9DF',
          boxShadow: '0 4px 16px rgba(45, 40, 37, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#D96B43',
          marginBottom: compact ? '12px' : '16px',
        }}
      >
        {icon || <Sparkles size={compact ? 24 : 30} />}
      </motion.div>

      <h3
        style={{
          fontSize: compact ? '0.95rem' : '1.1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: compact ? '0.8rem' : '0.86rem',
            color: 'var(--text-secondary)',
            maxWidth: '380px',
            margin: '6px 0 0 0',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="interactive-btn focus-ring-accent"
          style={{
            marginTop: '16px',
            background: '#D96B43',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 18px',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
