import React from 'react';
import { Icon } from '@iconify/react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'solar:shield-warning-bold',
          iconColor: '#F43F5E',
          iconBg: 'rgba(244, 63, 94, 0.12)',
          iconBorder: 'rgba(244, 63, 94, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
          confirmBtnHover: '#9F1239',
          confirmBtnColor: '#FFFFFF',
          confirmBtnShadow: '0 4px 14px rgba(225, 29, 72, 0.35)',
        };
      case 'warning':
        return {
          icon: 'solar:danger-triangle-bold',
          iconColor: '#F59E0B',
          iconBg: 'rgba(245, 158, 11, 0.12)',
          iconBorder: 'rgba(245, 158, 11, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          confirmBtnHover: '#B45309',
          confirmBtnColor: '#FFFFFF',
          confirmBtnShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
        };
      case 'success':
        return {
          icon: 'solar:check-circle-bold',
          iconColor: '#10B981',
          iconBg: 'rgba(16, 185, 129, 0.12)',
          iconBorder: 'rgba(16, 185, 129, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #00C896 0%, #008764 100%)',
          confirmBtnHover: '#007A5A',
          confirmBtnColor: '#FFFFFF',
          confirmBtnShadow: '0 4px 14px rgba(0, 200, 150, 0.35)',
        };
      default:
        return {
          icon: 'solar:info-circle-bold',
          iconColor: '#00C896',
          iconBg: 'rgba(0, 200, 150, 0.12)',
          iconBorder: 'rgba(0, 200, 150, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #00C896 0%, #008764 100%)',
          confirmBtnHover: '#007A5A',
          confirmBtnColor: '#FFFFFF',
          confirmBtnShadow: '0 4px 14px rgba(0, 200, 150, 0.35)',
        };
    }
  };

  const styleConfig = getVariantStyles();

  return (
    <div
      className="modal-overlay"
      onClick={!isLoading ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 15, 25, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-color, #1F2937)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          padding: '24px',
          textAlign: 'center',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Icon Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: styleConfig.iconBg,
              border: `1px solid ${styleConfig.iconBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: styleConfig.iconColor,
            }}
          >
            <Icon icon={styleConfig.icon} width="28" height="28" />
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            color: 'var(--text-primary, #F8FAFC)',
            marginBottom: '10px',
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>

        {/* Message body */}
        <div
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-muted, #94A3B8)',
            lineHeight: 1.55,
            marginBottom: '24px',
          }}
        >
          {message}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '11px 16px',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRadius: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              background: styleConfig.confirmBtnBg,
              color: styleConfig.confirmBtnColor,
              boxShadow: styleConfig.confirmBtnShadow,
              border: 'none',
              padding: '11px 16px',
              fontWeight: 700,
              fontSize: '0.875rem',
              borderRadius: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <>
                <Icon icon="solar:restart-bold" className="animate-spin" width="16" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
