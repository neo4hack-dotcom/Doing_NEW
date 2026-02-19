
import React, { useState } from 'react';
import { WorkingGroup, WorkingGroupSession, User, Team, ActionItem, ActionItemStatus, WorkingGroupChecklistItem, UserRole, LLMConfig, TaskPriority } from '../types';
import { Plus, Folder, Calendar, CheckSquare, Trash2, X, Save, Edit, UserPlus, Clock, Layout, AlertTriangle, MessageSquare, Siren, FileText, Sparkles, Bot, Loader2, Download, Copy, Flag, Layers, List, Edit2, Gavel } from 'lucide-react';
import { generateId } from '../services/storage';
import { generateWorkingGroupFullReport, generateWorkingGroupSessionReport } from '../services/llmService';
import LanguagePickerModal from './LanguagePickerModal';
import FormattedText from './FormattedText';

interface WorkingGroupProps {
    groups: WorkingGroup[];
    users: User[];
    teams: Team[];
    currentUser: User | null;
    llmConfig?: LLMConfig;
    onUpdateGroup: (group: WorkingGroup) => void;
    onDeleteGroup: (id: string) => void;
}

const WorkingGroupModule: React.FC<WorkingGroupProps> = ({ groups, users, teams, currentUser, llmConfig, onUpdateGroup, onDeleteGroup }) => {
    // --- STATE ---
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [editingGroup, setEditingGroup] = useState<WorkingGroup | null>(null);
    
    // Session Edit State
    const [editingSession, setEditingSession] = useState<{groupId: string, session: WorkingGroupSession} | null>(null);
    const [activeTab, setActiveTab] = useState<'notes' | 'decisions' | 'actions' | 'checklist'>('notes');

    // Action Edit Modal State (New)
    const [actionInEdit, setActionInEdit] = useState<{index: number, action: ActionItem} | null>(null);

    // New Decision Input
    const [newDecisionText, setNewDecisionText] = useState('');

    // View State
    const [groupByFamily, setGroupByFamily] = useState(false);

    // AI Modal State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiContent, setAiContent] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiModalTitle, setAiModalTitle] = useState('');

    // Language Picker State
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);
    const [pendingLlmAction, setPendingLlmAction] = useState<((lang: 'fr' | 'en') => void) | null>(null);

    const askLanguageThen = (action: (lang: 'fr' | 'en') => void) => {
        setPendingLlmAction(() => action);
        setShowLanguagePicker(true);
    };
    const handleLanguageSelected = (lang: 'fr' | 'en') => {
        setShowLanguagePicker(false);
        if (pendingLlmAction) { pendingLlmAction(lang); setPendingLlmAction(null); }
    };

    // --- HELPER FUNCTIONS ---

    const getProjectName = (id?: string) => {
        if (!id) return null;
        for (const t of teams) {
            const p = t.projects.find(proj => proj.id === id);
            if (p) return p.name;
        }
        return null;
    };

    const hasBlockedItems = (group: WorkingGroup) => {
        if(group.sessions.length === 0) return false;
        return group.sessions[0].actionItems.some(a => a.status === ActionItemStatus.BLOCKED);
    };

    const getGroupCategories = (group: WorkingGroup) => {
        const categories = new Set<string>();
        group.sessions.forEach(s => {
            s.actionItems.forEach(a => {
                if (a.category) categories.add(a.category);
            });
        });
        return Array.from(categories);
    };

    const getStatusColor = (status: ActionItemStatus) => {
        switch(status) {
            case ActionItemStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case ActionItemStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case ActionItemStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    const getPriorityColor = (priority: TaskPriority) => {
        switch(priority) {
            case TaskPriority.URGENT: return 'text-red-600 dark:text-red-400';
            case TaskPriority.HIGH: return 'text-orange-500 dark:text-orange-400';
            case TaskPriority.MEDIUM: return 'text-blue-500 dark:text-blue-400';
            default: return 'text-slate-400';
        }
    };

    // --- ACTIONS HANDLERS ---

    const handleCreateGroup = () => {
        const newGroup: WorkingGroup = {
            id: generateId(),
            title: 'New Working Group',
            memberIds: currentUser ? [currentUser.id] : [],
            sessions: [],
            archived: false
        };
        setEditingGroup(newGroup);
    };

    const handleSaveGroup = () => {
        if (editingGroup) {
            onUpdateGroup(editingGroup);
            setEditingGroup(null);
            setSelectedGroupId(editingGroup.id);
        }
    };

    const handleCreateSession = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        const previousSession = group.sessions.length > 0 ? group.sessions[0] : null;
        
        let carryOverActions: ActionItem[] = [];
        let carryOverChecklist: WorkingGroupChecklistItem[] = [];

        if (previousSession) {
            // Smart Carry Over: Clone items that are NOT DONE
            carryOverActions = previousSession.actionItems
                .filter(a => a.status !== ActionItemStatus.DONE)
                .map(a => ({...a, id: generateId()})); 

            if(previousSession.checklist) {
                carryOverChecklist = previousSession.checklist
                    .filter(c => !c.done)
                    .map(c => ({...c, id: generateId()}));
            }
        }

        const newSession: WorkingGroupSession = {
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            notes: '',
            decisions: [],
            actionItems: carryOverActions,
            checklist: carryOverChecklist
        };
        
        setEditingSession({ groupId, session: newSession });
        setActiveTab('notes');
    };

    const handleEditSession = (groupId: string, session: WorkingGroupSession) => {
        // CRITICAL FIX: Deep copy to prevent mutation of the original state during editing
        const sessionCopy = JSON.parse(JSON.stringify(session));
        setEditingSession({ groupId, session: sessionCopy });
        setActiveTab('notes');
    };

    const handleSaveSession = () => {
        if (editingSession) {
            const group = groups.find(g => g.id === editingSession.groupId);
            if (group) {
                const sessionIndex = group.sessions.findIndex(s => s.id === editingSession.session.id);
                let newSessions = [...group.sessions];
                if (sessionIndex >= 0) {
                    newSessions[sessionIndex] = editingSession.session;
                } else {
                    newSessions = [editingSession.session, ...newSessions];
                }
                // Sort by date descending (Newest first)
                newSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                onUpdateGroup({ ...group, sessions: newSessions });
            }
            setEditingSession(null);
        }
    };

    const handleDeleteSession = () => {
        if (!editingSession) return;
        if (window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
            const group = groups.find(g => g.id === editingSession.groupId);
            if (group) {
                const newSessions = group.sessions.filter(s => s.id !== editingSession.session.id);
                onUpdateGroup({ ...group, sessions: newSessions });
            }
            setEditingSession(null);
        }
    };

    // --- IMMUTABLE UPDATE HELPERS ---

    const saveActionFromModal = () => {
        if (!editingSession || !actionInEdit) return;
        const newActions = [...editingSession.session.actionItems];
        if (actionInEdit.index === -1) {
            // New Action
            newActions.push(actionInEdit.action);
        } else {
            // Update Existing
            newActions[actionInEdit.index] = actionInEdit.action;
        }
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, actionItems: newActions }
        });
        setActionInEdit(null);
    }

    const openActionModal = (index: number, action?: ActionItem) => {
        if (action) {
            setActionInEdit({ index, action: { ...action } });
        } else {
            // New Action
            const newAction: ActionItem = { 
                id: generateId(), 
                description: '', 
                ownerId: '', 
                dueDate: '', 
                status: ActionItemStatus.TO_START, 
                eta: '',
                priority: TaskPriority.MEDIUM,
                category: ''
            };
            setActionInEdit({ index: -1, action: newAction });
        }
    };

    const deleteAction = (index: number) => {
        if (!editingSession) return;
        const newActions = editingSession.session.actionItems.filter((_, i) => i !== index);
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, actionItems: newActions }
        });
    };

    const updateChecklist = (index: number, field: keyof WorkingGroupChecklistItem, value: any) => {
        if (!editingSession) return;
        const newList = (editingSession.session.checklist || []).map((item, i) => 
            i === index ? { ...item, [field]: value } : item
        );
        setEditingSession({
            ...editingSession, 
            session: { ...editingSession.session, checklist: newList }
        });
    };

    const addChecklist = () => {
        if (!editingSession) return;
        const newItem: WorkingGroupChecklistItem = { id: generateId(), text: '', isUrgent: false, comment: '', done: false };
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, checklist: [...(editingSession.session.checklist || []), newItem] }
        });
    };

    const deleteChecklist = (index: number) => {
        if (!editingSession) return;
        const newList = (editingSession.session.checklist || []).filter((_, i) => i !== index);
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, checklist: newList }
        });
    };

    const addDecision = () => {
        if (!editingSession || !newDecisionText.trim()) return;
        const newDec = { id: generateId(), text: newDecisionText };
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, decisions: [...(editingSession.session.decisions || []), newDec] }
        });
        setNewDecisionText('');
    };

    const deleteDecision = (id: string) => {
        if (!editingSession) return;
        const newDecisions = (editingSession.session.decisions || []).filter(d => d.id !== id);
        setEditingSession({
            ...editingSession,
            session: { ...editingSession.session, decisions: newDecisions }
        });
    };

    // --- AI HANDLERS ---

    const handleGenerateFullReport = () => {
        if (!selectedGroup || !llmConfig) return;
        askLanguageThen(async (lang) => {
            setIsAiLoading(true);
            setAiContent('');
            setAiModalTitle(`Deep Analysis: ${selectedGroup.title}`);
            setShowAiModal(true);

            const report = await generateWorkingGroupFullReport(selectedGroup, teams, users, llmConfig, lang);
            setAiContent(report);
            setIsAiLoading(false);
        });
    };

    const handleGenerateSessionReport = () => {
        if (!selectedGroup || !llmConfig) return;
        if (selectedGroup.sessions.length === 0) return alert("No sessions to analyze.");
        askLanguageThen(async (lang) => {
            setIsAiLoading(true);
            setAiContent('');
            setAiModalTitle(`Session Summary: ${selectedGroup.title}`);
            setShowAiModal(true);

            const report = await generateWorkingGroupSessionReport(selectedGroup, teams, users, llmConfig, lang);
            setAiContent(report);
            setIsAiLoading(false);
        });
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(aiContent);
        alert("Copied!");
    };

    const exportToDoc = () => {
        const element = document.createElement("a");
        const file = new Blob([aiContent], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "Working_Group_Report.doc"; 
        document.body.appendChild(element);
        element.click();
    };

    // --- RENDERERS ---

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    
    const canEdit = currentUser && (
        currentUser.role === UserRole.ADMIN || 
        selectedGroup?.memberIds.includes(currentUser.id)
    );

    // Action Edit Modal (Popup)
    const renderActionModal = () => {
        if (!actionInEdit) return null;
        const isFreeTextOwner = actionInEdit.action.ownerId && !users.some(u => u.id === actionInEdit.action.ownerId);
        const groupCategories = selectedGroup ? getGroupCategories(selectedGroup) : [];

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <CheckSquare className="w-5 h-5 text-indigo-500" />
                            {actionInEdit.index === -1 ? 'New Action' : 'Edit Action'}
                        </h3>
                        <button onClick={() => setActionInEdit(null)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <textarea 
                                value={actionInEdit.action.description}
                                onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, description: e.target.value}})}
                                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                rows={3}
                                placeholder="What needs to be done?"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                <select 
                                    value={actionInEdit.action.status}
                                    onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, status: e.target.value as ActionItemStatus}})}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    {Object.values(ActionItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                                <select 
                                    value={actionInEdit.action.priority || TaskPriority.MEDIUM}
                                    onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, priority: e.target.value as TaskPriority}})}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white"
                                >
                                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                            <select 
                                value={isFreeTextOwner ? 'EXTERNAL_PERSON' : (actionInEdit.action.ownerId || '')}
                                onChange={e => {
                                    if(e.target.value === 'EXTERNAL_PERSON') {
                                        setActionInEdit({...actionInEdit, action: {...actionInEdit.action, ownerId: 'External Person'}});
                                    } else {
                                        setActionInEdit({...actionInEdit, action: {...actionInEdit.action, ownerId: e.target.value}});
                                    }
                                }}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white mb-2"
                            >
                                <option value="">-- Unassigned --</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                <option value="EXTERNAL_PERSON">-- External Person --</option>
                            </select>
                            
                            {isFreeTextOwner && (
                                <input 
                                    type="text"
                                    value={actionInEdit.action.ownerId}
                                    onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, ownerId: e.target.value}})}
                                    className="w-full p-2 border border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700 dark:text-amber-100 rounded-lg text-sm"
                                    placeholder="Type external name..."
                                    autoFocus
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                <input 
                                    type="text"
                                    list="category-suggestions"
                                    value={actionInEdit.action.category || ''}
                                    onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, category: e.target.value}})}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white"
                                    placeholder="e.g. Legal"
                                />
                                <datalist id="category-suggestions">
                                    {groupCategories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                <input 
                                    type="date"
                                    value={actionInEdit.action.dueDate || ''}
                                    onChange={e => setActionInEdit({...actionInEdit, action: {...actionInEdit.action, dueDate: e.target.value}})}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setActionInEdit(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium">Cancel</button>
                        <button onClick={saveActionFromModal} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md">Save Action</button>
                    </div>
                </div>
            </div>
        );
    }

    const renderSessionModal = () => {
        if (!editingSession) return null;
        const { session } = editingSession;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh] border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Session</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    type="date" 
                                    value={session.date}
                                    onChange={e => setEditingSession({...editingSession, session: {...session, date: e.target.value}})}
                                    className="bg-transparent border-none p-0 text-sm text-slate-500 font-medium focus:ring-0"
                                />
                            </div>
                        </div>
                        <button onClick={() => setEditingSession(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button 
                            onClick={() => setActiveTab('notes')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'notes' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Notes
                        </button>
                        <button 
                            onClick={() => setActiveTab('decisions')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'decisions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Decisions ({(session.decisions || []).length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('actions')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'actions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Actions ({session.actionItems.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('checklist')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'checklist' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Checklist ({(session.checklist || []).length})
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                        
                        {/* TAB: NOTES */}
                        {activeTab === 'notes' && (
                            <div className="h-full flex flex-col">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Meeting Minutes</label>
                                <textarea 
                                    value={session.notes}
                                    onChange={e => setEditingSession({...editingSession, session: {...session, notes: e.target.value}})}
                                    className="flex-1 w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800"
                                    placeholder="Type key points and decisions here..."
                                />
                            </div>
                        )}

                        {/* TAB: DECISIONS */}
                        {activeTab === 'decisions' && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newDecisionText}
                                        onChange={e => setNewDecisionText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addDecision()}
                                        className="flex-1 p-2 border border-amber-200 dark:border-amber-800 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white"
                                        placeholder="Record a key decision..."
                                    />
                                    <button onClick={addDecision} className="px-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg font-bold text-sm">Add</button>
                                </div>

                                <div className="space-y-2">
                                    {(session.decisions || []).map((dec) => (
                                        <div key={dec.id} className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                            <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">{dec.text}</span>
                                            <button onClick={() => deleteDecision(dec.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    {(!session.decisions || session.decisions.length === 0) && (
                                        <div className="text-center py-8 text-slate-400 italic text-sm">
                                            No decisions recorded for this session.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: ACTIONS */}
                        {activeTab === 'actions' && (
                            <div className="space-y-4">
                                <button onClick={() => openActionModal(-1)} className="w-full py-2 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2">
                                    <Plus className="w-4 h-4" /> Add Action Item
                                </button>

                                <div className="space-y-3">
                                    {session.actionItems.map((action, idx) => {
                                        const ownerUser = users.find(u => u.id === action.ownerId);
                                        const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : (action.ownerId || 'Unassigned');
                                        const isExternal = action.ownerId && !ownerUser;

                                        return (
                                            <div key={action.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2 group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer" onClick={() => openActionModal(idx, action)}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getStatusColor(action.status)}`}>
                                                                {action.status}
                                                            </span>
                                                            {action.priority === TaskPriority.URGENT && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                                            <span className="text-sm font-medium text-slate-800 dark:text-white line-clamp-1">{action.description}</span>
                                                        </div>
                                                        <div className="flex gap-2 items-center text-xs text-slate-500 dark:text-slate-400">
                                                            <span className={`flex items-center gap-1 ${isExternal ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                                                <UserPlus className="w-3 h-3"/> {ownerName}
                                                            </span>
                                                            {action.dueDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {action.dueDate}</span>}
                                                            {action.category && <span className="bg-slate-100 dark:bg-slate-700 px-1.5 rounded text-[10px]">{action.category}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); deleteAction(idx); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                            <Trash2 className="w-4 h-4"/>
                                                        </button>
                                                        <Edit2 className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {session.actionItems.length === 0 && <p className="text-center text-sm text-slate-400 italic py-4">No actions defined.</p>}
                                </div>
                            </div>
                        )}

                        {/* TAB: CHECKLIST */}
                        {activeTab === 'checklist' && (
                            <div className="space-y-4">
                                <button onClick={addChecklist} className="w-full py-2 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2">
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>

                                <div className="space-y-2">
                                    {(session.checklist || []).map((item, idx) => (
                                        <div key={item.id} className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <input 
                                                type="checkbox" 
                                                checked={item.done}
                                                onChange={(e) => updateChecklist(idx, 'done', e.target.checked)}
                                                className="w-5 h-5 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="flex-1 space-y-1">
                                                <input 
                                                    type="text" 
                                                    value={item.text}
                                                    onChange={(e) => updateChecklist(idx, 'text', e.target.value)}
                                                    className={`w-full bg-transparent outline-none text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}
                                                    placeholder="Item description..."
                                                />
                                                <input 
                                                    type="text" 
                                                    value={item.comment}
                                                    onChange={(e) => updateChecklist(idx, 'comment', e.target.value)}
                                                    className="w-full bg-transparent outline-none text-xs text-slate-400 italic"
                                                    placeholder="Add a note..."
                                                />
                                            </div>
                                            <button 
                                                onClick={() => updateChecklist(idx, 'isUrgent', !item.isUrgent)}
                                                className={`p-1.5 rounded transition-colors ${item.isUrgent ? 'text-red-500 bg-red-100 dark:bg-red-900/30' : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                                title="Toggle Urgent"
                                            >
                                                <Siren className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteChecklist(idx)} className="text-slate-300 hover:text-red-500 pt-1.5"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-white dark:bg-slate-900 rounded-b-2xl">
                        <button onClick={handleDeleteSession} className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> Delete Session
                        </button>
                        <div className="flex gap-3">
                            <button onClick={() => setEditingSession(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium">Cancel</button>
                            <button onClick={handleSaveSession} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-lg">Save Session</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render Edit Group Modal
    const renderGroupModal = () => {
        if (!editingGroup) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Configure Working Group</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group Title</label>
                            <input 
                                type="text" 
                                value={editingGroup.title}
                                onChange={e => setEditingGroup({...editingGroup, title: e.target.value})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Linked Project (Optional)</label>
                            <select 
                                value={editingGroup.projectId || ''}
                                onChange={e => setEditingGroup({...editingGroup, projectId: e.target.value})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value="">-- Standalone Group --</option>
                                {teams.flatMap(t => t.projects).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Members (Can Edit)</label>
                            <div className="max-h-32 overflow-y-auto border rounded p-2 dark:bg-slate-800 dark:border-slate-700">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 mb-1">
                                        <input 
                                            type="checkbox"
                                            checked={editingGroup.memberIds.includes(u.id)}
                                            onChange={() => {
                                                const ids = editingGroup.memberIds.includes(u.id) 
                                                    ? editingGroup.memberIds.filter(id => id !== u.id)
                                                    : [...editingGroup.memberIds, u.id];
                                                setEditingGroup({...editingGroup, memberIds: ids});
                                            }}
                                        />
                                        <span className="text-sm dark:text-slate-300">{u.firstName} {u.lastName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Cancel</button>
                            <button onClick={handleSaveGroup} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- EMPTY STATE HANDLING ---
    if (!groups || groups.length === 0) {
        return (
            <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto items-center justify-center p-4">
                {renderGroupModal()}
                <div className="text-center bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-lg w-full">
                    <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in duration-500">
                        <Folder className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Working Groups</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-base">
                        Organize your continuous work sessions, track long-term topics, and keep a history of decisions.
                    </p>
                    <button 
                        onClick={handleCreateGroup}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1 flex items-center justify-center mx-auto w-full sm:w-auto"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create First Group
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto gap-6 relative">
            {renderSessionModal()}
            {renderGroupModal()}
            {renderActionModal()}

            <LanguagePickerModal
                isOpen={showLanguagePicker}
                onClose={() => setShowLanguagePicker(false)}
                onSelect={handleLanguageSelected}
            />

            {/* AI Report Modal */}
            {showAiModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <Bot className="w-6 h-6" />
                                {aiModalTitle}
                            </h3>
                            <button onClick={() => setShowAiModal(false)} className="text-white hover:text-indigo-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                            {isAiLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                                    <p className="font-medium">AI is analyzing patterns & durations...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <FormattedText text={aiContent} />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                            <button 
                                onClick={exportToDoc}
                                disabled={isAiLoading}
                                className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> Export Doc
                            </button>
                            <button 
                                onClick={copyToClipboard}
                                disabled={isAiLoading}
                                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar List */}
            <div className="w-1/4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">Working Groups</h2>
                    <button onClick={handleCreateGroup} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {groups.map(group => {
                        const isBlocked = hasBlockedItems(group);
                        return (
                            <div 
                                key={group.id} 
                                onClick={() => setSelectedGroupId(group.id)}
                                className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedGroupId === group.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h3 className={`font-bold text-sm mb-1 ${selectedGroupId === group.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{group.title}</h3>
                                    {isBlocked && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
                                </div>
                                {group.projectId && (
                                    <p className="text-[10px] text-slate-400 flex items-center truncate">
                                        <Folder className="w-3 h-3 mr-1" />
                                        {getProjectName(group.projectId)}
                                    </p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1">{group.sessions.length} sessions</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {selectedGroup ? (
                    <>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{selectedGroup.title}</h2>
                                <div className="flex gap-4 text-sm text-slate-500">
                                    {selectedGroup.projectId && <span className="flex items-center"><Folder className="w-4 h-4 mr-1"/> {getProjectName(selectedGroup.projectId)}</span>}
                                    <span className="flex items-center"><UserPlus className="w-4 h-4 mr-1"/> {selectedGroup.memberIds.length} members</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {/* Sort/Group Toggle */}
                                <button 
                                    onClick={() => setGroupByFamily(!groupByFamily)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center transition-colors shadow-sm border ${groupByFamily ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200'}`}
                                    title="Toggle Group by Family"
                                >
                                    {groupByFamily ? <Layers className="w-4 h-4 mr-1.5"/> : <List className="w-4 h-4 mr-1.5"/>}
                                    {groupByFamily ? 'Grouped' : 'List'}
                                </button>

                                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                                {/* AI Action Buttons */}
                                {llmConfig && (
                                    <>
                                        <button 
                                            onClick={handleGenerateFullReport}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                            title="Generate full history report"
                                        >
                                            <FileText className="w-4 h-4 mr-1.5" /> Full Report
                                        </button>
                                        <button 
                                            onClick={handleGenerateSessionReport}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                            title="Generate summary of last session only"
                                        >
                                            <Sparkles className="w-4 h-4 mr-1.5" /> Last Session
                                        </button>
                                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                    </>
                                )}

                                {/* Permission Check for Edit Buttons */}
                                {canEdit && (
                                    <>
                                        <button onClick={() => setEditingGroup(selectedGroup)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-200 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => onDeleteGroup(selectedGroup.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleCreateSession(selectedGroup.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-indigo-700 transition-colors shadow-sm ml-2">
                                            <Plus className="w-4 h-4 mr-2" /> New Session
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900/50">
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                {selectedGroup.sessions.map((session, index) => (
                                    <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-800 shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            <Clock className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow hover:shadow-md">
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
                                                <time className="font-bold text-indigo-600 dark:text-indigo-400 text-sm flex items-center"><Calendar className="w-4 h-4 mr-1.5"/>{session.date}</time>
                                                {canEdit && (
                                                    <button onClick={() => handleEditSession(selectedGroup.id, session)} className="text-xs text-slate-400 hover:text-indigo-500 font-medium underline">Edit</button>
                                                )}
                                            </div>
                                            
                                            {/* Notes */}
                                            {session.notes && (
                                                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-4 font-serif leading-relaxed">
                                                    {session.notes}
                                                </div>
                                            )}

                                            {/* Decisions (Inline) */}
                                            {session.decisions && session.decisions.length > 0 && (
                                                <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 mb-4">
                                                    <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 flex items-center mb-2">
                                                        <Gavel className="w-3 h-3 mr-1" /> Key Decisions
                                                    </p>
                                                    <ul className="space-y-1">
                                                        {session.decisions.map(d => (
                                                            <li key={d.id} className="text-xs text-slate-800 dark:text-slate-200 flex items-start">
                                                                <span className="mr-2">•</span> {d.text}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {/* Checklist */}
                                            {session.checklist && session.checklist.length > 0 && (
                                                <div className="mb-4 space-y-1">
                                                    {session.checklist.map((item, i) => (
                                                        <div key={i} className="flex flex-col text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                                                            <div className="flex items-center gap-2">
                                                                {item.done 
                                                                    ? <CheckSquare className="w-3 h-3 text-emerald-500" /> 
                                                                    : <span className="w-3 h-3 border border-slate-400 rounded-sm"></span>
                                                                }
                                                                <span className={item.done ? 'line-through opacity-60' : ''}>{item.text}</span>
                                                                {item.isUrgent && <Siren className="w-3 h-3 text-red-500 animate-pulse ml-auto" />}
                                                            </div>
                                                            {item.comment && (
                                                                <p className="ml-5 text-[10px] text-slate-400 italic">"{item.comment}"</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            {session.actionItems.length > 0 && (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mt-3 border border-slate-100 dark:border-slate-800">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center"><CheckSquare className="w-3 h-3 mr-1"/> Actions</p>
                                                    </div>
                                                    
                                                    {/* Grouping Logic for Display */}
                                                    <div className="space-y-3">
                                                    {(() => {
                                                        const actionsToRender = [...session.actionItems];
                                                        
                                                        // Grouping
                                                        if (groupByFamily) {
                                                            const grouped: Record<string, ActionItem[]> = {};
                                                            actionsToRender.forEach(a => {
                                                                const cat = a.category || 'General';
                                                                if (!grouped[cat]) grouped[cat] = [];
                                                                grouped[cat].push(a);
                                                            });

                                                            return Object.entries(grouped).map(([category, items]) => (
                                                                <div key={category}>
                                                                    <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 border-b border-indigo-100 dark:border-indigo-900/30 pb-0.5">{category}</div>
                                                                    <ul className="space-y-2">
                                                                        {items.map(action => renderActionItem(action))}
                                                                    </ul>
                                                                </div>
                                                            ));
                                                        } else {
                                                            return (
                                                                <ul className="space-y-2">
                                                                    {actionsToRender.map(action => renderActionItem(action))}
                                                                </ul>
                                                            );
                                                        }
                                                    })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {selectedGroup.sessions.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-60">
                                        <Layout className="w-16 h-16 text-slate-300 mb-4" />
                                        <p className="text-slate-500 text-sm font-medium">Timeline is empty.</p>
                                        <p className="text-slate-400 text-xs">Create a session to start tracking.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                        <Folder className="w-20 h-20 mb-4 opacity-10" />
                        <p className="text-lg font-medium text-slate-500">Select a working group</p>
                        <p className="text-sm">View details and timeline on the right.</p>
                    </div>
                )}
            </div>
        </div>
    );

    // Render logic for a single action item in view mode
    function renderActionItem(action: ActionItem) {
        const ownerUser = users.find(u => u.id === action.ownerId);
        const ownerName = ownerUser ? ownerUser.firstName : (action.ownerId || 'Unassigned');
        const isExternal = action.ownerId && !ownerUser;

        return (
            <li key={action.id} className="text-xs flex items-start gap-2 bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="flex flex-col items-center gap-1 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-16 text-center ${getStatusColor(action.status)}`}>
                        {action.status}
                    </span>
                    {action.priority && action.priority !== TaskPriority.MEDIUM && (
                        <Flag className={`w-3 h-3 ${getPriorityColor(action.priority)}`} />
                    )}
                </div>
                
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        {!groupByFamily && action.category && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded uppercase tracking-wide">{action.category}</span>
                        )}
                        <span className={`font-medium text-slate-900 dark:text-white truncate ${action.status === ActionItemStatus.DONE ? 'line-through opacity-70' : ''}`}>{action.description}</span>
                    </div>
                    
                    <div className="flex gap-2 mt-1 items-center">
                        {action.ownerId && (
                            <span className={`flex items-center px-1.5 py-0.5 rounded text-[9px] ${isExternal ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {isExternal ? <UserPlus className="w-2.5 h-2.5 mr-1" /> : '@'}
                                {ownerName}
                            </span>
                        )}
                        {action.eta && <span className="opacity-70 text-[9px] flex items-center text-slate-500"><Clock className="w-3 h-3 mr-0.5"/> {action.eta}</span>}
                    </div>
                </div>
            </li>
        );
    }
};

export default WorkingGroupModule;