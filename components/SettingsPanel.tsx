
import React, { useState, useEffect, useRef } from 'react';
import { AppState, LLMConfig, LLMProvider, User, UserRole, SystemMessage } from '../types';
import { fetchOllamaModels, DEFAULT_PROMPTS, testConnection } from '../services/llmService';
import { clearState } from '../services/storage';
import { Save, RefreshCw, Cpu, Server, Key, Link, Download, Upload, Database, Settings, Lock, Trash2, AlertOctagon, MessageSquare, RotateCcw, FileJson, Workflow, CheckCircle2, XCircle, Merge, HardDrive, WifiOff, Search, Megaphone } from 'lucide-react';

interface SettingsPanelProps {
  config: LLMConfig;
  appState: AppState | null; // Needed for export and user management
  onSave: (config: LLMConfig, prompts?: Record<string, string>) => void;
  onImport: (newState: AppState) => void;
  onUpdateUserPassword?: (userId: string, newPass: string) => void; 
  onUpdateSystemMessage?: (msg: SystemMessage) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, appState, onSave, onImport, onUpdateUserPassword, onUpdateSystemMessage }) => {
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config);
  const [localPrompts, setLocalPrompts] = useState<Record<string, string>>(appState?.prompts || {});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'general' | 'prompts'>('general');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Prompt Filtering
  const [promptSearch, setPromptSearch] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');

  // User Password Management State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');

  // System Message State
  const [sysMsg, setSysMsg] = useState<SystemMessage>(appState?.systemMessage || { active: false, content: '', level: 'info' });

  // DB Path Config (Admin Only)
  const [serverDbPath, setServerDbPath] = useState('');
  const [dbPathLoading, setDbPathLoading] = useState(false);

  // Load models if Ollama is selected initially
  useEffect(() => {
    if (localConfig.provider === 'ollama') {
      handleRefreshOllama();
    }
    // Fetch DB path if admin
    if (appState?.currentUser?.role === UserRole.ADMIN) {
        fetch('/api/config/db-path')
            .then(res => res.json())
            .then(data => {
                if (data.path) setServerDbPath(data.path);
            })
            .catch(err => console.error("Could not fetch DB path", err));
    }
  }, [appState?.currentUser]);

  const handleRefreshOllama = async () => {
    setLoadingModels(true);
    const models = await fetchOllamaModels(localConfig.baseUrl || 'http://localhost:11434');
    setOllamaModels(models);
    setLoadingModels(false);
    
    // Auto-select first model if none selected or current not in list
    if (models.length > 0 && (!localConfig.model || !models.includes(localConfig.model))) {
      setLocalConfig(prev => ({ ...prev, model: models[0] }));
    }
  };

  const handleTestConnection = async () => {
      setTestStatus('testing');
      try {
          const result = await testConnection(localConfig);
          setTestStatus(result ? 'success' : 'error');
      } catch (e) {
          setTestStatus('error');
      }
      setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleSave = () => {
    onSave(localConfig, localPrompts);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handlePasswordReset = () => {
      if (selectedUserId && newPassword && onUpdateUserPassword) {
          onUpdateUserPassword(selectedUserId, newPassword);
          alert('Password updated successfully');
          setNewPassword('');
          setSelectedUserId('');
      }
  };

  const handleUpdateSystemMessage = () => {
      if (onUpdateSystemMessage) {
          onUpdateSystemMessage(sysMsg);
          alert('System message updated and broadcasted to all users.');
      }
  };

  const handleUpdateDbPath = () => {
      if (!serverDbPath.trim()) return;
      if (!window.confirm("Changing the DB Path requires the server to be able to write to the new location. Are you sure?")) return;
      
      setDbPathLoading(true);
      fetch('/api/config/db-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: serverDbPath })
      })
      .then(res => res.json())
      .then(data => {
          if(data.success) {
              alert("DB Path updated successfully. Server is now using: " + data.path);
          } else {
              alert("Failed to update DB path.");
          }
      })
      .catch(err => alert("Error connecting to server."))
      .finally(() => setDbPathLoading(false));
  };

  const handleExport = () => {
    if (!appState) return;

    // Create a structured backup object
    const backupData = {
        meta: {
            appName: "DOINg",
            version: "1.0",
            exportDate: new Date().toISOString(),
            description: "Full system backup"
        },
        data: appState
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    
    // Use Blob to handle larger files (especially with Base64 images in notes)
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const exportFileDefaultName = `doing_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.href = url;
    linkElement.download = exportFileDefaultName;
    document.body.appendChild(linkElement);
    linkElement.click();
    
    // Cleanup
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = (mode: 'overwrite' | 'merge') => {
      setImportMode(mode);
      fileInputRef.current?.click();
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileObj = event.target.files && event.target.files[0];
      if (!fileObj) {
          return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result;
              if (typeof content === 'string') {
                  const parsedJson = JSON.parse(content);
                  let stateToImport: AppState | null = null;

                  // Check if it's the new Meta+Data format
                  if (parsedJson.meta && parsedJson.meta.appName === 'DOINg' && parsedJson.data) {
                      stateToImport = parsedJson.data;
                  } 
                  // Check if it's the legacy raw format (Direct AppState)
                  else if (parsedJson.users && parsedJson.teams) {
                      stateToImport = parsedJson;
                  }

                  if (stateToImport) {
                      if (importMode === 'overwrite') {
                          const itemCount = (stateToImport.users?.length || 0) + (stateToImport.teams?.length || 0);
                          if (window.confirm(`⚠️ RESTORE BACKUP\n\nThis will OVERWRITE your current data with ${itemCount} items from the file.\n\nAre you sure?`)) {
                              onImport(stateToImport);
                          }
                      } else {
                          // MERGE MODE
                          if (!appState) return;
                          handleMergeState(appState, stateToImport);
                      }
                  } else {
                      alert("Invalid file format. Please upload a valid DOINg backup JSON.");
                  }
              }
          } catch (error) {
              console.error("JSON Parse Error", error);
              alert("Error reading JSON file. The file might be corrupted.");
          }
      }
      reader.readAsText(fileObj);
      // Reset input
      event.target.value = '';
  }

  const handleMergeState = (current: AppState, incoming: AppState) => {
      // Logic to merge incoming into current
      const mergedUsers = [...current.users];
      incoming.users.forEach(incUser => {
          const idx = mergedUsers.findIndex(u => u.id === incUser.id);
          if (idx === -1) {
              mergedUsers.push(incUser);
          }
      });

      const mergedTeams = [...current.teams];
      incoming.teams.forEach(incTeam => {
          const existingTeam = mergedTeams.find(t => t.id === incTeam.id);
          if (existingTeam) {
              // Merge Projects inside team
              const mergedProjects = [...existingTeam.projects];
              incTeam.projects.forEach(incProj => {
                  const pIdx = mergedProjects.findIndex(p => p.id === incProj.id);
                  if (pIdx === -1) {
                      mergedProjects.push(incProj);
                  } else {
                      mergedProjects[pIdx] = incProj;
                  }
              });
              existingTeam.projects = mergedProjects;
          } else {
              mergedTeams.push(incTeam);
          }
      });

      const mergedReports = [...current.weeklyReports];
      incoming.weeklyReports.forEach(incRep => {
          const idx = mergedReports.findIndex(r => r.id === incRep.id);
          if (idx === -1) {
              mergedReports.push(incRep);
          } else {
              mergedReports[idx] = incRep;
          }
      });

      const mergedMeetings = [...(current.meetings || [])];
      (incoming.meetings || []).forEach(incMeeting => {
          const idx = mergedMeetings.findIndex(m => m.id === incMeeting.id);
          if (idx === -1) {
              mergedMeetings.push(incMeeting);
          } else {
              mergedMeetings[idx] = incMeeting;
          }
      });

      const finalState: AppState = {
          ...current,
          users: mergedUsers,
          teams: mergedTeams,
          weeklyReports: mergedReports,
          meetings: mergedMeetings,
          lastUpdated: Date.now()
      };

      if (window.confirm(`MERGE DATA\n\nSuccessfully prepared merge:\n- Users: ${mergedUsers.length}\n- Teams: ${mergedTeams.length}\n- Reports: ${mergedReports.length}\n\nApply changes?`)) {
          onImport(finalState);
      }
  };

  const handleResetApp = () => {
      if (window.confirm("DANGER: This will permanently delete ALL data (Users, Projects, etc.) and reset the application to its initial state. This action cannot be undone.\n\nAre you absolutely sure?")) {
          clearState();
      }
  }

  const handleResetPrompt = (key: string) => {
      if(window.confirm(`Reset "${key}" prompt to default?`)) {
          const newPrompts = { ...localPrompts };
          delete newPrompts[key];
          setLocalPrompts(newPrompts);
      }
  }

  const formatPromptKey = (key: string) => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Configuration Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Settings className="w-6 h-6" /> {/* Generic Settings Icon */}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuration</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">System settings, security, backup, and AI.</p>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl w-fit mb-6">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
          >
              General & AI Config
          </button>
          <button 
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'prompts' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
          >
              <MessageSquare className="w-4 h-4"/> Prompt Engineering
          </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-8">

        {activeTab === 'prompts' ? (
            <div className="space-y-8 animate-in fade-in">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-200 flex items-center mb-2">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        System Prompts Editor
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        Customize how the AI generates content. Use placeholders like <code>{'{{DATA}}'}</code> to inject context.
                    </p>
                </div>

                {/* Filter Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Filter prompts (e.g. working group, meeting)..."
                        value={promptSearch}
                        onChange={e => setPromptSearch(e.target.value)}
                        className="w-full pl-9 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                </div>

                <div className="space-y-8">
                    {Object.entries(DEFAULT_PROMPTS)
                        .filter(([key]) => key.toLowerCase().includes(promptSearch.toLowerCase()))
                        .map(([key, defaultPrompt]) => (
                        <div key={key} className="space-y-2 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {formatPromptKey(key)}
                                    <span className="ml-2 text-xs font-normal text-slate-400 font-mono">({key})</span>
                                </label>
                                {localPrompts[key] && localPrompts[key] !== defaultPrompt && (
                                    <button 
                                        onClick={() => handleResetPrompt(key)}
                                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Reset to Default
                                    </button>
                                )}
                            </div>
                            <textarea 
                                value={localPrompts[key] || defaultPrompt}
                                onChange={(e) => setLocalPrompts({ ...localPrompts, [key]: e.target.value })}
                                className="w-full h-48 p-4 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-y leading-relaxed"
                            />
                        </div>
                    ))}
                    {Object.entries(DEFAULT_PROMPTS).filter(([key]) => key.toLowerCase().includes(promptSearch.toLowerCase())).length === 0 && (
                        <p className="text-center text-slate-400 italic text-sm">No prompts found matching filter.</p>
                    )}
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800 pb-2">
                    <button 
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all"
                    >
                        Save Prompts
                    </button>
                </div>
            </div>
        ) : (
            <>
            {/* General Settings Content */}
            
            {/* SERVER CONFIG SECTION (ADMIN ONLY) */}
            {appState?.currentUser?.role === UserRole.ADMIN && (
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-indigo-500" />
                        Server Configuration (Admin)
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Database File Location (db.json)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={serverDbPath}
                                        onChange={(e) => setServerDbPath(e.target.value)}
                                        className="flex-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white"
                                        placeholder="/path/to/your/db.json"
                                    />
                                    <button 
                                        onClick={handleUpdateDbPath}
                                        disabled={dbPathLoading}
                                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {dbPathLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                        Update Path
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Current absolute path on the server. Change this to move where your data is stored.
                                    <br/>
                                    <span className="text-amber-500">Warning: Ensure the server process has Write permissions to the new directory.</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-700 my-8" />
                </div>
            )}

            {/* Global Announcement (Admin Only) */}
            {appState?.currentUser?.role === UserRole.ADMIN && (
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-indigo-500" />
                        System Broadcast Message
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Message Content</label>
                                <textarea 
                                    value={sysMsg.content}
                                    onChange={e => setSysMsg({...sysMsg, content: e.target.value})}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Maintenance scheduled for tonight..."
                                    rows={2}
                                />
                            </div>
                            <div className="w-40 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Level</label>
                                    <select 
                                        value={sysMsg.level}
                                        onChange={e => setSysMsg({...sysMsg, level: e.target.value as any})}
                                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                    >
                                        <option value="info">Info (Blue)</option>
                                        <option value="warning">Warning (Orange)</option>
                                        <option value="alert">Critical (Red)</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox"
                                        id="sysMsgActive"
                                        checked={sysMsg.active}
                                        onChange={e => setSysMsg({...sysMsg, active: e.target.checked})}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <label htmlFor="sysMsgActive" className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</label>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={handleUpdateSystemMessage}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm"
                            >
                                Update Message
                            </button>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-700 my-8" />
                </div>
            )}

            {/* Security Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-500" />
                    Security & Users
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Reset user password.</p>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">User</label>
                            <select 
                                value={selectedUserId} 
                                onChange={e => setSelectedUserId(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="">Select user...</option>
                                {appState?.users.map(u => (
                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.uid})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">New Password</label>
                            <input 
                                type="text" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="New password"
                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                        </div>
                        <button 
                            onClick={handlePasswordReset}
                            disabled={!selectedUserId || !newPassword}
                            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Update
                        </button>
                    </div>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Data Management Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Data Management (Offline Mode)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col space-y-6">
                    
                    {/* EXPORT */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center pb-6 border-b border-slate-200 dark:border-slate-700">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1 flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                <FileJson className="w-4 h-4"/> 1. Export Data
                            </p>
                            <p>Generate a full backup JSON file. Send this file to your manager or keep it as backup.</p>
                        </div>
                        <button 
                            onClick={handleExport}
                            className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium text-sm shadow-sm"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export Data
                        </button>
                    </div>

                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        style={{display: 'none'}} 
                        onChange={handleFileChange}
                    />

                    {/* IMPORT / MERGE */}
                    <div className="flex flex-col gap-4">
                         <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1 flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                <Upload className="w-4 h-4"/> 2. Import / Merge
                            </p>
                            <p>Load data from a file. You can either merge it (recommended for Managers) or overwrite everything (Restore).</p>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => handleImportClick('merge')}
                                className="flex-1 flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-bold text-sm shadow-sm"
                            >
                                <Merge className="w-4 h-4 mr-2" />
                                Merge Team Data (Smart Import)
                            </button>
                            <button 
                                onClick={() => handleImportClick('overwrite')}
                                className="flex-1 flex items-center justify-center px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium text-sm shadow-sm"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Restore Backup (Overwrite All)
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone: Reset App */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6 flex flex-col md:flex-row gap-4 justify-between items-center mt-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1 flex items-center gap-2 text-red-600 dark:text-red-400"><AlertOctagon className="w-4 h-4"/> Danger Zone</p>
                            <p>Permanently delete all data and reset application.</p>
                        </div>
                        <button 
                            onClick={handleResetApp}
                            className="flex items-center px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors font-medium text-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Reset Application
                        </button>
                    </div>

                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* AI Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <WifiOff className="w-5 h-5 text-indigo-500" />
                    Local AI Configuration
                </h3>
                
                <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Local Provider</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { id: 'ollama', label: 'Ollama (Recommended)', icon: <Server className="w-4 h-4"/> },
                        { id: 'local_http', label: 'Custom Local HTTP', icon: <Link className="w-4 h-4"/> },
                    ].map((provider) => (
                        <button
                        key={provider.id}
                        onClick={() => setLocalConfig({ ...localConfig, provider: provider.id as LLMProvider })}
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-medium text-sm
                            ${localConfig.provider === provider.id 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'}
                        `}
                        >
                        {provider.icon}
                        {provider.label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Configuration Fields based on Provider */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl space-y-6 border border-slate-100 dark:border-slate-700/50">

                    {localConfig.provider === 'ollama' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Base URL</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Link className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={localConfig.baseUrl || 'http://localhost:11434'}
                                    onChange={e => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                                    className="w-full p-3 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={handleRefreshOllama}
                                disabled={loadingModels}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center"
                                title="Fetch available models"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        </div>

                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Model</label>
                        {ollamaModels.length > 0 ? (
                            <select 
                                value={localConfig.model}
                                onChange={e => setLocalConfig({...localConfig, model: e.target.value})}
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            >
                                {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input 
                                type="text"
                                value={localConfig.model}
                                onChange={e => setLocalConfig({...localConfig, model: e.target.value})}
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                placeholder="Model name (e.g., llama3)" 
                            />
                        )}
                        </div>
                    </div>
                    )}

                    {localConfig.provider === 'local_http' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Endpoint URL</label>
                        <input 
                            type="text" 
                            value={localConfig.baseUrl || ''}
                            onChange={e => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="http://localhost:8000/v1/chat/completions"
                        />
                        </div>
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Model Name (Optional)</label>
                        <input 
                            type="text"
                            value={localConfig.model || ''}
                            onChange={e => setLocalConfig({...localConfig, model: e.target.value})}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="e.g. gpt-4-turbo, local-model..." 
                        />
                        </div>
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">API Key (Optional)</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input 
                                type="password" 
                                value={localConfig.apiKey || ''}
                                onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})}
                                className="w-full p-3 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="sk-..."
                            />
                        </div>
                        </div>
                    </div>
                    )}

                    {localConfig.provider === 'n8n' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Webhook URL</label>
                        <input 
                            type="text" 
                            value={localConfig.baseUrl || ''}
                            onChange={e => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="https://your-n8n-instance.com/webhook/..."
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Ensure your n8n workflow accepts POST requests with a JSON body containing 'prompt'.</p>
                        </div>
                         <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Auth Token (Header Authorization)</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input 
                                type="password" 
                                value={localConfig.apiKey || ''}
                                onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})}
                                className="w-full p-3 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Basic ... or Bearer ..."
                            />
                        </div>
                        </div>
                    </div>
                    )}

                    {/* Test Connection Button */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                            {testStatus === 'success' && <span className="text-green-600 dark:text-green-400 flex items-center text-sm font-bold"><CheckCircle2 className="w-4 h-4 mr-1"/> Connected</span>}
                            {testStatus === 'error' && <span className="text-red-600 dark:text-red-400 flex items-center text-sm font-bold"><XCircle className="w-4 h-4 mr-1"/> Connection Failed</span>}
                        </div>
                        <button 
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing' || !localConfig.baseUrl}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center"
                        >
                            {testStatus === 'testing' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                            Test Connectivity
                        </button>
                    </div>

                </div>
                
                 <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSave}
                        className={`flex items-center px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95
                            ${saveStatus === 'saved' 
                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                        `}
                    >
                        {saveStatus === 'saved' ? <span className="mr-2">Saved!</span> : <Save className="w-5 h-5 mr-2" />}
                        {saveStatus === 'idle' && 'Save Configuration'}
                    </button>
                 </div>
                </div>
            </div>
            </>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
