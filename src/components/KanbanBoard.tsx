'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Task = { id: string; title: string; description: string; column_id: string; position: number };
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
      setErrorMsg(`Erro de conexão com Supabase: ${error.message}. Certifique-se de que a tabela 'todo_tasks' foi criada.`);
      return;
    }

    const tasksObj: Record<string, Task> = {};
    const colsObj = JSON.parse(JSON.stringify(initialColumns)); // deep copy

    (dbTasks || []).forEach((t) => {
      tasksObj[t.id] = t;
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

  const addNewTask = async (columnId: string) => {
    const title = prompt('Título da Tarefa:');
    if (!title) return;
    
    const description = prompt('Descrição (opcional):') || '';
    
    const position = data ? data.columns[columnId].taskIds.length : 0;

    const { data: insertedData, error } = await supabase
      .from('todo_tasks')
      .insert([{ title, description, column_id: columnId, position }])
      .select();

    if (error) {
      console.error('Error adding task:', error);
      return;
    }

    if (insertedData && insertedData.length > 0 && data) {
      const newTask = insertedData[0];
      const column = data.columns[columnId];
      const newTaskIds = Array.from(column.taskIds);
      newTaskIds.push(newTask.id);

      setData({
        ...data,
        tasks: { ...data.tasks, [newTask.id]: newTask },
        columns: { ...data.columns, [columnId]: { ...column, taskIds: newTaskIds } },
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

  if (errorMsg) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>⚠️ Falha ao carregar o quadro</h2>
        <p style={{ marginTop: '1rem', color: '#ff5555' }}>{errorMsg}</p>
        <p style={{ marginTop: '1rem' }}>
          Para criar a tabela, acesse o seu Supabase (projeto evolucao-financeira), vá em <strong>SQL Editor</strong> e rode:
        </p>
        <pre style={{ background: 'var(--card-bg)', padding: '1rem', marginTop: '1rem', textAlign: 'left', display: 'inline-block', borderRadius: '6px' }}>
{`create table public.todo_tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  column_id text not null,
  position integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
        </pre>
      </div>
    );
  }

  if (!data) return null; // Avoid hydration mismatch

  return (
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
                  <button onClick={() => addNewTask(column.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
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
  );
}
