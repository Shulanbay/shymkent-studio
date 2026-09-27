'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import type { ActionState } from '@/lib/admin/action-state';

export interface KanbanLead {
  id: string;
  status: string;
  clientName: string;
  title: string | null;
  expectedAmount: number | null;
  nextContact: string | null;
  overdue: boolean;
  assignee: string | null;
  source: string;
}

interface Props {
  columns: { status: string; label: string }[];
  leads: KanbanLead[];
  canManage: boolean;
  move: (input: { leadId: string; status: string; lostReason?: string }) => Promise<ActionState>;
}

/**
 * Drag-and-drop board. Every move is validated by the server (moveLeadAction);
 * on error the card snaps back. A select on each card offers the same moves
 * for keyboard and touch users.
 */
export function LeadKanban({ columns, leads: initial, canManage, move }: Props) {
  const [leads, setLeads] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lostFor, setLostFor] = useState<{ leadId: string; previous: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function apply(leadId: string, status: string, lostReason?: string) {
    const previous = leads.find((l) => l.id === leadId)?.status;
    if (!previous || previous === status) return;
    if (status === 'LOST' && !lostReason) {
      setLostFor({ leadId, previous });
      dialogRef.current?.showModal();
      setTimeout(() => reasonRef.current?.focus(), 0);
      return;
    }
    setError(null);
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status } : l)));
    startTransition(async () => {
      const result = await move({ leadId, status, lostReason });
      if (result.error) {
        setError(result.error);
        setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status: previous } : l)));
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
      <p className="sr-only" aria-live="polite">
        {pending ? 'Сохранение…' : ''}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col) => {
          const items = leads.filter((l) => l.status === col.status);
          return (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!canManage) return;
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
              className={`w-64 shrink-0 rounded-card border p-2 ${dragOver === col.status ? 'border-brand-strong bg-orange-50' : 'border-border-light bg-bg-light'}`}
            >
              <h2 className="text-sm font-bold px-1 py-1 flex justify-between">
                {col.label} <span className="text-text-secondary font-normal">{items.length}</span>
              </h2>
              <ul className="space-y-2 min-h-[4rem]">
                {items.map((lead) => (
                  <li
                    key={lead.id}
                    draggable={canManage}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                    className="bg-white border border-border-light rounded-xl p-3 text-sm shadow-sm cursor-grab active:cursor-grabbing"
                  >
                    <Link href={`/admin/leads/${lead.id}`} className="font-semibold hover:underline block">
                      {lead.clientName}
                    </Link>
                    {lead.title && <p className="text-text-secondary">{lead.title}</p>}
                    <p className="text-xs text-text-secondary mt-1">
                      {lead.source}
                      {lead.expectedAmount != null && ` · ${lead.expectedAmount.toLocaleString('ru-RU')} ₸`}
                    </p>
                    {lead.nextContact && (
                      <p className={`text-xs mt-1 ${lead.overdue ? 'text-red-700 font-semibold' : 'text-text-secondary'}`}>
                        Связаться: {lead.nextContact}
                      </p>
                    )}
                    {lead.assignee && <p className="text-xs text-text-secondary">👤 {lead.assignee}</p>}
                    {canManage && (
                      <label className="block mt-2">
                        <span className="sr-only">Переместить лид {lead.clientName}</span>
                        <select
                          value={lead.status}
                          onChange={(e) => apply(lead.id, e.target.value)}
                          className="w-full text-xs border border-border-light rounded-lg px-2 py-1 bg-white"
                        >
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

      <dialog ref={dialogRef} className="rounded-card p-5 max-w-sm w-full backdrop:bg-black/40" onClose={() => setLostFor(null)}>
        <form
          method="dialog"
          onSubmit={(e) => {
            const reason = reasonRef.current?.value.trim() ?? '';
            if (!lostFor || reason.length < 3) {
              e.preventDefault();
              return;
            }
            apply(lostFor.leadId, 'LOST', reason);
          }}
        >
          <h2 className="text-lg font-bold mb-2">Причина отказа</h2>
          <label htmlFor="lost-reason" className="text-sm text-text-secondary">
            Обязательно (не короче 3 символов)
          </label>
          <textarea id="lost-reason" ref={reasonRef} required minLength={3} maxLength={500} rows={3} className="w-full border border-border-light rounded-xl p-2 mt-1 text-sm" />
          <div className="flex gap-2 justify-end mt-3">
            <button type="button" onClick={() => dialogRef.current?.close()} className="px-3 py-1.5 rounded-xl border border-border-light text-sm">
              Отмена
            </button>
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-brand-gradient text-on-brand text-sm font-semibold">
              Сохранить
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
