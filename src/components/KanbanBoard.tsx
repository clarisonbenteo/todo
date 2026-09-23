'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { Plus, MoreHorizontal } from 'lucide-react';

type Task = { id: string; title: string; description: string };
type Column = { id: string; title: string; color: string; taskIds: string[] };
type BoardData = {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
};

const initialData: BoardData = {
  tasks: {
    'task-1': { id: 'task-1', title: 'Definir arquitetura inicial', description: 'Criar repositório e base do projeto.' },
    'task-2': { id: 'task-2', title: 'Revisar layout', description: 'Aplicar cores do HIG.' },
  },
  columns: {
    'col-1': { id: 'col-1', title: 'Backlog', color: 'var(--color-backlog)', taskIds: ['task-1'] },
    'col-2': { id: 'col-2', title: 'Ready', color: 'var(--color-ready)', taskIds: ['task-2'] },
    'col-3': { id: 'col-3', title: 'In progress', color: 'var(--color-in-progress)', taskIds: [] },
    'col-4': { id: 'col-4', title: 'In review', color: 'var(--color-in-review)', taskIds: [] },
    'col-5': { id: 'col-5', title: 'Done', color: 'var(--color-done)', taskIds: [] },
  },
  columnOrder: ['col-1', 'col-2', 'col-3', 'col-4', 'col-5'],
};

export default function KanbanBoard() {
  const [data, setData] = useState<BoardData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('todo-kanban-state');
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {
        setData(initialData);
      }
    } else {
      setData(initialData);
    }
  }, []);

  useEffect(() => {
    if (data) {
      localStorage.setItem('todo-kanban-state', JSON.stringify(data));
    }
  }, [data]);

  const onDragEnd = (result: DropResult) => {
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
      setData({
        ...data,
        columns: { ...data.columns, [newColumn.id]: newColumn },
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
  };

  const addNewTask = (columnId: string) => {
    const title = prompt('Título da Tarefa:');
    if (!title) return;
    
    const description = prompt('Descrição (opcional):') || '';
    const newTaskId = `task-${uuidv4()}`;
    const newTask = { id: newTaskId, title, description };

    if (data) {
      const column = data.columns[columnId];
      const newTaskIds = Array.from(column.taskIds);
      newTaskIds.push(newTaskId);

      setData({
        ...data,
        tasks: { ...data.tasks, [newTaskId]: newTask },
        columns: {
          ...data.columns,
          [columnId]: { ...column, taskIds: newTaskIds },
        },
      });
    }
  };

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
                  <div
                    className="task-list"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            className="task-card"
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
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
