
import React, { useState, useEffect } from 'react';
import { Meeting, ActionItem, ActionItemStatus, Team, User, LLMConfig } from '../types';
import { generateMeetingSummary } from '../services/llmService';
import FormattedText from './FormattedText';
import { Plus, Calendar, User as UserIcon, CheckSquare, Trash2, Save, FileText, BookOpen, Mail, X, Copy, Loader2, Folder, Briefcase, Download, UserPlus, Gavel } from 'lucide-react';

interface MeetingManagerProps {
  meetings: Meeting[];
  teams: Team[];
  users: User[];
  llmConfig: LLMConfig;
  onUpdateMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => void;
}

const MeetingManager: React.FC<MeetingManagerProps> = ({ meetings, teams, users, llmConfig, onUpdateMeeting, onDeleteMeeting }) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  
  // State for AI Summary
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // State for free text attendee
  const [newAttendeeName, setNewAttendeeName] = useState('');

  // State for new Decision
  const [newDecisionText, setNewDecisionText] = useState('');

  const initialMeetingState: Meeting = {
    id: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    teamId: teams[0]?.id || '',
    projectId: '', // Optional Project ID
    attendees: [],
    minutes: '',
    decisions: [],
    actionItems: []
  };

  const [editMeeting, setEditMeeting] = useState<Meeting>(initialMeetingState);

  // Handle Escape Key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowSummaryModal(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectMeeting = (id: string) => {
    if (id === 'new') {
        setSelectedMeetingId('new');
        setEditMeeting({ ...initialMeetingState, id: Date.now().toString(), teamId: teams[0]?.id || '' });
    } else {
        const m = meetings.find(m => m.id === id);
        if (m) {
            setSelectedMeetingId(m.id);
            setEditMeeting({ ...m, decisions: m.decisions || [] });
        }
    }
  };

  const handleSave = () => {
    if (!editMeeting.title) return alert("Title is required");
    onUpdateMeeting(editMeeting);
    if (selectedMeetingId === 'new') setSelectedMeetingId(editMeeting.id);
  };

  const handleGenerateSummary = async () => {
      if (!editMeeting.minutes && editMeeting.actionItems.length === 0) {
          alert("Please fill minutes or add actions before generating a summary.");
          return;
      }
      setIsGenerating(true);
      setShowSummaryModal(true);
      setGeneratedSummary('');
      
      const team = teams.find(t => t.id === editMeeting.teamId);
      const summary = await generateMeetingSummary(editMeeting, team, users, llmConfig);
      
      setGeneratedSummary(summary);
      setIsGenerating(false);
  };

  const cleanTextForClipboard = (text: string) => {
      return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/###\s?/g, '') // Remove headers
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
          .trim();
  };

  const copyToClipboard = () => {
      const plainText = cleanTextForClipboard(generatedSummary);
      navigator.clipboard.writeText(plainText);
      alert("Copied to clipboard (Plain Text)!");
  };

  const exportToDoc = () => {
      const element = document.createElement("a");
      const file = new Blob([generatedSummary], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "Meeting_Summary.doc"; 
      document.body.appendChild(element);
      element.click();
  };

  const addActionItem = () => {
    const newItem: ActionItem = {
        id: Date.now().toString(),
        description: 'New Item',
        ownerId: users[0]?.id || '',
        dueDate: new Date().toISOString().split('T')[0],
        status: ActionItemStatus.TO_START
    };
    setEditMeeting({
        ...editMeeting,
        actionItems: [...editMeeting.actionItems, newItem]
    });
  };

  const updateActionItem = (index: number, field: keyof ActionItem, value: any) => {
    const newItems = [...editMeeting.actionItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditMeeting({ ...editMeeting, actionItems: newItems });
  };

  const removeActionItem = (index: number) => {
    const newItems = editMeeting.actionItems.filter((_, i) => i !== index);
    setEditMeeting({ ...editMeeting, actionItems: newItems });
  };

  // Decisions Logic
  const addDecision = () => {
      if (!newDecisionText.trim()) return;
      const newDec = { id: Date.now().toString(), text: newDecisionText };
      setEditMeeting({
          ...editMeeting,
          decisions: [...(editMeeting.decisions || []), newDec]
      });
      setNewDecisionText('');
  }

  const removeDecision = (id: string) => {
      setEditMeeting({
          ...editMeeting,
          decisions: (editMeeting.decisions || []).filter(d => d.id !== id)
      });
  }

  const toggleAttendee = (userId: string) => {
      const current = editMeeting.attendees;
      if (current.includes(userId)) {
          setEditMeeting({ ...editMeeting, attendees: current.filter(id => id !== userId) });
      } else {
          setEditMeeting({ ...editMeeting, attendees: [...current, userId] });
      }
  };

  const addExternalAttendee = () => {
      if(newAttendeeName.trim()) {
          setEditMeeting({ 
              ...editMeeting, 
              attendees: [...editMeeting.attendees, newAttendeeName.trim()] 
          });
          setNewAttendeeName('');
      }
  };

  const removeAttendee = (nameOrId: string) => {
       setEditMeeting({ 
           ...editMeeting, 
           attendees: editMeeting.attendees.filter(a => a !== nameOrId) 
       });
  };

  // Helper to resolve display name (User ID or Raw String)
  const getDisplayName = (idOrName: string) => {
      const u = users.find(user => user.id === idOrName);
      return u ? `${u.firstName} ${u.lastName}` : idOrName;
  };

  const selectedTeamProjects = teams.find(t => t.id === editMeeting.teamId)?.projects || [];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-6 max-w-7xl mx-auto relative">
      
      {/* Summary Modal */}
      {showSummaryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                          <Mail className="w-5 h-5 text-indigo-500" />
                          Email Draft
                      </h3>
                      <button onClick={() => setShowSummaryModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                      {isGenerating ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                              <p>Generating summary via {llmConfig.provider}...</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <FormattedText text={generatedSummary} />
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                      <button 
                        onClick={() => setShowSummaryModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                          Close
                      </button>
                      <div className="flex gap-2">
                          <button 
                            onClick={exportToDoc}
                            disabled={isGenerating}
                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Download className="w-4 h-4" />
                              Export (.doc)
                          </button>
                          <button 
                            onClick={copyToClipboard}
                            disabled={isGenerating}
                            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Copy className="w-4 h-4" />
                              Copy to Clipboard
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* List - "Stack of Folders" Style */}
      <div className="w-full lg:w-1/3 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Folder className="w-5 h-5"/> Archives</h3>
            <button 
                onClick={() => handleSelectMeeting('new')}
                className="flex items-center text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
                <Plus className="w-4 h-4 mr-1" />
                New
            </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-[-8px]">
            {meetings.map((m, idx) => {
                const teamName = teams.find(t => t.id === m.teamId)?.name;
                const isSelected = selectedMeetingId === m.id;
                return (
                    <div 
                        key={m.id}
                        onClick={() => handleSelectMeeting(m.id)}
                        className={`relative p-4 rounded-t-xl border border-b-0 cursor-pointer transition-all transform hover:-translate-y-1 shadow-sm
                            ${isSelected 
                                ? 'bg-white dark:bg-slate-800 border-indigo-500 z-10 shadow-md' 
                                : 'bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}
                        `}
                        style={{ zIndex: isSelected ? 50 : meetings.length - idx }}
                    >
                        <div className="flex justify-between mb-1 items-center">
                            <span className={`font-bold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{m.title}</span>
                            <span className="text-xs font-mono opacity-70">{m.date}</span>
                        </div>
                        <div className="flex items-center text-xs opacity-80 gap-2">
                            <span className="flex items-center"><FileText className="w-3 h-3 mr-1" /> {teamName || 'No Team'}</span>
                            {m.projectId && (
                                <span className="flex items-center bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                    <Briefcase className="w-3 h-3 mr-1" /> Project Linked
                                </span>
                            )}
                             {!m.projectId && (
                                <span className="flex items-center bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded italic">
                                     Adhoc
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
            {meetings.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No meetings recorded.</div>}
        </div>
      </div>

      {/* Editor */}
      <div className="w-full lg:w-2/3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {selectedMeetingId ? (
             <div className="flex flex-col h-full">
                {/* Header Info */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex justify-between items-start mb-6">
                         <div className="flex-1 mr-4">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Meeting Title</label>
                            <input 
                                type="text" 
                                value={editMeeting.title}
                                onChange={e => setEditMeeting({...editMeeting, title: e.target.value})}
                                className="w-full text-xl font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-indigo-500 focus:outline-none pb-1 text-slate-900 dark:text-white placeholder-slate-400"
                                placeholder="ex: Weekly Sync"
                            />
                         </div>
                         <div className="flex gap-2">
                             <button 
                                onClick={handleGenerateSummary}
                                className="flex items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 shadow-sm transition-colors text-sm font-medium border border-indigo-200 dark:border-indigo-800"
                             >
                                 <Mail className="w-4 h-4 mr-2" />
                                 Generate Mail
                             </button>
                             <button onClick={handleSave} className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors text-sm font-medium">
                                 <Save className="w-4 h-4 mr-2" />
                                 Save
                             </button>
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Details</label>
                             <div className="space-y-3">
                                <input 
                                    type="date" 
                                    value={editMeeting.date}
                                    onChange={e => setEditMeeting({...editMeeting, date: e.target.value})}
                                    className="p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                />
                                <div className="flex gap-2">
                                    <select 
                                        value={editMeeting.teamId}
                                        onChange={e => setEditMeeting({...editMeeting, teamId: e.target.value, projectId: ''})}
                                        className="p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    >
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        value={editMeeting.projectId || ''}
                                        onChange={e => setEditMeeting({...editMeeting, projectId: e.target.value})}
                                        className="p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    >
                                        <option value="">-- No Project (Adhoc) --</option>
                                        {selectedTeamProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                             </div>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Attendees</label>
                             <div className="flex flex-col gap-2">
                                {/* Selected Attendees Chips */}
                                <div className="flex flex-wrap gap-1 mb-1 min-h-[30px] p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">
                                    {editMeeting.attendees.length > 0 ? editMeeting.attendees.map(a => (
                                        <span key={a} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                                            {getDisplayName(a)}
                                            <button onClick={() => removeAttendee(a)} className="ml-1 text-indigo-500 hover:text-indigo-700"><X className="w-3 h-3"/></button>
                                        </span>
                                    )) : <span className="text-slate-400 text-xs italic">No attendees added.</span>}
                                </div>

                                {/* Add User / External */}
                                <div className="flex gap-2 items-center">
                                    <select 
                                        className="flex-1 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white"
                                        onChange={(e) => {
                                            if(e.target.value) {
                                                toggleAttendee(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        value=""
                                    >
                                        <option value="">+ Add Internal User</option>
                                        {users.filter(u => !editMeeting.attendees.includes(u.id)).map(u => (
                                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                     <input 
                                        type="text" 
                                        value={newAttendeeName}
                                        onChange={e => setNewAttendeeName(e.target.value)}
                                        placeholder="Or add External Name..."
                                        className="flex-1 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white"
                                        onKeyDown={(e) => e.key === 'Enter' && addExternalAttendee()}
                                     />
                                     <button 
                                        onClick={addExternalAttendee}
                                        disabled={!newAttendeeName.trim()}
                                        className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                                     >
                                         <UserPlus className="w-4 h-4" />
                                     </button>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Minutes Section */}
                    <div>
                         <h4 className="flex items-center text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">
                             <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                             Minutes
                         </h4>
                         <textarea 
                            value={editMeeting.minutes}
                            onChange={e => setEditMeeting({...editMeeting, minutes: e.target.value})}
                            className="w-full h-40 p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                            placeholder="Record meeting notes here..."
                         />
                    </div>

                    {/* Key Decisions Section */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                        <h4 className="flex items-center text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wide">
                             <Gavel className="w-4 h-4 mr-2" />
                             Key Decisions
                         </h4>
                         <div className="space-y-2 mb-3">
                             {(editMeeting.decisions || []).map((decision, idx) => (
                                 <div key={decision.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-amber-100 dark:border-amber-900/50">
                                     <Gavel className="w-4 h-4 text-amber-500" />
                                     <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">{decision.text}</span>
                                     <button onClick={() => removeDecision(decision.id)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                                 </div>
                             ))}
                             {(!editMeeting.decisions || editMeeting.decisions.length === 0) && (
                                 <p className="text-xs text-amber-700/50 dark:text-amber-500/50 italic">No formal decisions recorded yet.</p>
                             )}
                         </div>
                         <div className="flex gap-2">
                             <input 
                                type="text"
                                value={newDecisionText}
                                onChange={e => setNewDecisionText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addDecision()}
                                placeholder="Enter a key decision..."
                                className="flex-1 p-2 text-sm border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-slate-800 focus:ring-1 focus:ring-amber-500 outline-none"
                             />
                             <button onClick={addDecision} className="px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 text-sm font-bold">Add</button>
                         </div>
                    </div>

                    {/* Action Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="flex items-center text-lg font-bold text-slate-800 dark:text-slate-100">
                                <CheckSquare className="w-5 h-5 mr-2 text-indigo-500" />
                                Action Items
                            </h4>
                            <button onClick={addActionItem} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center transition-colors">
                                <Plus className="w-4 h-4 mr-1" />
                                Add Item
                            </button>
                        </div>
                        
                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 w-1/3">Description</th>
                                        <th className="px-4 py-3">Owner</th>
                                        <th className="px-4 py-3">Due Date</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {editMeeting.actionItems.map((item, idx) => {
                                        // Check if ownerId matches a real user, otherwise it is free text
                                        const isKnownUser = users.some(u => u.id === item.ownerId);
                                        const isFreeText = item.ownerId && !isKnownUser;

                                        return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="text" 
                                                    value={item.description}
                                                    onChange={e => updateActionItem(idx, 'description', e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                                                    placeholder="Task description..."
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                {/* Logic switch for Owner Select vs Free Text */}
                                                <div className="flex flex-col gap-1">
                                                    <select
                                                        value={isFreeText ? 'FREE_TEXT_MODE' : item.ownerId}
                                                        onChange={e => {
                                                            if (e.target.value === 'FREE_TEXT_MODE') {
                                                                updateActionItem(idx, 'ownerId', 'External Owner'); // Set placeholder
                                                            } else {
                                                                updateActionItem(idx, 'ownerId', e.target.value);
                                                            }
                                                        }}
                                                        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-600 dark:text-slate-400 cursor-pointer w-full"
                                                    >
                                                        {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                                        <option value="FREE_TEXT_MODE">-- Other / External --</option>
                                                    </select>
                                                    {/* Free text input only if mode selected */}
                                                    {(isFreeText) && (
                                                        <input 
                                                            type="text"
                                                            value={item.ownerId}
                                                            onChange={e => updateActionItem(idx, 'ownerId', e.target.value)}
                                                            className="text-xs p-1 border rounded bg-yellow-50 dark:bg-yellow-900/10 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
                                                            autoFocus
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                 <input 
                                                    type="date" 
                                                    value={item.dueDate}
                                                    onChange={e => updateActionItem(idx, 'dueDate', e.target.value)}
                                                    className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-600 dark:text-slate-400"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={item.status}
                                                    onChange={e => updateActionItem(idx, 'status', e.target.value as ActionItemStatus)}
                                                    className={`
                                                        text-xs font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset cursor-pointer
                                                        ${item.status === ActionItemStatus.DONE ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20' : 
                                                          item.status === ActionItemStatus.ONGOING ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-blue-600/20' : 
                                                          'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-500/10'}
                                                    `}
                                                >
                                                    {Object.values(ActionItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => removeActionItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                            {editMeeting.actionItems.length === 0 && (
                                <div className="text-center py-6 text-slate-400 italic text-sm">No action items yet.</div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Footer Delete */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-right">
                    {selectedMeetingId !== 'new' && (
                         <button 
                            onClick={() => { onDeleteMeeting(editMeeting.id); setSelectedMeetingId(null); }}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors"
                         >
                             Delete Meeting
                         </button>
                    )}
                </div>
             </div>
        ) : (
            <div className="flex items-center justify-center h-full text-slate-300 dark:text-slate-600">
                <div className="text-center">
                    <BookOpen className="w-24 h-24 mx-auto mb-4 opacity-20" />
                    <p>Select a meeting to view details</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default MeetingManager;