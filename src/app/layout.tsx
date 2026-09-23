import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'TODO - Kanban Manager',
  description: 'Minimalist Kanban Board',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <header style={{ 
            height: '64px', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem'
          }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>TO-DOs</h1>
            <ThemeToggle />
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
