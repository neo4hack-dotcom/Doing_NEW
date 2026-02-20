
import React, { useState, useMemo } from 'react';
import {
  Plus, Bot, Search, CheckCircle2, Circle, AlertCircle, PauseCircle, XCircle,
  Trash2, Edit3, X, Tag, Link, Clock, Zap, Calendar, Repeat, Flag,
  ChevronDown, ChevronUp, ExternalLink, Paperclip, Brain, LayoutGrid, List,
  Filter, ArrowUp, ArrowRight, ArrowDown, Minus
} from 'lucide-react';
import { SmartTodo, TodoStatus, TodoPriorityLevel, EnergyLevel, User, LLMConfig } from '../types';
import { generateId } from '../services/storage';
import AITodoBotSidebar from './AITodoBotSidebar';

// ── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const isOverdue = (todo: SmartTodo) =>
  todo.dueDate && todo.dueDate < today() && todo.status !== 'done' && todo.status !== 'cancelled';

const isDueToday = (todo: SmartTodo) =>
  todo.dueDate === today() && todo.status !== 'done' && todo.status !== 'cancelled';

const formatDuration = (min: number | null): string => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const daysUntil = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const diff = Math.round((new Date(dateStr).getTime() - new Date(today()).getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff}d`;
};

// ── styling maps ────────────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<TodoPriorityLevel, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-400',
  medium: 'border-l-amber-400',
  low: 'border-l-teal-400',
};

const PRIORITY_BADGE: Record<TodoPriorityLevel, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

const PRIORITY_ICON: Record<TodoPriorityLevel, React.ReactNode> = {
  urgent: <ArrowUp className="w-3 h-3" />,
  high: <ArrowUp className="w-3 h-3" />,
  medium: <ArrowRight className="w-3 h-3" />,
  low: <ArrowDown className="w-3 h-3" />,
};

const STATUS_CONFIG: Record<TodoStatus, { icon: React.ReactNode; label: string; color: string }> = {
  todo: { icon: <Circle className="w-4 h-4" />, label: 'To Do', color: 'text-gray-400 dark:text-gray-500' },
  in_progress: { icon: <Clock className="w-4 h-4" />, label: 'In Progress', color: 'text-blue-500' },
  blocked: { icon: <AlertCircle className="w-4 h-4" />, label: 'Blocked', color: 'text-red-500' },
  done: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Done', color: 'text-green-500' },
  cancelled: { icon: <XCircle className="w-4 h-4" />, label: 'Cancelled', color: 'text-gray-400' },
};

const QUADRANT_CONFIG: Record<number, { label: string; sublabel: string; color: string; bg: string }> = {
  1: { label: 'Do Now', sublabel: 'Urgent & Important', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  2: { label: 'Schedule', sublabel: 'Not Urgent & Important', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  3: { label: 'Delegate', sublabel: 'Urgent & Not Important', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  4: { label: 'Eliminate', sublabel: 'Not Urgent & Not Important', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
};

const ENERGY_CONFIG: Record<EnergyLevel, { icon: string; color: string }> = {
  high: { icon: '⚡', color: 'text-yellow-600 dark:text-yellow-400' },
  medium: { icon: '🔋', color: 'text-blue-500 dark:text-blue-400' },
  low: { icon: '🍃', color: 'text-green-600 dark:text-green-400' },
};

// ── blank form ──────────────────────────────────────────────────────────────

const blankForm = (userId: string): SmartTodo => ({
  id: '',
  userId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  source: '',
  requester: '',
  isRecurring: false,
  recurrenceRule: null,
  createdByBot: false,
  title: '',
  description: '',
  tags: [],
  attachments: [],
  links: [],
  status: 'todo',
  priorityLevel: 'medium',
  eisenhowerQuadrant: null,
  energyRequired: 'medium',
  estimatedDurationMin: null,
  actualTimeSpentMin: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
});

// ── TodoCard ────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: SmartTodo;
  onClick: () => void;
  onStatusToggle: (next: TodoStatus) => void;
  onDelete: () => void;
}

const TodoCard: React.FC<TodoCardProps> = ({ todo, onClick, onStatusToggle, onDelete }) => {
  const statusCfg = STATUS_CONFIG[todo.status];
  const overdue = isOverdue(todo);
  const dueToday = isDueToday(todo);

  const nextStatus = (): TodoStatus => {
    if (todo.status === 'todo') return 'in_progress';
    if (todo.status === 'in_progress') return 'done';
    return 'todo';
  };

  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-xl border border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer
        ${PRIORITY_BORDER[todo.priorityLevel]}
        ${todo.status === 'done' ? 'opacity-60' : ''}
        ${todo.status === 'cancelled' ? 'opacity-40' : ''}
        ${overdue ? 'border-t-2 border-t-red-400' : ''}
        border-gray-100 dark:border-gray-800`}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-2">
          {/* Status toggle */}
          <button
            onClick={e => { e.stopPropagation(); onStatusToggle(nextStatus()); }}
            className={`mt-0.5 shrink-0 ${statusCfg.color} hover:opacity-70 transition-opacity`}
            title={`Status: ${statusCfg.label}`}
          >
            {statusCfg.icon}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-gray-900 dark:text-white text-sm leading-snug ${todo.status === 'done' ? 'line-through text-gray-400' : ''} ${todo.status === 'cancelled' ? 'line-through' : ''}`}>
              {todo.title || <span className="italic text-gray-400">Untitled</span>}
            </p>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {todo.createdByBot && (
              <span title="Created by AI Bot" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Bot className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              </span>
            )}
            {todo.isRecurring && (
              <span title="Recurring" className="text-blue-400">
                <Repeat className="w-3.5 h-3.5" />
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_BADGE[todo.priorityLevel]}`}>
              {PRIORITY_ICON[todo.priorityLevel]}
              {todo.priorityLevel}
            </span>
          </div>

          {/* Delete (hover) */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Description snippet */}
        {todo.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 ml-7 mb-2">
            {todo.description}
          </p>
        )}

        {/* Bottom row: meta */}
        <div className="flex items-center gap-3 ml-7 flex-wrap">
          {/* Due date */}
          {todo.dueDate && (
            <span className={`flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5
              ${overdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                dueToday ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                'text-gray-400 dark:text-gray-500'}`}>
              <Calendar className="w-3 h-3" />
              {daysUntil(todo.dueDate)}
            </span>
          )}

          {/* Duration */}
          {todo.estimatedDurationMin && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="w-3 h-3" />
              {formatDuration(todo.estimatedDurationMin)}
            </span>
          )}

          {/* Energy */}
          {todo.energyRequired && (
            <span className={`text-[11px] ${ENERGY_CONFIG[todo.energyRequired].color}`}>
              {ENERGY_CONFIG[todo.energyRequired].icon}
            </span>
          )}

          {/* Quadrant */}
          {todo.eisenhowerQuadrant && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].bg} ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].color}`}>
              Q{todo.eisenhowerQuadrant}: {QUADRANT_CONFIG[todo.eisenhowerQuadrant].label}
            </span>
          )}

          {/* Tags */}
          {todo.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
              #{t}
            </span>
          ))}
          {todo.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">+{todo.tags.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── TodoFormModal ───────────────────────────────────────────────────────────

interface TodoFormModalProps {
  initial: SmartTodo;
  onSave: (todo: SmartTodo) => void;
  onClose: () => void;
  title: string;
}

const TodoFormModal: React.FC<TodoFormModalProps> = ({ initial, onSave, onClose, title }) => {
  const [form, setForm] = useState<SmartTodo>(initial);
  const [tagInput, setTagInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachUrl, setAttachUrl] = useState('');

  const set = (field: keyof SmartTodo, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !form.links.includes(l)) set('links', [...form.links, l]);
    setLinkInput('');
  };

  const addAttachment = () => {
    if (attachName.trim() && attachUrl.trim()) {
      set('attachments', [...form.attachments, { name: attachName.trim(), url: attachUrl.trim() }]);
      setAttachName('');
      setAttachUrl('');
    }
  };

  const handleSave = () => {
    if (!form.title.trim()) { alert('A title is required.'); return; }
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
      completedAt: form.status === 'done' && !form.completedAt ? new Date().toISOString() : form.completedAt,
    });
  };

  const inputCls = 'w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400';
  const labelCls = 'block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="What needs to be done?" />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Additional context..." />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as TodoStatus)} className={inputCls}>
                {(Object.keys(STATUS_CONFIG) as TodoStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priorityLevel} onChange={e => set('priorityLevel', e.target.value as TodoPriorityLevel)} className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Eisenhower + Energy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Eisenhower Quadrant</label>
              <select value={form.eisenhowerQuadrant ?? ''} onChange={e => set('eisenhowerQuadrant', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">— None —</option>
                <option value="1">Q1: Do Now (Urgent + Important)</option>
                <option value="2">Q2: Schedule (Not Urgent + Important)</option>
                <option value="3">Q3: Delegate (Urgent + Not Important)</option>
                <option value="4">Q4: Eliminate (Not Urgent + Not Important)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Energy Required</label>
              <select value={form.energyRequired} onChange={e => set('energyRequired', e.target.value as EnergyLevel)} className={inputCls}>
                <option value="low">Low ⚡</option>
                <option value="medium">Medium 🔋</option>
                <option value="high">High ⚡⚡</option>
              </select>
            </div>
          </div>

          {/* Start + Due + Estimated */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Est. Duration (min)</label>
              <input type="number" min="0" value={form.estimatedDurationMin ?? ''} onChange={e => set('estimatedDurationMin', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="e.g. 90" />
            </div>
          </div>

          {/* Source + Requester */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <input value={form.source} onChange={e => set('source', e.target.value)} className={inputCls} placeholder="Email, Meeting, Manual..." />
            </div>
            <div>
              <label className={labelCls}>Requester</label>
              <input value={form.requester} onChange={e => set('requester', e.target.value)} className={inputCls} placeholder="Who requested this?" />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={e => set('isRecurring', e.target.checked)} className="rounded" />
            <label htmlFor="recurring" className="text-sm text-gray-700 dark:text-gray-300 font-medium cursor-pointer">Recurring task</label>
            {form.isRecurring && (
              <input value={form.recurrenceRule ?? ''} onChange={e => set('recurrenceRule', e.target.value || null)} className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" placeholder="e.g. Every Monday" />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                  #{t}
                  <button onClick={() => set('tags', form.tags.filter(x => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag..." className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              <button onClick={addTag} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold">Add</button>
            </div>
          </div>

          {/* Links */}
          <div>
            <label className={labelCls}>Links</label>
            <div className="space-y-1 mb-2">
              {form.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{l}</span>
                  <button onClick={() => set('links', form.links.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="https://..." className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              <button onClick={addLink} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold">Add</button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className={labelCls}>Attachments</label>
            <div className="space-y-1 mb-2">
              {form.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="font-medium">{a.name}</span>
                  <span className="truncate flex-1 text-blue-500">{a.url}</span>
                  <button onClick={() => set('attachments', form.attachments.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={attachName} onChange={e => setAttachName(e.target.value)} placeholder="Name" className="w-1/3 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              <input value={attachUrl} onChange={e => setAttachUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAttachment()} placeholder="URL or path" className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              <button onClick={addAttachment} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold">Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
            Save Todo
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TodoDetailModal ─────────────────────────────────────────────────────────

interface TodoDetailModalProps {
  todo: SmartTodo;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TodoStatus) => void;
}

const TodoDetailModal: React.FC<TodoDetailModalProps> = ({ todo, onClose, onEdit, onDelete, onStatusChange }) => {
  const statusCfg = STATUS_CONFIG[todo.status];
  const overdue = isOverdue(todo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-gray-100 dark:border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-start gap-3 p-5 border-b border-gray-100 dark:border-gray-800 border-l-4 rounded-tl-2xl ${PRIORITY_BORDER[todo.priorityLevel]}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase ${PRIORITY_BADGE[todo.priorityLevel]}`}>
                {PRIORITY_ICON[todo.priorityLevel]} {todo.priorityLevel}
              </span>
              {todo.createdByBot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[11px] font-medium">
                  <Bot className="w-3 h-3" /> Created by AI Bot
                </span>
              )}
              {todo.isRecurring && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                  <Repeat className="w-3 h-3" /> {todo.recurrenceRule || 'Recurring'}
                </span>
              )}
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[11px] font-bold">
                  <AlertCircle className="w-3 h-3" /> Overdue
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{todo.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors" title="Edit">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => { onDelete(); onClose(); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase">Status:</span>
            {(Object.keys(STATUS_CONFIG) as TodoStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${todo.status === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600'}`}
              >
                {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Description */}
          {todo.description && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{todo.description}</p>
            </div>
          )}

          {/* Grid: dates + meta */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            {todo.dueDate && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Due Date</p>
                <p className={`text-sm font-semibold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
                  {todo.dueDate} <span className="font-normal text-xs">({daysUntil(todo.dueDate)})</span>
                </p>
              </div>
            )}
            {todo.startDate && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Start Date</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{todo.startDate}</p>
              </div>
            )}
            {todo.estimatedDurationMin && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Estimated Duration</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{formatDuration(todo.estimatedDurationMin)}</p>
              </div>
            )}
            {todo.actualTimeSpentMin != null && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Actual Time Spent</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{formatDuration(todo.actualTimeSpentMin)}</p>
              </div>
            )}
            {todo.energyRequired && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Energy Required</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white capitalize">
                  {ENERGY_CONFIG[todo.energyRequired].icon} {todo.energyRequired}
                </p>
              </div>
            )}
            {todo.eisenhowerQuadrant && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Eisenhower Quadrant</p>
                <p className={`text-sm font-semibold ${QUADRANT_CONFIG[todo.eisenhowerQuadrant].color}`}>
                  Q{todo.eisenhowerQuadrant}: {QUADRANT_CONFIG[todo.eisenhowerQuadrant].label}
                  <span className="ml-1 text-[10px] font-normal text-gray-400">({QUADRANT_CONFIG[todo.eisenhowerQuadrant].sublabel})</span>
                </p>
              </div>
            )}
            {todo.source && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Source</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{todo.source}</p>
              </div>
            )}
            {todo.requester && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Requester</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{todo.requester}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {todo.tags.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {todo.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-xs font-medium">
                    <Tag className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {todo.links.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Links</p>
              <div className="space-y-1">
                {todo.links.map((l, i) => (
                  <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{l}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {todo.attachments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Attachments</p>
              <div className="space-y-1">
                {todo.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors">
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-gray-400 truncate flex-1">{a.url}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[11px] text-gray-400 flex gap-4 pt-2">
            <span>Created: {new Date(todo.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(todo.updatedAt).toLocaleDateString()}</span>
            {todo.completedAt && <span>Completed: {new Date(todo.completedAt).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── EisenhowerMatrixView ────────────────────────────────────────────────────

interface EisenhowerMatrixViewProps {
  todos: SmartTodo[];
  onTodoClick: (todo: SmartTodo) => void;
}

const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({ todos, onTodoClick }) => {
  const getQuadrantTodos = (q: 1 | 2 | 3 | 4) => todos.filter(t => t.eisenhowerQuadrant === q && t.status !== 'done' && t.status !== 'cancelled');
  const unclassified = todos.filter(t => !t.eisenhowerQuadrant && t.status !== 'done' && t.status !== 'cancelled');

  const QuadrantCell = ({ q }: { q: 1 | 2 | 3 | 4 }) => {
    const cfg = QUADRANT_CONFIG[q];
    const qtodos = getQuadrantTodos(q);
    return (
      <div className={`rounded-xl border p-4 ${cfg.bg} border-gray-200 dark:border-gray-700`}>
        <div className="mb-3">
          <span className={`text-xs font-bold uppercase ${cfg.color}`}>Q{q}: {cfg.label}</span>
          <p className="text-[10px] text-gray-400">{cfg.sublabel}</p>
        </div>
        <div className="space-y-2">
          {qtodos.length === 0 && <p className="text-xs text-gray-400 italic">No tasks here</p>}
          {qtodos.map(t => (
            <div
              key={t.id}
              onClick={() => onTodoClick(t)}
              className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <p className="text-xs font-semibold text-gray-800 dark:text-white line-clamp-2">{t.title}</p>
              {t.dueDate && <p className="text-[10px] text-gray-400 mt-1">{daysUntil(t.dueDate)}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <QuadrantCell q={1} />
        <QuadrantCell q={2} />
        <QuadrantCell q={3} />
        <QuadrantCell q={4} />
      </div>
      {unclassified.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Unclassified ({unclassified.length})</p>
          <div className="flex flex-wrap gap-2">
            {unclassified.map(t => (
              <div key={t.id} onClick={() => onTodoClick(t)} className="bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-400 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors">
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── SmartTodoManager ────────────────────────────────────────────────────────

interface SmartTodoManagerProps {
  todos: SmartTodo[];
  currentUser: User;
  llmConfig: LLMConfig;
  onSaveTodo: (todo: SmartTodo) => void;
  onDeleteTodo: (id: string) => void;
}

const SmartTodoManager: React.FC<SmartTodoManagerProps> = ({
  todos, currentUser, llmConfig, onSaveTodo, onDeleteTodo
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | TodoStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TodoPriorityLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created' | 'title'>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [selectedTodo, setSelectedTodo] = useState<SmartTodo | null>(null);
  const [editingTodo, setEditingTodo] = useState<SmartTodo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAiBotOpen, setIsAiBotOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = todos.filter(t => t.status !== 'cancelled');
    return {
      total: active.length,
      todo: active.filter(t => t.status === 'todo').length,
      inProgress: active.filter(t => t.status === 'in_progress').length,
      blocked: active.filter(t => t.status === 'blocked').length,
      done: active.filter(t => t.status === 'done').length,
      overdue: active.filter(t => isOverdue(t)).length,
      dueToday: active.filter(t => isDueToday(t)).length,
    };
  }, [todos]);

  // ── Filtered + Sorted list ─────────────────────────────────────────────
  const PRIORITY_ORDER: Record<TodoPriorityLevel, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = useMemo(() => {
    let result = [...todos];

    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus);
    if (filterPriority !== 'all') result = result.filter(t => t.priorityLevel === filterPriority);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tg => tg.toLowerCase().includes(q)) ||
        t.requester.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'due_date') {
        const da = a.dueDate || '9999-99-99';
        const db = b.dueDate || '9999-99-99';
        cmp = da.localeCompare(db);
      } else if (sortBy === 'priority') {
        cmp = PRIORITY_ORDER[a.priorityLevel] - PRIORITY_ORDER[b.priorityLevel];
      } else if (sortBy === 'created') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'title') {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [todos, filterStatus, filterPriority, searchQuery, sortBy, sortDir]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleCreate = (form: SmartTodo) => {
    onSaveTodo({ ...form, id: generateId(), userId: currentUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setIsCreating(false);
  };

  const handleUpdate = (form: SmartTodo) => {
    onSaveTodo({ ...form, updatedAt: new Date().toISOString() });
    setEditingTodo(null);
    setSelectedTodo(form);
  };

  const handleStatusChange = (todo: SmartTodo, status: TodoStatus) => {
    const updated: SmartTodo = {
      ...todo,
      status,
      updatedAt: new Date().toISOString(),
      completedAt: status === 'done' ? new Date().toISOString() : todo.completedAt,
    };
    onSaveTodo(updated);
    if (selectedTodo?.id === todo.id) setSelectedTodo(updated);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this todo?')) return;
    onDeleteTodo(id);
    if (selectedTodo?.id === id) setSelectedTodo(null);
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <Minus className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* AI Bot Sidebar */}
      <AITodoBotSidebar
        isOpen={isAiBotOpen}
        onClose={() => setIsAiBotOpen(false)}
        llmConfig={llmConfig}
        currentUser={currentUser}
        onSaveTodo={todo => { onSaveTodo(todo); setIsAiBotOpen(false); }}
      />

      {/* Modals */}
      {isCreating && (
        <TodoFormModal
          initial={blankForm(currentUser.id)}
          onSave={handleCreate}
          onClose={() => setIsCreating(false)}
          title="New Smart To Do"
        />
      )}
      {editingTodo && (
        <TodoFormModal
          initial={editingTodo}
          onSave={handleUpdate}
          onClose={() => setEditingTodo(null)}
          title="Edit Todo"
        />
      )}
      {selectedTodo && !editingTodo && (
        <TodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onEdit={() => { setEditingTodo(selectedTodo); setSelectedTodo(null); }}
          onDelete={() => handleDelete(selectedTodo.id)}
          onStatusChange={s => handleStatusChange(selectedTodo, s)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Smart To Do</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your personal task list — private to you</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiBotOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <Bot className="w-4 h-4" />
            AI Extract
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Todo
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700 dark:text-gray-200', bg: 'bg-white dark:bg-gray-900', filter: 'all' as const },
          { label: 'To Do', value: stats.todo, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-white dark:bg-gray-900', filter: 'todo' as const },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', filter: 'in_progress' as const },
          { label: 'Blocked', value: stats.blocked, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', filter: 'blocked' as const },
          { label: 'Done', value: stats.done, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', filter: 'done' as const },
          { label: 'Due Today', value: stats.dueToday, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', filter: null },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-700 dark:text-red-400 font-bold', bg: 'bg-red-50 dark:bg-red-900/20', filter: null },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => stat.filter && setFilterStatus(filterStatus === stat.filter ? 'all' : stat.filter)}
            className={`rounded-xl p-3 border text-center transition-all ${stat.bg} border-gray-100 dark:border-gray-800 hover:shadow-sm ${stat.filter && filterStatus === stat.filter ? 'ring-2 ring-indigo-400' : ''}`}
          >
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search todos..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as any)}
          className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {([['due_date', 'Due Date'], ['priority', 'Priority'], ['created', 'Created'], ['title', 'Title']] as [typeof sortBy, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-colors ${sortBy === field ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {label} <SortIcon field={field} />
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('matrix')}
            className={`p-2 transition-colors ${viewMode === 'matrix' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Eisenhower matrix"
          >
            <Brain className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No todos yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first task manually or let the AI extract it from text.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /> New Todo
            </button>
            <button onClick={() => setIsAiBotOpen(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <Bot className="w-4 h-4" /> AI Extract
            </button>
          </div>
        </div>
      ) : viewMode === 'matrix' ? (
        <EisenhowerMatrixView todos={filtered} onTodoClick={setSelectedTodo} />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No todos match your filters.</p>
            </div>
          ) : (
            filtered.map(todo => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onClick={() => setSelectedTodo(todo)}
                onStatusToggle={s => handleStatusChange(todo, s)}
                onDelete={() => handleDelete(todo.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SmartTodoManager;
