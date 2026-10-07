'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import KanbanBoard from '@/components/KanbanBoard';

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('todo_user_session');
    if (!session) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return null; // Oculta a página até verificar o acesso
  }

  return (
    <main>
      <KanbanBoard />
    </main>
  );
}
