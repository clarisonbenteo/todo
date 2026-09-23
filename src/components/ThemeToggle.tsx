'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div style={{ width: 32, height: 32 }} />;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--foreground)',
        cursor: 'pointer',
        padding: '0.5rem',
        borderRadius: 'var(--border-radius-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      title="Toggle Theme"
    >
      {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
