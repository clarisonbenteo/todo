'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, X, Plus, WrapText, Braces, Database, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './Scratchpad.module.css';

type Tab = {
  id: string;
  name: string;
  content: string;
  is_wrapped: boolean;
  format: 'text' | 'json' | 'sql';
};

export function Scratchpad() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({}); // true = saved, false = pending
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAnyUnsaved = Object.values(syncStatus).some(status => status === false);
      (window as any).hasUnsavedChanges = isAnyUnsaved;
    }
  }, [syncStatus]);
  
  const linesRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar dados do Supabase
  useEffect(() => {
    setIsRendered(true);
    const loadTabs = async () => {
      let { data: authData } = await supabase.auth.getSession();
      let userId = authData.session?.user.id;
      
      if (!userId) {
        const userRes = await supabase.auth.getUser();
        userId = userRes.data.user?.id;
      }
      if (!userId) return;

      const { data, error } = await supabase
        .from('todo_scratchpads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error("Erro ao carregar abas:", error);
      }

      if (data && data.length > 0) {
        setTabs(data);
        setActiveTabId(data[0].id);
        
        const initialStatus: Record<string, boolean> = {};
        data.forEach(t => initialStatus[t.id] = true);
        setSyncStatus(initialStatus);
      } else {
        // Cria a primeira aba se o usuário não tiver nenhuma
        const newTab: Tab = { id: Date.now().toString(), name: 'Aba 1', content: '', is_wrapped: false, format: 'text' };
        const { error: insertError } = await supabase.from('todo_scratchpads').insert({ ...newTab, user_id: userId });
        if (insertError) console.error("Erro ao criar aba inicial:", insertError);
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        setSyncStatus({ [newTab.id]: true });
      }
    };
    loadTabs();
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const saveToDb = async (tabToSave: Tab) => {
    const { data: authData } = await supabase.auth.getSession();
    const userId = authData.session?.user.id;
    if (!userId) return;
    
    const { error } = await supabase.from('todo_scratchpads').upsert({ 
      ...tabToSave, 
      user_id: userId, 
      updated_at: new Date().toISOString() 
    });
    
    if (error) {
      console.error("Erro ao salvar no banco:", error);
    } else {
      setSyncStatus(prev => ({ ...prev, [tabToSave.id]: true }));
    }
  };

  const updateActiveTab = (updates: Partial<Tab>) => {
    if (!activeTab) return;
    
    let updatedTab: Tab | null = null;
    const newTabs = tabs.map(t => {
      if (t.id === activeTabId) {
        updatedTab = { ...t, ...updates };
        return updatedTab;
      }
      return t;
    });
    setTabs(newTabs);
    setSyncStatus(prev => ({ ...prev, [activeTabId]: false }));

    // Salva automaticamente no banco com 300ms de debounce para não travar a digitação
    if (updatedTab) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveToDb(updatedTab!);
      }, 300);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, tabId: string) => {
    const newName = e.target.value.substring(0, 10); // Limita a 10 caracteres
    let updatedTab: Tab | null = null;
    const newTabs = tabs.map(t => {
      if (t.id === tabId) {
        updatedTab = { ...t, name: newName };
        return updatedTab;
      }
      return t;
    });
    setTabs(newTabs);
    setSyncStatus(prev => ({ ...prev, [tabId]: false }));

    if (updatedTab) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveToDb(updatedTab!), 300);
    }
  };

  const finishEditing = (tabId: string) => {
    setEditingTabId(null);
    const t = tabs.find(tab => tab.id === tabId);
    if (t && !t.name.trim()) {
      handleNameChange({ target: { value: 'Aba' } } as React.ChangeEvent<HTMLInputElement>, tabId);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateActiveTab({ content: e.target.value });
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (linesRef.current) {
      linesRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const addTab = async () => {
    const { data: authData } = await supabase.auth.getSession();
    const userId = authData.session?.user.id;
    if (!userId) return;

    const newId = Date.now().toString();
    const newTab: Tab = { id: newId, name: `Aba ${tabs.length + 1}`, content: '', is_wrapped: false, format: 'text' };
    
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setSyncStatus(prev => ({ ...prev, [newId]: false }));
    
    const { error } = await supabase.from('todo_scratchpads').insert({ ...newTab, user_id: userId });
    if (!error) {
      setSyncStatus(prev => ({ ...prev, [newId]: true }));
    }
  };

  const closeTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
    
    await supabase.from('todo_scratchpads').delete().eq('id', id);
  };

  const formatJson = () => {
    if (!activeTab) return;
    if (activeTab.format === 'json') {
      updateActiveTab({ format: 'text' });
      return;
    }
    try {
      if (activeTab.content.trim()) {
        const formatted = JSON.stringify(JSON.parse(activeTab.content), null, 2);
        updateActiveTab({ content: formatted, format: 'json' });
      } else {
        updateActiveTab({ format: 'json' });
      }
    } catch (e) {
      alert("Texto não é um JSON válido!");
    }
  };

  const formatSql = () => {
    if (!activeTab) return;
    if (activeTab.format === 'sql') {
      updateActiveTab({ format: 'text' });
      return;
    }
    let sql = activeTab.content;
    const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP BY', 'ORDER BY', 'LIMIT'];
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      sql = sql.replace(regex, kw);
    });
    updateActiveTab({ content: sql, format: 'sql' });
  };

  if (!isRendered) return <div style={{ width: 32, height: 32 }} />;
  if (!activeTab) return <div style={{ width: 32, height: 32 }} />; // Loading state

  const lineCount = activeTab.content.split('\n').length;
  const lines = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  const getFormatColor = (format: string) => {
    if (format === 'json') return 'var(--color-in-review)';
    if (format === 'sql') return 'var(--color-ready)';
    return 'var(--text-muted)';
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={styles.iconBtn} title="Abrir Scratchpad">
        <StickyNote size={20} />
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            
            {/* Header / Tabs */}
            <div className={styles.header}>
              <div className={styles.tabsContainer}>
                {tabs.map(tab => (
                  <div 
                    key={tab.id} 
                    className={`${styles.tab} ${tab.id === activeTabId ? styles.activeTab : ''}`}
                    onClick={() => setActiveTabId(tab.id)}
                    onDoubleClick={() => setEditingTabId(tab.id)}
                    title="Duplo clique para renomear"
                  >
                    {editingTabId === tab.id ? (
                      <input 
                        type="text" 
                        value={tab.name} 
                        onChange={(e) => handleNameChange(e, tab.id)}
                        onBlur={() => finishEditing(tab.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') finishEditing(tab.id) }}
                        autoFocus
                        maxLength={10}
                        className={styles.tabInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{tab.name}</span>
                        <Save 
                          size={12} 
                          style={{ 
                            color: syncStatus[tab.id] ? 'var(--color-ready)' : 'var(--text-muted)', 
                            opacity: syncStatus[tab.id] ? 1 : 0.3 
                          }} 
                          title={syncStatus[tab.id] ? "Salvo" : "Salvando..."}
                        />
                      </div>
                    )}
                    {tabs.length > 1 && (
                      <button className={styles.closeTabBtn} onClick={(e) => closeTab(e, tab.id)}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button className={styles.addTabBtn} onClick={addTab} title="Nova Aba">
                  <Plus size={16} />
                </button>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
              <button 
                className={`${styles.toolBtn} ${activeTab.is_wrapped ? styles.activeTool : ''}`} 
                onClick={() => updateActiveTab({ is_wrapped: !activeTab.is_wrapped })}
                title="Quebra de Linha Automática"
              >
                <WrapText size={16} />
              </button>
              
              <div className={styles.toolbarDivider}></div>

              <button 
                className={`${styles.toolBtn} ${activeTab.format === 'json' ? styles.activeTool : ''}`} 
                onClick={formatJson}
                style={{ color: activeTab.format === 'json' ? getFormatColor('json') : '' }}
                title="Formatar / Colorir como JSON"
              >
                <Braces size={16} />
                <span>JSON</span>
              </button>

              <button 
                className={`${styles.toolBtn} ${activeTab.format === 'sql' ? styles.activeTool : ''}`} 
                onClick={formatSql}
                style={{ color: activeTab.format === 'sql' ? getFormatColor('sql') : '' }}
                title="Formatar / Colorir como SQL"
              >
                <Database size={16} />
                <span>SQL</span>
              </button>
            </div>

            {/* Editor */}
            <div className={styles.editorContainer}>
              {!activeTab.is_wrapped && (
                <div className={styles.lineNumbers} ref={linesRef}>
                  {lines.map(line => (
                    <div key={line} className={styles.lineNumber}>{line}</div>
                  ))}
                </div>
              )}
              <textarea
                className={`${styles.textarea} ${activeTab.format === 'json' ? styles.jsonFormat : ''} ${activeTab.format === 'sql' ? styles.sqlFormat : ''}`}
                style={{ whiteSpace: activeTab.is_wrapped ? 'pre-wrap' : 'pre' }}
                value={activeTab.content}
                onChange={handleChange}
                onBlur={() => saveToDb(activeTab)}
                onScroll={handleScroll}
                placeholder="Cole seus logs, textos longos ou rascunhos aqui..."
                autoFocus
                wrap={activeTab.is_wrapped ? "on" : "off"}
                spellCheck="false"
              />
            </div>

          </div>
        </div>
      )}
    </>
  );
}
