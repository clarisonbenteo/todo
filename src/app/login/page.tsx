'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './login.module.css';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-redirect se já estiver logado no Supabase Auth
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        localStorage.setItem('todo_user_session', data.session.user.id);
        window.location.href = '/';
      }
    };
    checkSession();
  }, [router]);

  const handleAuth = async (e: React.FormEvent, isLogin: boolean) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        
        if (error) {
          setErrorMessage(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          localStorage.setItem('todo_user_session', data.session.user.id);
          window.location.href = '/';
        } else {
          setErrorMessage("Login falhou: Nenhuma sessão foi criada.");
          setIsLoading(false);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        
        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          localStorage.setItem('todo_user_session', data.session.user.id);
          window.location.href = '/';
        } else {
          setErrorMessage("Conta criada! Mas a sessão não foi iniciada. Se a Confirmação de E-mail estiver ativada no Supabase, verifique seu e-mail.");
          setIsLoading(false);
        }
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao autenticar.');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2>Welcome Back</h2>
          <p>Sign in or create account (Supabase Auth)</p>
        </div>
        
        <form className={styles.form}>
          {errorMessage && (
            <div style={{ color: '#f85149', fontSize: '0.85rem', textAlign: 'center', marginBottom: '-0.5rem' }}>
              {errorMessage}
            </div>
          )}
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={(e) => handleAuth(e, true)}
              className={`${styles.submitBtn} ${isLoading ? styles.loading : ''}`}
              disabled={isLoading}
              style={{ flex: 1 }}
            >
              {isLoading ? 'Wait...' : 'Sign In'}
            </button>
            <button 
              type="button" 
              onClick={(e) => handleAuth(e, false)}
              className={styles.submitBtn}
              disabled={isLoading}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'var(--foreground)' }}
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
