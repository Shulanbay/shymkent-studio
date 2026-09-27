'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ActionState } from '@/lib/admin/action-state';

export interface KanbanTask {
  id: string;
  status: string;
  title: string;
  typeLabel: string;
  booking: string;
  client: string;
  due: string | null;
  overdue: boolean;
  assignee: string | null;
  priority: string;
  priorityClass: string;
  comments: number;
  /** Whether the current user may move this card (own task / manager). */
  movable: boolean;
}

interface Props {
  columns: { status: string; label: string }[];
  tasks: KanbanTask[];
  move: (input: { taskId: string; status: string }) => Promise<ActionState>;
}

export function TaskKanban({ columns, tasks: initial, move }: Props) {
  const [tasks, setTasks] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function apply(taskId: string, status: string) {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous || previous.status === status || !previous.movable) return;
    setError(null);
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    startTransition(async () => {
      const result = await move({ taskId, status });
      if (result.error) {
        setError(result.error);
        setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: previous.status } : t)));
      }
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col) => {
          const items = tasks.filter((t) => t.status === col.status);
          return (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.status);
              }}
              onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) apply(id, col.status);
              }}
              className={`w-72 shrink-0 rounded-card border p-2 ${dragOver === col.status ? 'border-brand-strong bg-orange-50' : 'border-border-light bg-bg-light'}`}
            >
              <h2 className="text-sm font-bold px-1 py-1 flex justify-between">
                {col.label} <span className="text-text-secondary font-normal">{items.length}</span>
              </h2>
              <ul className="space-y-2 min-h-[4rem]">
                {items.map((task) => (
                  <li
                    key={task.id}
                    draggable={task.movable}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                    className={`bg-white border border-border-light rounded-xl p-3 text-sm shadow-sm ${task.movable ? 'cursor-grab' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-text-secondary">{task.typeLabel}</span>
                      <span className={`text-xs px-1.5 rounded-full ${task.priorityClass}`}>{task.priority}</span>
                    </div>
                    <Link href={`/admin/production/${task.id}`} className="font-semibold hover:underline block">
                      {task.title}
                    </Link>
                    <p className="text-xs text-text-secondary">
                      {task.booking} · {task.client}
                    </p>
                    {task.due && <p className={`text-xs ${task.overdue ? 'text-red-700 font-semibold' : 'text-text-secondary'}`}>Срок: {task.due}</p>}
                    <p className="text-xs text-text-secondary">
                      {task.assignee ? `👤 ${task.assignee}` : 'Не назначен'}
                      {task.comments > 0 && ` · 💬 ${task.comments}`}
                    </p>
                    {task.movable && (
                      <label className="block mt-2">
                        <span className="sr-only">Статус задачи {task.title}</span>
                        <select value={task.status} onChange={(e) => apply(task.id, e.target.value)} className="w-full text-xs border border-border-light rounded-lg px-2 py-1 bg-white">
                          {columns.map((c) => (
                            <option key={c.status} value={c.status}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
