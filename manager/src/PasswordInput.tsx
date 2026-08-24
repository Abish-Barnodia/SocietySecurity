import React, { useState } from 'react';
import Icon from './Icon';

// Drop-in replacement for <input type="password" ... /> — same props work
// unchanged, just adds a show/hide toggle so managers can verify what
// they typed before submitting (guard/resident/manager creation all set a
// login password someone else has to actually use).
export default function PasswordInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input {...props} type={visible ? 'text' : 'password'} style={{ ...style, paddingRight: 40 }} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          color: 'var(--text-muted)',
        }}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
      </button>
    </div>
  );
}
