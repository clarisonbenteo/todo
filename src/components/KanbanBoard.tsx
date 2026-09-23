'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Task = { 
  id: string; 
  title: string; 
  description: string; 
  column_id: string; 
  position: number;
  tags: string[];
  due_date: string | null;
};
type Column = { id: string; title: string; color: string; taskIds: string[] };
type BoardData = {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
};

const initialColumns = {
  'col-1': { id: 'col-1', title: 'Backlog', color: 'var(--color-backlog)', taskIds: [] },
  'col-2': { id: 'col-2', title: 'Ready', color: 'var(--color-ready)', taskIds: [] },
  'col-3': { id: 'col-3', title: 'In progress', color: 'var(--color-in-progress)', taskIds: [] },
  'col-4': { id: 'col-4', title: 'In review', color: 'var(--color-in-review)', taskIds: [] },
  'col-5': { id: 'col-5', title: 'Done', color: 'var(--color-done)', taskIds: [] },
};
const columnOrder = ['col-1', 'col-2', 'col-3', 'col-4', 'col-5'];

export default function KanbanBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', tags: '', due_date: '' });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data: dbTasks, error } = await supabase
      .from('todo_tasks')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      setErrorMsg(`Erro de conexão com Supabase: ${error.message}. Certifique-se de que a tabela 'todo_tasks' foi criada com as colunas corretas.`);
      return;
    }

    const tasksObj: Record<string, Task> = {};
    const colsObj = JSON.parse(JSON.stringify(initialColumns)); // deep copy

    (dbTasks || []).forEach((t) => {
      // Ensure tags is an array
      const taskWithDefaults = { ...t, tags: t.tags || [] };
      tasksObj[t.id] = taskWithDefaults;
      if (colsObj[t.column_id]) {
        colsObj[t.column_id].taskIds.push(t.id);
      }
    });

    setData({ tasks: tasksObj, columns: colsObj, columnOrder });
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    if (!data) return;

    const startColumn = data.columns[source.droppableId];
    const finishColumn = data.columns[destination.droppableId];

    if (startColumn === finishColumn) {
      const newTaskIds = Array.from(startColumn.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...startColumn, taskIds: newTaskIds };
      setData({ ...data, columns: { ...data.columns, [newColumn.id]: newColumn } });

      // Update positions in DB
      newTaskIds.forEach(async (id, idx) => {
        await supabase.from('todo_tasks').update({ position: idx }).eq('id', id);
      });
      return;
    }

    // Moving to another column
    const startTaskIds = Array.from(startColumn.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = { ...startColumn, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finishColumn.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finishColumn, taskIds: finishTaskIds };

    setData({
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    });

    // Update moved task column and position
    await supabase.from('todo_tasks').update({ 
      column_id: finishColumn.id,
      position: destination.index
    }).eq('id', draggableId);

    // Update positions in start column
    startTaskIds.forEach(async (id, idx) => {
      await supabase.from('todo_tasks').update({ position: idx }).eq('id', id);
    });

    // Update positions in finish column
    finishTaskIds.forEach(async (id, idx) => {
      await supabase.from('todo_tasks').update({ position: idx }).eq('id', id);
    });
  };

  const openAddTaskModal = (columnId: string) => {
    setActiveColumnId(columnId);
    setFormData({ title: '', description: '', tags: '', due_date: '' });
    setIsModalOpen(true);
  };

  const submitNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !activeColumnId) return;

    setIsModalOpen(false); // Close immediately for optimistic feel
    const position = data ? data.columns[activeColumnId].taskIds.length : 0;
    const parsedTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

    const { data: insertedData, error } = await supabase
      .from('todo_tasks')
      .insert([{ 
        title: formData.title, 
        description: formData.description, 
        column_id: activeColumnId, 
        position,
        tags: parsedTags,
        due_date: formData.due_date || null
      }])
      .select();

    if (error) {
      console.error('Error adding task:', error);
      alert('Erro ao salvar no Supabase: ' + error.message);
      return;
    }

    if (!insertedData || insertedData.length === 0) {
      alert('A tarefa foi enviada, mas o Supabase não retornou os dados. Verifique se a Policy (RLS) tem permissão de INSERT e SELECT.');
      return;
    }

    if (insertedData && insertedData.length > 0 && data) {
      const newTask = { ...insertedData[0], tags: insertedData[0].tags || [] };
      const column = data.columns[activeColumnId];
      const newTaskIds = Array.from(column.taskIds);
      newTaskIds.push(newTask.id);

      setData({
        ...data,
        tasks: { ...data.tasks, [newTask.id]: newTask },
        columns: { ...data.columns, [activeColumnId]: { ...column, taskIds: newTaskIds } },
      });
    }
  };

  const deleteTask = async (taskId: string, columnId: string) => {
    if (!confirm('Excluir tarefa?')) return;
    
    await supabase.from('todo_tasks').delete().eq('id', taskId);
    
    if (data) {
      const newTasks = { ...data.tasks };
      delete newTasks[taskId];
      
      const column = data.columns[columnId];
      const newTaskIds = column.taskIds.filter(id => id !== taskId);
      
      setData({
        ...data,
        tasks: newTasks,
        columns: { ...data.columns, [columnId]: { ...column, taskIds: newTaskIds } }
      });
    }
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  if (errorMsg) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>⚠️ Falha ao carregar o quadro</h2>
        <p style={{ marginTop: '1rem', color: '#ff5555' }}>{errorMsg}</p>
        <p style={{ marginTop: '1rem' }}>
          Você rodou a query <code>ALTER TABLE</code> no Supabase? (Projeto evolucao-financeira)
        </p>
      </div>
    );
  }

  if (!data) return null; // Avoid hydration mismatch

  return (
    <>
      <div className="kanban-container">
        <DragDropContext onDragEnd={onDragEnd}>
          {data.columnOrder.map((columnId) => {
            const column = data.columns[columnId];
            const tasks = column.taskIds.map((taskId) => data.tasks[taskId]).filter(Boolean);

            return (
              <div key={column.id} className="kanban-column">
                <div className="column-header">
                  <div className="column-header-left">
                    <div className="status-circle" style={{ borderColor: column.color }} />
                    <span>{column.title}</span>
                    <span className="badge">{tasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => openAddTaskModal(column.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                      <Plus size={16} />
                    </button>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div className="task-list" ref={provided.innerRef} {...provided.droppableProps}>
                      {tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onDoubleClick={() => deleteTask(task.id, column.id)}
                              title="Duplo clique para excluir"
                              style={{
                                ...provided.draggableProps.style,
                                borderColor: snapshot.isDragging ? 'var(--card-hover-border)' : 'var(--card-border)',
                                boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.1)' : 'none',
                                zIndex: snapshot.isDragging ? 100 : 1
                              }}
                            >
                              <div className="card-title">{task.title}</div>
                              {task.description && <div className="card-desc">{task.description}</div>}
                              
                              {(task.tags?.length > 0 || task.due_date) && (
                                <div className="card-footer">
                                  <div className="tag-list">
                                    {task.tags?.map((tag, i) => (
                                      <span key={i} className="tag">{tag}</span>
                                    ))}
                                  </div>
                                  {task.due_date && (
                                    <div className={`due-date ${isOverdue(task.due_date) ? 'overdue' : ''}`}>
                                      <Calendar size={12} />
                                      {formatDate(task.due_date)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </DragDropContext>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Nova Tarefa</h2>
            <form onSubmit={submitNewTask}>
              <div className="form-group">
                <label>Título</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  autoFocus
                  placeholder="Nome da tarefa"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Descricão (Opcional)</label>
                <textarea 
                  className="form-input" 
                  rows={3}
                  placeholder="Detalhes adicionais"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Etiquetas (separadas por vírgula)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ex: urgente, bug, ui"
                  value={formData.tags}
                  onChange={e => setFormData({...formData, tags: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Prazo (Opcional)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
