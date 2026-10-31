import type { ReactNode } from 'react';

import { managerStyles } from '../styles/manager-styles';

interface ManagerSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function ManagerSection({ title, children }: ManagerSectionProps) {
  return (
    <section style={managerStyles.section}>
      <h3
        style={{
          color: '#ffffff',
          fontSize: 15,
          fontWeight: 600,
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{children}</div>
    </section>
  );
}
