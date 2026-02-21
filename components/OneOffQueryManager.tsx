
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, X, Trash2, Edit3, Tag, Calendar, User as UserIcon,
  ChevronDown, ChevronUp, Minus, Bot, Download, CheckSquare, Square,
  Sparkles, FileText, Mail, AlertCircle, Clock, CheckCircle2,
  XCircle, Database, Users, Inbox, Archive, Code2, Lightbulb,
  Phone, MessageSquare, ArchiveRestore
} from 'lucide-react';
import { OneOffQuery, OneOffQueryStatus, OneOffQueryRequestSource, User, Team, LLMConfig, UserRole } from '../types';
import { generateId } from '../services/storage';
import { generateOneOffRecapEmail, generateOneOffAssignmentEmail } from '../services/llmService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const QUADRANT_CONFIG: Record<number, { label: string; sublabel: string; color: string; bg: string; border: string }> = {
  1: { label: 'Do Now',    sublabel: 'Urgent & Important',         color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-300 dark:border-red-700' },
  2: { label: 'Schedule',  sublabel: 'Not Urgent & Important',     color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-900/20',  border: 'border-blue-300 dark:border-blue-700' },
  3: { label: 'Delegate',  sublabel: 'Urgent & Not Important',     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700' },
  4: { label: 'Eliminate', sublabel: 'Not Urgent & Not Important', color: 'text-gray-500 dark:text-gray-400',  bg: 'bg-gray-50 dark:bg-gray-800',     border: 'border-gray-300 dark:border-gray-600' },
};

const STATUS_CONFIG: Record<OneOffQueryStatus, { icon: React.ReactNode; label: string; color: string; bg: string; activeBg: string }> = {
  pending:     { icon: <Clock className="w-3.5 h-3.5" />,        label: 'Pending',     color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  activeBg: 'bg-amber-500' },
  in_progress: { icon: <AlertCircle className="w-3.5 h-3.5" />,  label: 'In Progress', color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',    activeBg: 'bg-blue-500' },
  done:        { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Done',        color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  activeBg: 'bg-green-500' },
  cancelled:   { icon: <XCircle className="w-3.5 h-3.5" />,      label: 'Cancelled',   color: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-800',       activeBg: 'bg-gray-400' },
};

const SOURCE_CONFIG: Record<OneOffQueryRequestSource, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  email:  { label: 'Email',    icon: <Mail className="w-3 h-3" />,           color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  teams:  { label: 'MS Teams', icon: <MessageSquare className="w-3 h-3" />,  color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  call:   { label: 'Call',     icon: <Phone className="w-3 h-3" />,          color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
  other:  { label: 'Other',    icon: <FileText className="w-3 h-3" />,       color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800' },
};

// ── SQL highlighter ───────────────────────────────────────────────────────────

const SQL_KEYWORDS = [
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
  'INSERT INTO', 'UNION ALL', 'PARTITION BY', 'GROUP BY', 'ORDER BY',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'FULL JOIN',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AND', 'OR', 'NOT',
  'IN', 'IS', 'NULL', 'AS', 'DISTINCT', 'TOP', 'HAVING', 'LIMIT',
  'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'TRUNCATE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'ISNULL', 'NULLIF',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'UNION', 'INTERSECT',
  'EXCEPT', 'ALL', 'EXISTS', 'BETWEEN', 'LIKE', 'OVER', 'BY', 'ASC', 'DESC',
];

const SQLBlock: React.FC<{ sql: string }> = ({ sql }) => {
  const highlighted = useMemo(() => {
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let text = escape(sql);
    // Highlight single-line comments first
    text = text.replace(/--(.*?)(\n|$)/g, '<span style="color:#94a3b8;font-style:italic">--$1</span>$2');
    // Highlight string literals
    text = text.replace(/'([^']*)'/g, '<span style="color:#86efac">\'$1\'</span>');
    // Highlight keywords (sorted longest first for multi-word match priority)
    const sorted = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      const escaped_kw = kw.replace(/\s+/g, '\\s+');
      const re = new RegExp(`(?<![a-zA-Z_])${escaped_kw}(?![a-zA-Z_0-9])`, 'gi');
      text = text.replace(re, (match) => {
        // Skip if already inside a span
        return `<span style="color:#7dd3fc;font-weight:600">${match.toUpperCase()}</span>`;
      });
    }
    return text;
  }, [sql]);

  return (
    <pre
      className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-gray-700 dark:border-gray-700"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

// ── Blank form ────────────────────────────────────────────────────────────────

const blankQuery = (teamId: string): OneOffQuery => ({
  id: '',
  teamId,
  title: '',
  requester: '',
  requesterId: null,
  sponsor: '',
  requestSource: undefined,
  emailSubject: '',
  emailReceivedAt: '',
  receivedAt: todayStr(),
  etaRequested: null,
  description: '',
  dataSource: '',
  eisenhowerQuadrant: null,
  tags: [],
  status: 'pending',
  archived: false,
  assignedToUserId: null,
  assignedToFreeText: '',
  estimatedCostMD: null,
  finalCostMD: null,
  sqlQuery: '',
  tips: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ── Export CSV ────────────────────────────────────────────────────────────────

const exportToCSV = (queries: OneOffQuery[], teams: Team[], users: User[]) => {
  const headers = [
    'ID', 'Team', 'Status', 'Archived', 'Title', 'Requester', 'Sponsor',
    'Source', 'Email Subject', 'Email Received At',
    'Received Date', 'ETA Requested', 'Description', 'Data Source',
    'Eisenhower Quadrant', 'Tags', 'Assigned To',
    'Estimated Cost (MD)', 'Final Cost (MD)',
    'SQL Query', 'Tips', 'Created At', 'Updated At',
  ];
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return '';
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const rows = queries.map(q => {
    const team = teams.find(t => t.id === q.teamId);
    const assignee = q.assignedToUserId ? users.find(u => u.id === q.assignedToUserId) : null;
    const assigneeName = assignee
      ? `${assignee.firstName} ${assignee.lastName}`
      : (q.assignedToFreeText || '');
    const quadrant = q.eisenhowerQuadrant
      ? `Q${q.eisenhowerQuadrant}: ${QUADRANT_CONFIG[q.eisenhowerQuadrant].label}`
      : '';
    return [
      q.id, team?.name || '', STATUS_CONFIG[q.status].label, q.archived ? 'Yes' : 'No',
      q.title, q.requester, q.sponsor,
      q.requestSource ? SOURCE_CONFIG[q.requestSource].label : '',
      q.emailSubject || '', q.emailReceivedAt || '',
      q.receivedAt, q.etaRequested || '',
      q.description, q.dataSource, quadrant, q.tags.join('; '),
      assigneeName,
      q.estimatedCostMD != null ? q.estimatedCostMD : '',
      q.finalCostMD != null ? q.finalCostMD : '',
      q.sqlQuery || '', q.tips || '', q.createdAt, q.updatedAt,
    ].map(esc).join(',');
  });
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `one-off-queries-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── QueryFormModal ─────────────────────────────────────────────────────────────

interface QueryFormModalProps {
  initial: OneOffQuery;
  teams: Team[];
  users: User[];
  currentUser: User;
  onSave: (q: OneOffQuery) => void;
  onClose: () => void;
  title: string;
}

const QueryFormModal: React.FC<QueryFormModalProps> = ({ initial, teams, users, currentUser, onSave, onClose, title }) => {
  const [form, setForm] = useState<OneOffQuery>(initial);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (field: keyof OneOffQuery, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const handleSave = () => {
    if (!form.title.trim()) { alert('Title is required.'); return; }
    if (!form.requester.trim()) { alert('Requester is required.'); return; }
    if (!form.description.trim()) { alert('Description is required.'); return; }
    if (!form.teamId) { alert('Team is required.'); return; }
    onSave({ ...form, updatedAt: new Date().toISOString() });
  };

  const inp = 'w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400';
  const lbl = 'block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1';
  const section = 'border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3';
  const sectionTitle = 'text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Section: Identification ── */}
          <div className={section}>
            <p className={sectionTitle}><FileText className="w-3.5 h-3.5" /> Identification</p>

            {/* Title — primary field */}
            <div>
              <label className={lbl}>Title *</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className={inp + ' font-semibold'}
                placeholder="Short, descriptive title of the request…"
              />
            </div>

            {/* Team */}
            <div>
              <label className={lbl}>Team *</label>
              <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className={inp}>
                <option value="">— Select team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Requester + Sponsor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Requester *</label>
                <input value={form.requester} onChange={e => set('requester', e.target.value)} className={inp} placeholder="Name of requester" />
              </div>
              <div>
                <label className={lbl}>Sponsor</label>
                <input value={form.sponsor} onChange={e => set('sponsor', e.target.value)} className={inp} placeholder="Sponsor / commanditaire" />
              </div>
            </div>
          </div>

          {/* ── Section: Source de la demande ── */}
          <div className={section}>
            <p className={sectionTitle}><MessageSquare className="w-3.5 h-3.5" /> Source de la demande</p>

            {/* Request Source */}
            <div>
              <label className={lbl}>Source</label>
              <div className="flex gap-2 flex-wrap">
                {(['email', 'teams', 'call', 'other'] as OneOffQueryRequestSource[]).map(src => {
                  const sc = SOURCE_CONFIG[src];
                  const active = form.requestSource === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => set('requestSource', active ? undefined : src)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                        ${active ? `${sc.bg} ${sc.color} border-current` : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                    >
                      {sc.icon} {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email subject + received time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Email Subject / Mail Title</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.emailSubject ?? ''}
                    onChange={e => set('emailSubject', e.target.value)}
                    className={inp + ' pl-9'}
                    placeholder="Subject of the source email…"
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Email / Request Received At</label>
                <input
                  type="datetime-local"
                  value={form.emailReceivedAt ?? ''}
                  onChange={e => set('emailReceivedAt', e.target.value)}
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* ── Section: Dates & Priority ── */}
          <div className={section}>
            <p className={sectionTitle}><Calendar className="w-3.5 h-3.5" /> Dates & Priority</p>

            {/* Received + ETA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Reception Date *</label>
                <input type="date" value={form.receivedAt} onChange={e => set('receivedAt', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>ETA Requested</label>
                <input type="date" value={form.etaRequested ?? ''} onChange={e => set('etaRequested', e.target.value || null)} className={inp} />
              </div>
            </div>

            {/* Eisenhower + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Eisenhower Quadrant</label>
                <select value={form.eisenhowerQuadrant ?? ''} onChange={e => set('eisenhowerQuadrant', e.target.value ? Number(e.target.value) : null)} className={inp}>
                  <option value="">— None —</option>
                  <option value="1">Q1: Do Now (Urgent + Important)</option>
                  <option value="2">Q2: Schedule (Not Urgent + Important)</option>
                  <option value="3">Q3: Delegate (Urgent + Not Important)</option>
                  <option value="4">Q4: Eliminate (Not Urgent + Not Important)</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value as OneOffQueryStatus)} className={inp}>
                  {(Object.keys(STATUS_CONFIG) as OneOffQueryStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section: Description ── */}
          <div className={section}>
            <p className={sectionTitle}><FileText className="w-3.5 h-3.5" /> Description</p>

            <div>
              <label className={lbl}>Description *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={inp + ' resize-none'} placeholder="Detailed description of the request…" />
            </div>

            {/* Data Source */}
            <div>
              <label className={lbl}>Data Source</label>
              <div className="relative">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={form.dataSource} onChange={e => set('dataSource', e.target.value)} className={inp + ' pl-9'} placeholder="Source system, database, API…" />
              </div>
            </div>
          </div>

          {/* ── Section: Cost in Man Days ── */}
          <div className={section}>
            <p className={sectionTitle}><Clock className="w-3.5 h-3.5" /> Cost (Man Days)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Estimated Cost (MD)</label>
                <input
                  type="number" min="0" step="0.25"
                  value={form.estimatedCostMD ?? ''}
                  onChange={e => set('estimatedCostMD', e.target.value ? Number(e.target.value) : null)}
                  className={inp} placeholder="0.0 MD"
                />
              </div>
              <div>
                <label className={lbl}>Final Cost (MD)</label>
                <input
                  type="number" min="0" step="0.25"
                  value={form.finalCostMD ?? ''}
                  onChange={e => set('finalCostMD', e.target.value ? Number(e.target.value) : null)}
                  className={inp} placeholder="0.0 MD"
                />
              </div>
            </div>
          </div>

          {/* ── Section: Assignment ── */}
          <div className={section}>
            <p className={sectionTitle}><UserIcon className="w-3.5 h-3.5" /> Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Known user (referenced)</label>
                <select value={form.assignedToUserId ?? ''} onChange={e => set('assignedToUserId', e.target.value || null)} className={inp}>
                  <option value="">— Select user —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.functionTitle})</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Or enter name freely</label>
                <input
                  value={form.assignedToFreeText ?? ''}
                  onChange={e => set('assignedToFreeText', e.target.value)}
                  className={inp}
                  placeholder="First Last"
                  disabled={!!form.assignedToUserId}
                />
              </div>
            </div>
          </div>

          {/* ── Section: SQL Query ── */}
          <div className={section}>
            <p className={sectionTitle}><Code2 className="w-3.5 h-3.5" /> SQL Query</p>
            <div>
              <label className={lbl}>SQL Code</label>
              <textarea
                value={form.sqlQuery ?? ''}
                onChange={e => set('sqlQuery', e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full p-3 bg-gray-900 dark:bg-gray-950 border border-gray-700 rounded-lg text-xs text-gray-100 font-mono outline-none focus:ring-2 focus:ring-indigo-400 resize-y leading-relaxed"
                placeholder="SELECT ...&#10;FROM ...&#10;WHERE ..."
              />
            </div>
          </div>

          {/* ── Section: Tips ── */}
          <div className={section}>
            <p className={sectionTitle}><Lightbulb className="w-3.5 h-3.5" /> Tips</p>
            <div>
              <label className={lbl}>Tips / Astuces</label>
              <textarea
                value={form.tips ?? ''}
                onChange={e => set('tips', e.target.value)}
                rows={3}
                className={inp + ' resize-none'}
                placeholder="Hints and tips to find the data (table names, joins, filters…)"
              />
            </div>
          </div>

          {/* ── Section: Tags ── */}
          <div className={section}>
            <p className={sectionTitle}><Tag className="w-3.5 h-3.5" /> Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                  #{t}<button onClick={() => set('tags', form.tags.filter(x => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag and press Enter…" className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              <button onClick={addTag} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold">Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">Save Query</button>
        </div>
      </div>
    </div>
  );
};

// ── AIEmailModal ───────────────────────────────────────────────────────────────

interface AIEmailModalProps { content: string; title: string; onClose: () => void; }

const AIEmailModal: React.FC<AIEmailModalProps> = ({ content, title, onClose }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">{content}</pre>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => { navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            <FileText className="w-4 h-4" />{copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

// ── QueryCard ─────────────────────────────────────────────────────────────────

interface QueryCardProps {
  query: OneOffQuery;
  users: User[];
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onStatusChange: (s: OneOffQueryStatus) => void;
  onAIAssign: () => void;
  aiAssigning: boolean;
}

const QueryCard: React.FC<QueryCardProps> = ({ query, users, selected, onToggleSelect, onEdit, onDelete, onArchive, onStatusChange, onAIAssign, aiAssigning }) => {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CONFIG[query.status];
  const qc = query.eisenhowerQuadrant ? QUADRANT_CONFIG[query.eisenhowerQuadrant] : null;
  const src = query.requestSource ? SOURCE_CONFIG[query.requestSource] : null;
  const assignee = query.assignedToUserId ? users.find(u => u.id === query.assignedToUserId) : null;
  const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : (query.assignedToFreeText || null);
  const isOverdue = query.etaRequested && query.etaRequested < todayStr() && query.status !== 'done' && query.status !== 'cancelled';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm transition-all
      ${selected ? 'border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-100 dark:border-gray-800 hover:shadow-md'}
      ${query.archived ? 'opacity-60' : ''}
      ${query.status === 'done' ? 'opacity-70' : ''}`}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button onClick={onToggleSelect} className="mt-0.5 shrink-0 text-gray-400 hover:text-indigo-500 transition-colors">
            {selected ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color}`}>
                    {sc.icon} {sc.label}
                  </span>
                  {qc && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${qc.bg} ${qc.color} ${qc.border}`}>
                      Q{query.eisenhowerQuadrant}: {qc.label}
                    </span>
                  )}
                  {src && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${src.bg} ${src.color}`}>
                      {src.icon} {src.label}
                    </span>
                  )}
                  {query.archived && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      <Archive className="w-3 h-3" /> Archived
                    </span>
                  )}
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </span>
                  )}
                </div>

                {/* Title — primary information */}
                <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-0.5 truncate">
                  {query.title || <span className="text-gray-400 font-normal italic">No title</span>}
                </h4>

                {/* Requester line */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  From: <span className="text-indigo-600 dark:text-indigo-400 font-medium">{query.requester}</span>
                  {query.sponsor && <span className="ml-2 text-gray-400">— Sponsor: {query.sponsor}</span>}
                </p>

                {/* Description preview */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{query.description}</p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={onAIAssign} disabled={aiAssigning} title="Generate assignment email" className="flex items-center gap-1 px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40">
                  <Bot className="w-3 h-3" />{aiAssigning ? '…' : 'AI Email'}
                </button>
                <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                <button
                  onClick={onArchive}
                  className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title={query.archived ? 'Restore from archive' : 'Archive'}
                >
                  {query.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </button>
                <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {query.receivedAt && <span className="flex items-center gap-1 text-[11px] text-gray-400"><Calendar className="w-3 h-3" /> Received: {query.receivedAt}</span>}
              {query.etaRequested && <span className={`flex items-center gap-1 text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}><Clock className="w-3 h-3" /> ETA: {query.etaRequested}</span>}
              {assigneeName && <span className="flex items-center gap-1 text-[11px] text-gray-400"><UserIcon className="w-3 h-3" /> {assigneeName}</span>}
              {query.estimatedCostMD != null && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="w-3 h-3" /> Est: {query.estimatedCostMD} MD
                  {query.finalCostMD != null && <span className="ml-1">/ Final: {query.finalCostMD} MD</span>}
                </span>
              )}
              {query.dataSource && <span className="flex items-center gap-1 text-[11px] text-gray-400"><Database className="w-3 h-3" /> {query.dataSource}</span>}
              {query.sqlQuery && <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400"><Code2 className="w-3 h-3" /> SQL attached</span>}
              {query.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">#{t}</span>)}
              {query.tags.length > 3 && <span className="text-[10px] text-gray-400">+{query.tags.length - 3}</span>}
            </div>
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">

            {/* Full description */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Full Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{query.description}</p>
            </div>

            {/* Email info */}
            {(query.emailSubject || query.emailReceivedAt) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Source Email</p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {query.emailSubject && <p><span className="font-semibold text-gray-500 dark:text-gray-400">Subject:</span> {query.emailSubject}</p>}
                  {query.emailReceivedAt && <p><span className="font-semibold text-gray-500 dark:text-gray-400">Received:</span> {new Date(query.emailReceivedAt).toLocaleString()}</p>}
                </div>
              </div>
            )}

            {/* Cost details */}
            {(query.estimatedCostMD != null || query.finalCostMD != null) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Cost (Man Days)</p>
                <div className="flex gap-4">
                  {query.estimatedCostMD != null && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{query.estimatedCostMD}</p>
                      <p className="text-[9px] text-amber-500 dark:text-amber-500 font-semibold uppercase">Estimated</p>
                    </div>
                  )}
                  {query.finalCostMD != null && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{query.finalCostMD}</p>
                      <p className="text-[9px] text-green-500 dark:text-green-500 font-semibold uppercase">Final</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tips */}
            {query.tips && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Tips</p>
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-3 text-xs text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap leading-relaxed">
                  {query.tips}
                </div>
              </div>
            )}

            {/* SQL block */}
            {query.sqlQuery && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Code2 className="w-3 h-3" /> SQL Query</p>
                <SQLBlock sql={query.sqlQuery} />
              </div>
            )}

            {/* Status change */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Change Status</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_CONFIG) as OneOffQueryStatus[]).map(s => (
                  <button key={s} onClick={() => onStatusChange(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                      ${query.status === s ? `${STATUS_CONFIG[s].activeBg} text-white border-transparent` : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                  >
                    {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {query.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {query.tags.map(t => <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-xs"><Tag className="w-3 h-3" /> {t}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── OneOffQueryManager ─────────────────────────────────────────────────────────

interface OneOffQueryManagerProps {
  queries: OneOffQuery[];
  teams: Team[];
  users: User[];
  currentUser: User;
  llmConfig: LLMConfig;
  onSaveQuery: (q: OneOffQuery) => void;
  onDeleteQuery: (id: string) => void;
}

const OneOffQueryManager: React.FC<OneOffQueryManagerProps> = ({
  queries, teams, users, currentUser, llmConfig, onSaveQuery, onDeleteQuery,
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Visible teams
  const visibleTeams = useMemo(() => {
    if (isAdmin) return teams;
    return teams.filter(t =>
      t.managerId === currentUser.id ||
      t.projects.some(p =>
        p.managerId === currentUser.id ||
        (p.members || []).some(m => m.userId === currentUser.id)
      )
    );
  }, [teams, currentUser, isAdmin]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<OneOffQueryStatus | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'receivedAt' | 'etaRequested' | 'status' | 'requester'>('receivedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuery, setEditingQuery] = useState<OneOffQuery | null>(null);
  const [createTeamId, setCreateTeamId] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null); // 'recap' | queryId
  const [aiEmailResult, setAiEmailResult] = useState<{ content: string; title: string } | null>(null);

  const accessibleTeamIds = useMemo(() => new Set(visibleTeams.map(t => t.id)), [visibleTeams]);

  const accessibleQueries = useMemo(() =>
    queries.filter(q => accessibleTeamIds.has(q.teamId)),
    [queries, accessibleTeamIds]
  );

  // Active (non-archived) queries used for KPIs
  const activeQueries = useMemo(() =>
    accessibleQueries.filter(q => !q.archived),
    [accessibleQueries]
  );

  const filtered = useMemo(() => {
    let result = accessibleQueries;
    // Hide archived unless toggle is on
    if (!showArchived) result = result.filter(q => !q.archived);
    if (selectedTeamId !== 'all') result = result.filter(q => q.teamId === selectedTeamId);
    if (filterStatus !== 'all') result = result.filter(q => q.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q) ||
        r.sponsor.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.dataSource.toLowerCase().includes(q) ||
        (r.emailSubject || '').toLowerCase().includes(q) ||
        (r.tips || '').toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'receivedAt') cmp = a.receivedAt.localeCompare(b.receivedAt);
      else if (sortBy === 'etaRequested') cmp = (a.etaRequested || '9999').localeCompare(b.etaRequested || '9999');
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'requester') cmp = a.requester.localeCompare(b.requester);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [accessibleQueries, selectedTeamId, filterStatus, searchQuery, sortBy, sortDir, showArchived]);

  const groupedByTeam = useMemo(() => {
    if (selectedTeamId !== 'all') return null;
    const map = new Map<string, { team: Team; items: OneOffQuery[] }>();
    visibleTeams.forEach(t => map.set(t.id, { team: t, items: [] }));
    filtered.forEach(q => { const e = map.get(q.teamId); if (e) e.items.push(q); });
    return map;
  }, [filtered, visibleTeams, selectedTeamId]);

  // KPI stats — based on active (non-archived) queries
  const stats = useMemo(() => ({
    total: activeQueries.length,
    pending: activeQueries.filter(q => q.status === 'pending').length,
    inProgress: activeQueries.filter(q => q.status === 'in_progress').length,
    done: activeQueries.filter(q => q.status === 'done').length,
    overdue: activeQueries.filter(q => q.etaRequested && q.etaRequested < todayStr() && q.status !== 'done' && q.status !== 'cancelled').length,
    archived: accessibleQueries.filter(q => q.archived).length,
  }), [activeQueries, accessibleQueries]);

  // CRUD
  const handleCreate = (q: OneOffQuery) => {
    onSaveQuery({ ...q, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setIsCreating(false);
  };
  const handleUpdate = (q: OneOffQuery) => { onSaveQuery({ ...q, updatedAt: new Date().toISOString() }); setEditingQuery(null); };
  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this query?')) return;
    onDeleteQuery(id);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };
  const handleStatusChange = (q: OneOffQuery, status: OneOffQueryStatus) =>
    onSaveQuery({ ...q, status, updatedAt: new Date().toISOString() });
  const handleArchive = (q: OneOffQuery) =>
    onSaveQuery({ ...q, archived: !q.archived, updatedAt: new Date().toISOString() });

  // Selection
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(q => q.id)));

  // Sort
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };
  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <Minus className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // AI: Recap email for selected queries
  const handleAIRecap = async () => {
    const sel = filtered.filter(q => selectedIds.has(q.id));
    if (sel.length === 0) { alert('Please select at least one query first.'); return; }
    setAiLoading('recap');
    try {
      const result = await generateOneOffRecapEmail(sel, users, `${currentUser.firstName} ${currentUser.lastName}`, llmConfig);
      setAiEmailResult({ content: result, title: `AI Recap Email — ${sel.length} selected quer${sel.length > 1 ? 'ies' : 'y'}` });
    } catch (e: any) {
      setAiEmailResult({ content: `Error: ${e.message}`, title: 'AI Error' });
    } finally { setAiLoading(null); }
  };

  // AI: Assignment email for a single query
  const handleAIAssign = async (q: OneOffQuery) => {
    setAiLoading(q.id);
    try {
      const assignee = q.assignedToUserId ? users.find(u => u.id === q.assignedToUserId) || null : null;
      const result = await generateOneOffAssignmentEmail(q, assignee, q.assignedToFreeText || '', `${currentUser.firstName} ${currentUser.lastName}`, llmConfig);
      setAiEmailResult({ content: result, title: 'AI Assignment Email' });
    } catch (e: any) {
      setAiEmailResult({ content: `Error: ${e.message}`, title: 'AI Error' });
    } finally { setAiLoading(null); }
  };

  // Export
  const handleExport = () => {
    const toExport = selectedIds.size > 0 ? filtered.filter(q => selectedIds.has(q.id)) : filtered;
    exportToCSV(toExport, teams, users);
  };

  const handleNewClick = (teamId?: string) => {
    setCreateTeamId(teamId || visibleTeams[0]?.id || '');
    setIsCreating(true);
  };

  const renderList = (list: OneOffQuery[]) => {
    if (list.length === 0) return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
        <Inbox className="w-7 h-7 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No queries here.</p>
      </div>
    );
    return (
      <div className="space-y-2">
        {list.map(q => (
          <QueryCard
            key={q.id}
            query={q}
            users={users}
            selected={selectedIds.has(q.id)}
            onToggleSelect={() => toggleSelect(q.id)}
            onEdit={() => setEditingQuery(q)}
            onDelete={() => handleDelete(q.id)}
            onArchive={() => handleArchive(q)}
            onStatusChange={s => handleStatusChange(q, s)}
            onAIAssign={() => handleAIAssign(q)}
            aiAssigning={aiLoading === q.id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      {isCreating && (
        <QueryFormModal initial={blankQuery(createTeamId)} teams={visibleTeams} users={users} currentUser={currentUser}
          onSave={handleCreate} onClose={() => setIsCreating(false)} title="New One Off Query" />
      )}
      {editingQuery && (
        <QueryFormModal initial={editingQuery} teams={visibleTeams} users={users} currentUser={currentUser}
          onSave={handleUpdate} onClose={() => setEditingQuery(null)} title="Edit Query" />
      )}
      {aiEmailResult && <AIEmailModal content={aiEmailResult.content} title={aiEmailResult.title} onClose={() => setAiEmailResult(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">One Off Queries</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track and manage ad-hoc data requests — organised by team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleAIRecap} disabled={aiLoading !== null}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all">
            <Mail className="w-4 h-4" />
            {aiLoading === 'recap' ? 'Generating…' : `AI Recap${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">
            <Download className="w-4 h-4" />
            Export CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button onClick={() => handleNewClick()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> New Query
          </button>
        </div>
      </div>

      {/* Stats — KPIs based on active (non-archived) queries */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total (active)', value: stats.total,      color: 'text-gray-700 dark:text-gray-200',       bg: 'bg-white dark:bg-gray-900' },
          { label: 'Pending',        value: stats.pending,    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'In Progress',    value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Done',           value: stats.done,       color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Overdue',        value: stats.overdue,    color: 'text-red-600 dark:text-red-400 font-bold', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Archived',       value: stats.archived,   color: 'text-gray-400 dark:text-gray-500',       bg: 'bg-gray-50 dark:bg-gray-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 border border-gray-100 dark:border-gray-800 text-center ${s.bg}`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Team tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[{ id: 'all', name: 'All Teams', count: filtered.length }, ...visibleTeams.map(t => ({ id: t.id, name: t.name, count: filtered.filter(q => q.teamId === t.id).length }))].map(tab => (
          <button key={tab.id} onClick={() => setSelectedTeamId(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border
              ${selectedTeamId === tab.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400'}`}
          >
            {tab.id === 'all' && <Users className="w-3.5 h-3.5" />}
            {tab.name}
            <span className="text-[10px] opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex flex-wrap items-center gap-3">
        <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors font-medium">
          {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
          Select all ({filtered.length})
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search queries…"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as OneOffQueryStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors
            ${showArchived ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
        >
          {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          {showArchived ? 'Hide archived' : `Show archived (${stats.archived})`}
        </button>
        <div className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {([['receivedAt', 'Received'], ['etaRequested', 'ETA'], ['status', 'Status'], ['requester', 'Requester']] as [typeof sortBy, string][]).map(([field, label]) => (
            <button key={field} onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-colors ${sortBy === field ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              {label} <SortIcon field={field} />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {accessibleQueries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No one-off queries yet</h3>
          <p className="text-sm text-gray-400 mb-6">Start tracking ad-hoc data requests from your teams.</p>
          <button onClick={() => handleNewClick()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
            <Plus className="w-4 h-4" /> New Query
          </button>
        </div>
      ) : selectedTeamId !== 'all' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'}</p>
            <button onClick={() => handleNewClick(selectedTeamId)} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              <Plus className="w-4 h-4" /> Add to this team
            </button>
          </div>
          {renderList(filtered)}
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groupedByTeam!.entries()).map(([teamId, { team, items }]) => (
            <div key={teamId}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <h3 className="text-base font-bold text-gray-800 dark:text-white">{team.name}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {items.length} quer{items.length !== 1 ? 'ies' : 'y'}
                  </span>
                </div>
                <button onClick={() => handleNewClick(teamId)} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add query
                </button>
              </div>
              {renderList(items)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OneOffQueryManager;
