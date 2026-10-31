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
  section: {
    padding: 15,
    background: '#1c2d3c',
    border: '1px solid #34485a',
    borderRadius: 5,
    marginTop: 14,
    minWidth: 0,
    boxSizing: 'border-box',
  },
  navigation: {
    display: 'flex',
    gap: 3,
    padding: 3,
    background: '#101c28',
    borderRadius: 5,
    marginTop: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    flex: '1 1 0',
    minWidth: 0,
    border: 0,
    borderRadius: 3,
    padding: '10px 3px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'background 120ms ease',
  },
  muted: {
    color: '#91a7b8',
    fontSize: 12,
    lineHeight: 1.5,
  },
} satisfies Record<string, CSSProperties>;
