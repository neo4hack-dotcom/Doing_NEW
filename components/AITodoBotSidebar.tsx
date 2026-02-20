
import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, User, SmartTodo, TodoStatus, TodoPriorityLevel, EnergyLevel, TodoAttachment } from '../types';
import { extractTodoFromText } from '../services/llmService';
import { generateId } from '../services/storage';
import { X, Paperclip, Bot, FileText, Loader2, Save, Plus, Trash2, CheckSquare } from 'lucide-react';

interface AITodoBotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  currentUser: User;
  onSaveTodo: (todo: SmartTodo) => void;
}

type BotStep = 'input' | 'loading' | 'review' | 'saved';

interface ExtractedData {
  title: string;
  description: string;
  source: string;
  requester: string;
  tags: string[];
  links: string[];
  priorityLevel: string;
  eisenhowerQuadrant: number | null;
  energyRequired: string;
  estimatedDurationMin: number | null;
  startDate: string;
  dueDate: string;
  isRecurring: boolean;
  recurrenceRule: string;
  actionItems: { id: string; description: string; owner: string; dueDate: string }[];
  attachments: TodoAttachment[];
}

const blankExtracted = (): ExtractedData => ({
  title: '',
  description: '',
  source: '',
  requester: '',
  tags: [],
  links: [],
  priorityLevel: '',
  eisenhowerQuadrant: null,
  energyRequired: '',
  estimatedDurationMin: null,
  startDate: '',
  dueDate: '',
  isRecurring: false,
  recurrenceRule: '',
  actionItems: [],
  attachments: [],
});

