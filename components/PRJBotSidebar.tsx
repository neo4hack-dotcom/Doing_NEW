
import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, User, Team, Project, Task, TaskStatus, TaskPriority, ProjectStatus, ProjectRole } from '../types';
import { extractProjectFromText } from '../services/llmService';
import { generateId } from '../services/storage';
import FormattedText from './FormattedText';
import { X, Send, Paperclip, Bot, FileText, Loader2, Save, Plus, Trash2, ChevronDown } from 'lucide-react';

interface PRJBotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  currentUser: User | null;
  teams: Team[];
  users: User[];
  onUpdateTeam: (team: Team) => void;
}

interface ExtractedTask {
  title: string;
  description: string;
  priority: string;
  eta: string;
  assignee: string;
}

interface ExtractedProject {
  name: string;
  description: string;
  status: string;
  deadline: string;
  owner: string;
  architect: string;
}

type BotStep = 'input' | 'loading' | 'review' | 'saved';

const PRJBotSidebar: React.FC<PRJBotSidebarProps> = ({ isOpen, onClose, llmConfig, currentUser, teams, users, onUpdateTeam }) => {
  const [step, setStep] = useState<BotStep>('input');
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted data for review
  const [extractedProject, setExtractedProject] = useState<ExtractedProject>({
    name: '', description: '', status: 'Planning', deadline: '', owner: '', architect: ''
  });
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleExtract = async () => {
    const textToAnalyze = inputText + (attachedFile ? `\n\n--- ATTACHED FILE: ${attachedFile.name} ---\n${attachedFile.content}` : '');
    if (!textToAnalyze.trim()) return;

    setStep('loading');
    setError('');

    try {
      const result = await extractProjectFromText(textToAnalyze, llmConfig);
      setExtractedProject(result.project);
      setExtractedTasks(result.tasks);
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
        setAttachedFile({
          name: file.name,
          content: evt.target?.result as string
        });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleSave = () => {
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return alert('Please select a team');
    if (!extractedProject.name.trim()) return alert('Project name is required');

    const now = new Date().toISOString();
    const newTasks: Task[] = extractedTasks
      .filter(t => t.title != null && t.title.trim())
      .map((t, i) => ({
        id: generateId(),
        title: t.title,
        description: t.description,
        status: TaskStatus.TODO,
        priority: (Object.values(TaskPriority).includes(t.priority as TaskPriority) ? t.priority : TaskPriority.MEDIUM) as TaskPriority,
        eta: t.eta || '',
        weight: 1,
        isImportant: false,
        order: i,
      }));

    const newProject: Project = {
      id: generateId(),
      name: extractedProject.name,
      description: extractedProject.description,
      status: (Object.values(ProjectStatus).includes(extractedProject.status as ProjectStatus) ? extractedProject.status : ProjectStatus.PLANNING) as ProjectStatus,
      deadline: extractedProject.deadline || new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      owner: extractedProject.owner || '',
      architect: extractedProject.architect || '',
      members: currentUser ? [{ userId: currentUser.id, role: ProjectRole.OWNER }] : [],
      tasks: newTasks,
      isImportant: false,
      createdByBot: true,
      auditLog: [{
        id: generateId(),
        date: now,
        userName: 'PRJ Bot',
        action: 'Create Project',
        details: 'Project created via PRJ Bot extraction'
      }]
    };

    const updatedTeam: Team = {
      ...team,
      projects: [...team.projects, newProject]
    };

    onUpdateTeam(updatedTeam);
    setStep('saved');
  };

  const handleReset = () => {
    setStep('input');
    setInputText('');
    setAttachedFile(null);
    setExtractedProject({ name: '', description: '', status: 'Planning', deadline: '', owner: '', architect: '' });
    setExtractedTasks([]);
    setError('');
  };

  const addEmptyTask = () => {
    setExtractedTasks(prev => [...prev, { title: '', description: '', priority: 'Medium', eta: '', assignee: '' }]);
  };

  const removeTask = (idx: number) => {
    setExtractedTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTask = (idx: number, field: keyof ExtractedTask, value: string) => {
    setExtractedTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}

      <div className={`fixed right-0 top-0 h-full bg-white dark:bg-slate-900 shadow-2xl z-50 transition-all duration-300 transform flex flex-col border-l border-slate-200 dark:border-slate-800 w-[90%] md:w-[50%] lg:w-[42%]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">PRJ Bot</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Extract projects from any description</p>
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
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                  Paste a project description from JIRA, email, presentation, or any source. The AI will extract project details and tasks automatically.
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
                placeholder="Paste your project description here...&#10;&#10;Example: JIRA ticket content, email body, meeting notes describing a project..."
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm text-slate-900 dark:text-white min-h-[250px]"
              />

              {/* File attachment */}
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept=".txt,.md,.json,.csv,.html,.xml" />

              {attachedFile ? (
                <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} className="text-red-500 hover:text-red-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors text-sm"
                >
                  <Paperclip className="w-4 h-4" />
                  Attach a document (txt, md, csv, json...)
                </button>
              )}

              <button
                onClick={handleExtract}
                disabled={!inputText.trim() && !attachedFile}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bot className="w-5 h-5" />
                Extract Project & Tasks
              </button>
            </div>
          )}

          {/* STEP: LOADING */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg animate-pulse">
                <Bot className="w-8 h-8" />
              </div>
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Analyzing your document...</p>
              <p className="text-xs text-slate-400">The LLM is extracting project information</p>
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

              {/* Team Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Target Team</label>
                <select
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Project Fields */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" /> Project Details
                </h4>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                  <input
                    value={extractedProject.name}
                    onChange={e => setExtractedProject(p => ({ ...p, name: e.target.value }))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <textarea
                    value={extractedProject.description}
                    onChange={e => setExtractedProject(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                    <select
                      value={extractedProject.status}
                      onChange={e => setExtractedProject(p => ({ ...p, status: e.target.value }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                    >
                      {Object.values(ProjectStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={extractedProject.deadline}
                      onChange={e => setExtractedProject(p => ({ ...p, deadline: e.target.value }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Owner</label>
                    <input
                      value={extractedProject.owner}
                      onChange={e => setExtractedProject(p => ({ ...p, owner: e.target.value }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                      placeholder="Owner name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Architect</label>
                    <input
                      value={extractedProject.architect}
                      onChange={e => setExtractedProject(p => ({ ...p, architect: e.target.value }))}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                      placeholder="Architect name"
                    />
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                    Extracted Tasks ({extractedTasks.length})
                  </h4>
                  <button onClick={addEmptyTask} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    <Plus className="w-3 h-3" /> Add Task
                  </button>
                </div>

                {extractedTasks.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No tasks extracted. You can add them manually.</p>
                )}

                {extractedTasks.map((task, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 border border-slate-100 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Task #{idx + 1}</span>
                      <button onClick={() => removeTask(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={task.title}
                      onChange={e => updateTask(idx, 'title', e.target.value)}
                      placeholder="Task title"
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white"
                    />
                    <textarea
                      value={task.description}
                      onChange={e => updateTask(idx, 'description', e.target.value)}
                      placeholder="Task description"
                      rows={2}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-white resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={task.priority}
                        onChange={e => updateTask(idx, 'priority', e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Priority...</option>
                        {Object.values(TaskPriority).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={task.eta}
                        onChange={e => updateTask(idx, 'eta', e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSave}
                  disabled={!extractedProject.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Project & Tasks
                </button>
              </div>
            </div>
          )}

          {/* STEP: SAVED */}
          {step === 'saved' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Save className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Project Created!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>{extractedProject.name}</strong> has been added with {extractedTasks.filter(t => t.title != null && t.title.trim()).length} tasks.
              </p>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Extract Another Project
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PRJBotSidebar;
