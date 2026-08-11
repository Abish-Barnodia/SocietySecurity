import React from 'react';
import { Icon as Iconify } from '@iconify/react';

// Thin wrapper so call sites keep the same size/color/className/style shape
// they used with lucide-react — only the import and icon name change.
export default function Icon({ name, size = 16, color, className, style }: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Iconify icon={`tabler:${name}`} width={size} height={size} color={color} className={className} style={style} />;
}
