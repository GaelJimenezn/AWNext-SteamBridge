import type { CSSProperties } from 'react';

export const managerStyles = {
  panel: {
    color: '#c7d5e0',
    padding: '4px 0',
    fontFamily: 'Arial, sans-serif',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  muted: {
    color: '#91a7b8',
    fontSize: 12,
    lineHeight: 1.5,
  },
} satisfies Record<string, CSSProperties>;
