'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Calendar, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Task = { 
  id: string; 
  title: string; 
  description: string; 
  column_id: string; 
  position: number;
  tags: string[];
  due_date: string | null;
  created_at: string;
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

const priorityWeight: Record<string, number> = { 'Alto': 3, 'Médio': 2, 'Baixo': 1 };

const sortTaskIds = (taskIds: string[], tasksObj: Record<string, Task>) => {
  return [...taskIds].sort((a, b) => {
    const pA = priorityWeight[tasksObj[a]?.tags?.[0] || 'Baixo'] || 1;
    const pB = priorityWeight[tasksObj[b]?.tags?.[0] || 'Baixo'] || 1;
    return pB - pA;
  });
};

export default function KanbanBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'Baixo', due_date: '' });

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

    Object.values(colsObj).forEach((col: any) => {
      col.taskIds = sortTaskIds(col.taskIds, tasksObj);
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
      let newTaskIds = Array.from(startColumn.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      newTaskIds = sortTaskIds(newTaskIds, data.tasks);

      const newColumn = { ...startColumn, taskIds: newTaskIds };
      setData({ ...data, columns: { ...data.columns, [newColumn.id]: newColumn } });

      // Update positions in DB
      newTaskIds.forEach(async (id, idx) => {
        await supabase.from('todo_tasks').update({ position: idx }).eq('id', id);
      });
      return;
    }

    // Moving to another column
    let startTaskIds = Array.from(startColumn.taskIds);
    startTaskIds.splice(source.index, 1);
    startTaskIds = sortTaskIds(startTaskIds, data.tasks);
    const newStart = { ...startColumn, taskIds: startTaskIds };

    let finishTaskIds = Array.from(finishColumn.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    finishTaskIds = sortTaskIds(finishTaskIds, data.tasks);
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
    setEditingTaskId(null);
    setFormData({ title: '', description: '', priority: 'Baixo', due_date: '' });
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setActiveColumnId(task.column_id);
    setEditingTaskId(task.id);
    setFormData({ 
      title: task.title, 
      description: task.description || '', 
      priority: task.tags?.[0] || 'Baixo', 
      due_date: task.due_date || '' 
    });
    setIsModalOpen(true);
  };

  const submitNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !activeColumnId) return;

    setIsModalOpen(false); // Close immediately for optimistic feel
    const position = data ? data.columns[activeColumnId].taskIds.length : 0;
    const priorityArray = [formData.priority];

    if (editingTaskId) {
      const { data: updatedData, error } = await supabase
        .from('todo_tasks')
        .update({
          title: formData.title,
          description: formData.description,
          tags: priorityArray,
          due_date: formData.due_date || null
        })
        .eq('id', editingTaskId)
        .select();

      if (error) {
        alert('Erro ao atualizar no Supabase: ' + error.message);
        return;
      }
      if (updatedData && updatedData.length > 0 && data) {
        const updatedTask = { ...updatedData[0], tags: updatedData[0].tags || [] };
        const updatedTasks = { ...data.tasks, [updatedTask.id]: updatedTask };
        
        const columnId = updatedTask.column_id;
        const column = data.columns[columnId];
        let newTaskIds = Array.from(column.taskIds);
        newTaskIds = sortTaskIds(newTaskIds, updatedTasks);

        setData({
          ...data,
          tasks: updatedTasks,
          columns: { ...data.columns, [columnId]: { ...column, taskIds: newTaskIds } }
        });
      }
    } else {
      const { data: insertedData, error } = await supabase
        .from('todo_tasks')
        .insert([{ 
          title: formData.title, 
          description: formData.description, 
          column_id: activeColumnId, 
          position,
          tags: priorityArray,
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
        let newTaskIds = Array.from(column.taskIds);
        newTaskIds.push(newTask.id);
        
        const updatedTasks = { ...data.tasks, [newTask.id]: newTask };
        newTaskIds = sortTaskIds(newTaskIds, updatedTasks);

        setData({
          ...data,
          tasks: updatedTasks,
          columns: { ...data.columns, [activeColumnId]: { ...column, taskIds: newTaskIds } },
        });
      }
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
    
    let date;
    if (dateString.length === 10) {
      const [year, month, day] = dateString.split('-');
      date = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      date = new Date(dateString);
      date.setHours(0, 0, 0, 0);
    }
    
    return date < today;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    if (dateString.length === 10) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}`;
    }

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
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
                              <div className="card-header">
                                <div className="card-title">{task.title}</div>
                              </div>
                              {task.description && <div className="card-desc">{task.description}</div>}
                              
                              <div className="card-footer">
                                <div className="created-date">
                                  {formatDate(task.created_at)}
                                </div>
                                <div className="footer-center">
                                  {task.tags?.length > 0 && (
                                    <div className="tag-list">
                                      <span className={`tag priority-${task.tags[0].replace('é', 'e')}`}>
                                        {task.tags[0]}
                                      </span>
                                    </div>
                                  )}
                                  <div className="edit-btn" onClick={() => openEditTaskModal(task)} title="Editar Tarefa">
                                    <Edit2 size={12} />
                                  </div>
                                </div>
                                <div className="due-date-wrapper">
                                  {task.due_date && (
                                    <div className={`due-date ${isOverdue(task.due_date) ? 'overdue' : ''}`}>
                                      <Calendar size={12} />
                                      {formatDate(task.due_date)}
                                    </div>
                                  )}
                                </div>
                              </div>
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
            <h2 className="modal-title">{editingTaskId ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
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
                <label>Prioridade</label>
                <select 
                  className="form-input" 
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value})}
                >
                  <option value="Alto">Alto</option>
                  <option value="Médio">Médio</option>
                  <option value="Baixo">Baixo</option>
                </select>
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
