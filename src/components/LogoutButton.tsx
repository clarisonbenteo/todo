'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LogoutButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Só renderiza o botão se houver sessão ativa
    if (localStorage.getItem('todo_user_session')) {
      setIsVisible(true);
    }
  }, []);

  const handleLogout = async () => {
    // Checagem de segurança global (definida pelo Scratchpad ou outros componentes)
    const hasUnsaved = (window as any).hasUnsavedChanges;
    
    if (hasUnsaved) {
      const confirmLogout = window.confirm(
        "Atenção: Existem rascunhos que ainda estão sendo sincronizados com o servidor!\n\nTem certeza que deseja sair agora e arriscar perder os últimos caracteres digitados?"
      );
      if (!confirmLogout) return;
    }

    // Desloga no Supabase para invalidar o token real
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();

    localStorage.removeItem('todo_user_session');
    window.location.href = '/login'; // Força redirecionamento limpando a memória do React
  };

  if (!isVisible) return null;

  return (
    <button 
      onClick={handleLogout} 
      title="Sair da Conta"
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: '0.5rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#f85149';
        e.currentTarget.style.background = 'rgba(248, 81, 73, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <LogOut size={20} />
    </button>
  );
}
