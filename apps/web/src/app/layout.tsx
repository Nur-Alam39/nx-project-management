import './global.css';

import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Mindstaq PM',
  description: 'Project management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-0">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
