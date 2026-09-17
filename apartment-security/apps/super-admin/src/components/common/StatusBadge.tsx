import React from 'react';
import { SocietyStatus, DemoRequestStatus } from '../../types';

interface StatusBadgeProps {
  status: SocietyStatus | DemoRequestStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toLowerCase();
  
  return (
    <span className={`badge badge-${normalized}`}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
      {status}
    </span>
  );
};
