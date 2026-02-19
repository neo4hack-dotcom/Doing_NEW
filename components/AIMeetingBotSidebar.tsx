
import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, User, Team, Meeting, ActionItem, ActionItemStatus } from '../types';
import { extractMeetingFromText } from '../services/llmService';
import { generateId } from '../services/storage';
import { X, Paperclip, Bot, FileText, Loader2, Save, Plus, Trash2 } from 'lucide-react';

interface AIMeetingBotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  teams: Team[];
  users: User[];
  onSaveMeeting: (meeting: Meeting) => void;
}

type BotStep = 'input' | 'loading' | 'review' | 'saved';

interface ExtractedMeetingData {
  title: string;
  date: string;
  teamId: string;
  projectId: string;
  attendees: string[];
  minutes: string;
  decisions: { id: string; text: string }[];
  actionItems: ActionItem[];
}

const AIMeetingBotSidebar: React.FC<AIMeetingBotSidebarProps> = ({
  isOpen, onClose, llmConfig, teams, users, onSaveMeeting
}) => {
  const [step, setStep] = useState<BotStep>('input');
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const [extracted, setExtracted] = useState<ExtractedMeetingData>({
    title: '',
    date: today,
    teamId: teams[0]?.id || '',
    projectId: '',
    attendees: [],
    minutes: '',
    decisions: [],
    actionItems: [],
  });
  const [newAttendee, setNewAttendee] = useState('');
  const [newDecision, setNewDecision] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (teams.length > 0 && !extracted.teamId) {
      setExtracted(prev => ({ ...prev, teamId: teams[0].id }));
    }
  }, [teams]);

  const handleExtract = async () => {
    const textToAnalyze = inputText + (attachedFile
      ? `\n\n--- ATTACHED FILE: ${attachedFile.name} ---\n${attachedFile.content}`
      : '');
    if (!textToAnalyze.trim()) return;

    setStep('loading');
    setError('');

    try {
      const result = await extractMeetingFromText(textToAnalyze, llmConfig);

      const decisions = result.decisions.map(text => ({
        id: generateId(),
        text,
      }));

      const actionItems: ActionItem[] = result.actionItems.map(ai => ({
        id: generateId(),
        description: ai.description,
        ownerId: ai.owner,
        dueDate: ai.dueDate || today,
        status: ActionItemStatus.TO_START,
      }));

      setExtracted(prev => ({
        ...prev,
        title: result.title,
        date: result.date || today,
        attendees: result.attendees,
        minutes: result.minutes,
        decisions,
        actionItems,
      }));

      setStep('review');
    } catch (e: any) {
      setError(e.message || 'Extraction failed');
      setStep('input');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachedFile({ name: file.name, content: evt.target?.result as string });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleSave = () => {
    if (!extracted.title.trim()) {
      alert('A meeting title is required.');
      return;
    }
    if (!extracted.teamId) {
      alert('Please select a team.');
      return;
    }

    const newMeeting: Meeting = {
      id: generateId(),
      teamId: extracted.teamId,
      projectId: extracted.projectId || undefined,
      date: extracted.date,
      title: extracted.title,
      attendees: extracted.attendees,
      minutes: extracted.minutes,
      decisions: extracted.decisions,
      actionItems: extracted.actionItems,
      createdByBot: true,
    };

    onSaveMeeting(newMeeting);
    setStep('saved');
  };

  const handleReset = () => {
    setStep('input');
    setInputText('');
    setAttachedFile(null);
    setError('');
    setExtracted({
      title: '',
      date: today,
      teamId: teams[0]?.id || '',
      projectId: '',
      attendees: [],
      minutes: '',
      decisions: [],
      actionItems: [],
    });
    setNewAttendee('');
    setNewDecision('');
  };

  const selectedTeamProjects = teams.find(t => t.id === extracted.teamId)?.projects || [];

  const addAttendee = () => {
    if (!newAttendee.trim()) return;
    setExtracted(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee.trim()] }));
    setNewAttendee('');
  };

  const removeAttendee = (idx: number) => {
    setExtracted(prev => ({ ...prev, attendees: prev.attendees.filter((_, i) => i !== idx) }));
  };

  const addDecision = () => {
    if (!newDecision.trim()) return;
    setExtracted(prev => ({
      ...prev,
      decisions: [...prev.decisions, { id: generateId(), text: newDecision.trim() }],
    }));
    setNewDecision('');
  };

  const removeDecision = (id: string) => {
    setExtracted(prev => ({ ...prev, decisions: prev.decisions.filter(d => d.id !== id) }));
  };

  const addActionItem = () => {
    const newItem: ActionItem = {
      id: generateId(),
      description: '',
      ownerId: '',
      dueDate: today,
      status: ActionItemStatus.TO_START,
    };
    setExtracted(prev => ({ ...prev, actionItems: [...prev.actionItems, newItem] }));
  };

  const updateActionItem = (idx: number, field: keyof ActionItem, value: string) => {
    setExtracted(prev => {
      const items = [...prev.actionItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, actionItems: items };
    });
  };

  const removeActionItem = (idx: number) => {
    setExtracted(prev => ({ ...prev, actionItems: prev.actionItems.filter((_, i) => i !== idx) }));
  };

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
              <h3 className="font-bold text-slate-800 dark:text-white">AI Meetings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Extract meeting data from any text or document</p>
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
                  Paste a paragraph, email, or presentation describing a meeting subject. The AI will extract the meeting details and action items automatically.
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
                placeholder={"Paste your text here...\n\nExample: email body, meeting notes, presentation extract, description of a topic..."}
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
                Extract Meeting Data
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
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Analyzing your document...</p>
              <p className="text-xs text-slate-400">The LLM is extracting meeting information</p>
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === 'review' && (
            <div className="space-y-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  Review and amend the extracted data before saving.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Title *</label>
                <input
                  value={extracted.title}
                  onChange={e => setExtracted(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  placeholder="Meeting title"
                />
              </div>

              {/* Date + Team + Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={extracted.date}
                    onChange={e => setExtracted(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Team</label>
                  <select
                    value={extracted.teamId}
                    onChange={e => setExtracted(prev => ({ ...prev, teamId: e.target.value, projectId: '' }))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Project (optional)</label>
                <select
                  value={extracted.projectId}
                  onChange={e => setExtracted(prev => ({ ...prev, projectId: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- No Project (Adhoc) --</option>
                  {selectedTeamProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Attendees */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Attendees</h4>
                <div className="flex flex-wrap gap-1.5">
                  {extracted.attendees.map((a, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                      {a}
                      <button onClick={() => removeAttendee(idx)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {extracted.attendees.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No attendees extracted.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newAttendee}
                    onChange={e => setNewAttendee(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAttendee()}
                    placeholder="Add attendee name..."
                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                  />
                  <button onClick={addAttendee} className="px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded hover:bg-violet-200 text-sm font-bold">Add</button>
                </div>
              </div>

              {/* Minutes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Minutes</label>
                <textarea
                  value={extracted.minutes}
                  onChange={e => setExtracted(prev => ({ ...prev, minutes: e.target.value }))}
                  rows={5}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white resize-none"
                  placeholder="Meeting notes..."
                />
              </div>

              {/* Decisions */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase">Key Decisions</h4>
                {extracted.decisions.map(d => (
                  <div key={d.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-amber-100 dark:border-amber-900/50">
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{d.text}</span>
                    <button onClick={() => removeDecision(d.id)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {extracted.decisions.length === 0 && (
                  <p className="text-xs text-amber-700/50 dark:text-amber-500/50 italic">No decisions extracted.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newDecision}
                    onChange={e => setNewDecision(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDecision()}
                    placeholder="Add a decision..."
                    className="flex-1 p-2 text-sm border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-slate-800 outline-none"
                  />
                  <button onClick={addDecision} className="px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-sm font-bold">Add</button>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Action Items</h4>
                  <button onClick={addActionItem} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:text-violet-800">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {extracted.actionItems.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No action items extracted.</p>
                )}
                {extracted.actionItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 border border-slate-100 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Action #{idx + 1}</span>
                      <button onClick={() => removeActionItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={item.description}
                      onChange={e => updateActionItem(idx, 'description', e.target.value)}
                      placeholder="Action description"
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={item.ownerId}
                        onChange={e => updateActionItem(idx, 'ownerId', e.target.value)}
                        placeholder="Owner (name)"
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                      />
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={e => updateActionItem(idx, 'dueDate', e.target.value)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Save/Reset buttons */}
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
                  Save Meeting
                </button>
              </div>
            </div>
          )}

          {/* STEP: SAVED */}
          {step === 'saved' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Save className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Meeting Created!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>{extracted.title}</strong> has been saved with {extracted.actionItems.length} action item{extracted.actionItems.length !== 1 ? 's' : ''}.
              </p>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Extract Another Meeting
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AIMeetingBotSidebar;