const AITodoBotSidebar: React.FC<AITodoBotSidebarProps> = ({
  isOpen, onClose, llmConfig, currentUser, onSaveTodo
}) => {
  const [step, setStep] = useState<BotStep>('input');
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedData>(blankExtracted());
  const [savedTitle, setSavedTitle] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = evt => {
        setAttachedFile({ name: file.name, content: evt.target?.result as string });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleExtract = async () => {
    const textToAnalyze = inputText + (attachedFile
      ? `\n\n--- ATTACHED FILE: ${attachedFile.name} ---\n${attachedFile.content}`
      : '');
    if (!textToAnalyze.trim()) return;

    setStep('loading');
    setError('');

    try {
      const result = await extractTodoFromText(textToAnalyze, llmConfig);
      setExtracted({
        title: result.title,
        description: result.description,
        source: result.source,
        requester: result.requester,
        tags: result.tags,
        links: result.links,
        priorityLevel: result.priorityLevel,
        eisenhowerQuadrant: result.eisenhowerQuadrant,
        energyRequired: result.energyRequired,
        estimatedDurationMin: result.estimatedDurationMin,
        startDate: result.startDate,
        dueDate: result.dueDate,
        isRecurring: result.isRecurring,
        recurrenceRule: result.recurrenceRule,
        actionItems: result.actionItems.map(ai => ({
          id: generateId(),
          description: ai.description,
          owner: ai.owner,
          dueDate: ai.dueDate,
        })),
        attachments: [],
      });
      setStep('review');
    } catch (e: any) {
      setError(e.message || 'Extraction failed. Please check your LLM connection.');
      setStep('input');
    }
  };

  const handleSave = () => {
    if (!extracted.title.trim()) {
      alert('A title is required before saving.');
      return;
    }
    const now = new Date().toISOString();
    const todo: SmartTodo = {
      id: generateId(),
      userId: currentUser.id,
      createdAt: now,
      updatedAt: now,
      source: extracted.source,
      requester: extracted.requester,
      isRecurring: extracted.isRecurring,
      recurrenceRule: extracted.recurrenceRule || null,
      createdByBot: true,
      title: extracted.title,
      description: extracted.description,
      tags: extracted.tags,
      attachments: extracted.attachments,
      links: extracted.links,
      status: 'todo' as TodoStatus,
      priorityLevel: (extracted.priorityLevel || 'medium') as TodoPriorityLevel,
      eisenhowerQuadrant: extracted.eisenhowerQuadrant as 1 | 2 | 3 | 4 | null,
      energyRequired: (extracted.energyRequired || 'medium') as EnergyLevel,
      estimatedDurationMin: extracted.estimatedDurationMin,
      actualTimeSpentMin: null,
      startDate: extracted.startDate || null,
      dueDate: extracted.dueDate || null,
      completedAt: null,
    };
    setSavedTitle(extracted.title);
    onSaveTodo(todo);
    setStep('saved');
  };

  const handleReset = () => {
    setStep('input');
    setInputText('');
    setAttachedFile(null);
    setError('');
    setExtracted(blankExtracted());
    setTagInput('');
    setLinkInput('');
    setSavedTitle('');
  };

  const setField = (field: keyof ExtractedData, value: any) =>
    setExtracted(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !extracted.tags.includes(t)) setField('tags', [...extracted.tags, t]);
    setTagInput('');
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !extracted.links.includes(l)) setField('links', [...extracted.links, l]);
    setLinkInput('');
  };

  const updateActionItem = (id: string, field: string, value: string) => {
    setExtracted(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(ai => ai.id === id ? { ...ai, [field]: value } : ai),
    }));
  };

  const removeActionItem = (id: string) => {
    setExtracted(prev => ({ ...prev, actionItems: prev.actionItems.filter(ai => ai.id !== id) }));
  };

  const addActionItem = () => {
    setExtracted(prev => ({
      ...prev,
      actionItems: [...prev.actionItems, { id: generateId(), description: '', owner: '', dueDate: '' }],
    }));
  };

  const inputCls = 'w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-400';
  const labelCls = 'block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}

      <div className={`fixed right-0 top-0 h-full bg-white dark:bg-slate-900 shadow-2xl z-50 transition-all duration-300 transform flex flex-col border-l border-slate-200 dark:border-slate-800 w-[90%] md:w-[55%] lg:w-[46%]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">AI Todo Extractor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Extract todos from any text or document</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* STEP: INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
                <p className="text-sm text-violet-800 dark:text-violet-300 font-medium">
                  Paste an email, message, meeting note, or any text. The AI will extract a structured to-do with priority, due date, tags, and more.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={"Paste your text here...\n\nExamples: email body, Slack message, meeting notes, a description of something you need to do..."}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none resize-none text-sm text-slate-900 dark:text-white min-h-[250px]"
              />

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,.md,.json,.csv,.html,.xml"
              />

              {attachedFile ? (
                <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} className="text-red-500 hover:text-red-600 p-1 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors text-sm"
                >
                  <Paperclip className="w-4 h-4" />
                  Attach a document (txt, md, csv, json...)
                </button>
              )}

              <button
                onClick={handleExtract}
                disabled={!inputText.trim() && !attachedFile}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bot className="w-5 h-5" />
                Extract Todo
              </button>
            </div>
          )}

          {/* STEP: LOADING */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg animate-pulse">
                <Bot className="w-8 h-8" />
              </div>
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Analyzing your text...</p>
              <p className="text-xs text-slate-400">The LLM is extracting todo information</p>
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  Review and amend the extracted data before saving.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className={labelCls}>Title *</label>
                <input value={extracted.title} onChange={e => setField('title', e.target.value)} className={inputCls} placeholder="What needs to be done?" />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={extracted.description} onChange={e => setField('description', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Additional context..." />
              </div>

              {/* Priority + Eisenhower */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={extracted.priorityLevel} onChange={e => setField('priorityLevel', e.target.value)} className={inputCls}>
                    <option value="">— Not set —</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Eisenhower Quadrant</label>
                  <select value={extracted.eisenhowerQuadrant ?? ''} onChange={e => setField('eisenhowerQuadrant', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                    <option value="">— None —</option>
                    <option value="1">Q1: Do Now</option>
                    <option value="2">Q2: Schedule</option>
                    <option value="3">Q3: Delegate</option>
                    <option value="4">Q4: Eliminate</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={extracted.startDate} onChange={e => setField('startDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Due Date</label>
                  <input type="date" value={extracted.dueDate} onChange={e => setField('dueDate', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Energy + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Energy Required</label>
                  <select value={extracted.energyRequired} onChange={e => setField('energyRequired', e.target.value)} className={inputCls}>
                    <option value="">— Not set —</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Est. Duration (min)</label>
                  <input type="number" min="0" value={extracted.estimatedDurationMin ?? ''} onChange={e => setField('estimatedDurationMin', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="e.g. 60" />
                </div>
              </div>

              {/* Source + Requester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Source</label>
                  <input value={extracted.source} onChange={e => setField('source', e.target.value)} className={inputCls} placeholder="Email, Meeting..." />
                </div>
                <div>
                  <label className={labelCls}>Requester</label>
                  <input value={extracted.requester} onChange={e => setField('requester', e.target.value)} className={inputCls} placeholder="Who requested this?" />
                </div>
              </div>

              {/* Recurring */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="bot-recurring" checked={extracted.isRecurring} onChange={e => setField('isRecurring', e.target.checked)} className="rounded" />
                <label htmlFor="bot-recurring" className="text-sm text-slate-700 dark:text-slate-300 font-medium cursor-pointer">Recurring</label>
                {extracted.isRecurring && (
                  <input value={extracted.recurrenceRule} onChange={e => setField('recurrenceRule', e.target.value)} className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white" placeholder="e.g. Every Monday" />
                )}
              </div>

              {/* Tags */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {extracted.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                      #{t}
                      <button onClick={() => setField('tags', extracted.tags.filter(x => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {extracted.tags.length === 0 && <span className="text-xs text-slate-400 italic">No tags extracted.</span>}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag..." className="flex-1 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white" />
                  <button onClick={addTag} className="px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-sm font-bold">Add</button>
                </div>
              </div>

              {/* Links */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Links</h4>
                <div className="space-y-1">
                  {extracted.links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <span className="truncate flex-1">{l}</span>
                      <button onClick={() => setField('links', extracted.links.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {extracted.links.length === 0 && <span className="text-xs text-slate-400 italic">No links extracted.</span>}
                </div>
                <div className="flex gap-2">
                  <input value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="https://..." className="flex-1 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white" />
                  <button onClick={addLink} className="px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-sm font-bold">Add</button>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sub-tasks / Action Items</h4>
                  <button onClick={addActionItem} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:text-violet-800">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {extracted.actionItems.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No action items extracted.</p>
                )}
                {extracted.actionItems.map(item => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 border border-slate-100 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Sub-task</span>
                      <button onClick={() => removeActionItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={item.description}
                      onChange={e => updateActionItem(item.id, 'description', e.target.value)}
                      placeholder="What needs to be done?"
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={item.owner}
                        onChange={e => updateActionItem(item.id, 'owner', e.target.value)}
                        placeholder="Owner"
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                      />
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={e => updateActionItem(item.id, 'dueDate', e.target.value)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Save/Reset */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSave}
                  disabled={!extracted.title.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Todo
                </button>
              </div>
            </div>
          )}

          {/* STEP: SAVED */}
          {step === 'saved' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Todo Created!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>{savedTitle}</strong> has been added to your Smart To Do list.
              </p>
              <div className="flex gap-3">
                <button onClick={handleReset} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" />
                  Extract Another
                </button>
                <button onClick={onClose} className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AITodoBotSidebar;
