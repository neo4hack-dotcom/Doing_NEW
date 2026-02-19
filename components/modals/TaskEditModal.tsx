
import React, { useState, useEffect } from 'react';
import { Task, User, TaskStatus, TaskPriority, TaskAction, ChecklistItem, ExternalDependency, TaskActionStatus } from '../../types';
import { X, Trash2, Plus, LayoutList, AlertTriangle, ListTodo, MessageSquare, Link2, ArrowUp, ArrowDown, Globe } from 'lucide-react';

interface TaskEditModalProps {
    task: Task;
    users: User[];
    projectId: string;
    onSave: (projectId: string, task: Task) => void;
    onDelete: (projectId: string, taskId: string) => void;
    onClose: () => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task: initialTask, users, projectId, onSave, onDelete, onClose }) => {
    const [task, setTask] = useState<Task>(initialTask);
    const [newActionText, setNewActionText] = useState('');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [checklistCommentId, setChecklistCommentId] = useState<string | null>(null);
    const [newDepLabel, setNewDepLabel] = useState('');
    const [newDepStatus, setNewDepStatus] = useState<'Green' | 'Amber' | 'Red'>('Green');
    const [newUrl, setNewUrl] = useState('');

    // Helper to check if assignee is custom text or user ID
    const isKnownUser = (id?: string) => users.some(u => u.id === id);
    const isCustomAssignee = task.assigneeId && !isKnownUser(task.assigneeId);

    const getStatusColor = (status: TaskStatus) => {
        // Simple mapping for border colors in select
        switch (status) {
            case TaskStatus.DONE: return 'border-emerald-200';
            case TaskStatus.BLOCKED: return 'border-red-200';
            case TaskStatus.ONGOING: return 'border-blue-200';
            default: return 'border-slate-200';
        }
    };

    const getActionStatusColor = (status: TaskActionStatus) => {
        switch(status) {
            case 'Done': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
            case 'Blocked': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
            case 'Ongoing': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'To Do': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
        }
    };

    const getRagColor = (status: 'Red' | 'Amber' | 'Green') => {
        switch(status) {
            case 'Red': return 'bg-red-500 text-white';
            case 'Amber': return 'bg-amber-500 text-white';
            case 'Green': return 'bg-emerald-500 text-white';
            default: return 'bg-slate-400';
        }
    };

    // --- ACTIONS LOGIC ---
    const handleAddAction = () => {
        if (!newActionText.trim()) return;
        const newAction: TaskAction = {
            id: Date.now().toString(),
            text: newActionText,
            status: 'To Do'
        };
        setTask(prev => ({ ...prev, actions: [...(prev.actions || []), newAction] }));
        setNewActionText('');
    };

    const handleUpdateActionStatus = (actionId: string, newStatus: TaskActionStatus) => {
        setTask(prev => ({
            ...prev,
            actions: (prev.actions || []).map(a => a.id === actionId ? { ...a, status: newStatus } : a)
        }));
    };

    const handleUpdateActionText = (actionId: string, newText: string) => {
        setTask(prev => ({
            ...prev,
            actions: (prev.actions || []).map(a => a.id === actionId ? { ...a, text: newText } : a)
        }));
    };

    const handleMoveAction = (index: number, direction: 'up' | 'down') => {
        const actions = [...(task.actions || [])];
        if (direction === 'up') {
            if (index === 0) return;
            [actions[index], actions[index - 1]] = [actions[index - 1], actions[index]];
        } else {
            if (index === actions.length - 1) return;
            [actions[index], actions[index + 1]] = [actions[index + 1], actions[index]];
        }
        setTask(prev => ({ ...prev, actions }));
    };

    const handleDeleteAction = (actionId: string) => {
        setTask(prev => ({
            ...prev,
            actions: (prev.actions || []).filter(a => a.id !== actionId)
        }));
    };

    // --- CHECKLIST LOGIC ---
    const handleAddChecklistItem = () => {
        if (!newChecklistItem.trim()) return;
        const newItem: ChecklistItem = {
            id: Date.now().toString(),
            text: newChecklistItem,
            done: false,
            comment: ''
        };
        setTask(prev => ({ ...prev, checklist: [...(prev.checklist || []), newItem] }));
        setNewChecklistItem('');
    };

    const handleToggleChecklistItem = (itemId: string) => {
        setTask(prev => ({
            ...prev,
            checklist: (prev.checklist || []).map(item => item.id === itemId ? { ...item, done: !item.done } : item)
        }));
    };

    const handleDeleteChecklistItem = (itemId: string) => {
        setTask(prev => ({
            ...prev,
            checklist: (prev.checklist || []).filter(item => item.id !== itemId)
        }));
    };

    const handleUpdateChecklistComment = (itemId: string, comment: string) => {
        setTask(prev => ({
            ...prev,
            checklist: (prev.checklist || []).map(item => item.id === itemId ? { ...item, comment } : item)
        }));
    };

    // --- EXTERNAL DEPENDENCIES LOGIC ---
    const addExternalDependency = () => {
        if (!newDepLabel.trim()) return;
        const newDep: ExternalDependency = {
            id: Date.now().toString(),
            label: newDepLabel,
            status: newDepStatus
        };
        setTask(prev => ({
            ...prev,
            externalDependencies: [...(prev.externalDependencies || []), newDep]
        }));
        setNewDepLabel('');
        setNewDepStatus('Green');
    };

    const removeExternalDependency = (id: string) => {
        setTask(prev => ({
            ...prev,
            externalDependencies: (prev.externalDependencies || []).filter(d => d.id !== id)
        }));
    };

    const updateExternalDependencyStatus = (id: string, status: 'Red' | 'Amber' | 'Green') => {
        setTask(prev => ({
            ...prev,
            externalDependencies: (prev.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d)
        }));
    };

    // --- URLS LOGIC ---
    const addUrl = () => {
        if (!newUrl.trim()) return;
        const currentUrls = task.docUrls || [];
        if (currentUrls.length >= 5) return alert("Maximum 5 links allowed.");
        
        setTask(prev => ({ ...prev, docUrls: [...currentUrls, newUrl.trim()] }));
        setNewUrl('');
    };

    const removeUrl = (index: number) => {
        setTask(prev => ({
            ...prev,
            docUrls: (prev.docUrls || []).filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-lg font-bold dark:text-white">Edit Task</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="space-y-4">
                    {/* Title & Order */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                            <input 
                                type="text" 
                                value={task.title} 
                                onChange={e => setTask({...task, title: e.target.value})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                        </div>
                        <div className="w-20">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order</label>
                            <input 
                                type="number" 
                                value={task.order || 0} 
                                onChange={e => setTask({...task, order: parseInt(e.target.value)})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
                            <span className="text-[10px] text-slate-400 font-mono">{(task.description || '').length}/3000</span>
                        </div>
                        <textarea 
                            value={task.description || ''} 
                            onChange={e => setTask({...task, description: e.target.value})} 
                            maxLength={3000}
                            rows={4}
                            placeholder="Add detailed task description..."
                            className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm resize-y" 
                        />
                    </div>

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select 
                                value={task.status} 
                                onChange={e => setTask({...task, status: e.target.value as TaskStatus})} 
                                className={`w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white ${getStatusColor(task.status)}`}
                            >
                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                            <select 
                                value={task.priority} 
                                onChange={e => setTask({...task, priority: e.target.value as TaskPriority})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                {Object.values(TaskPriority).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Weight & ETA */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Weight (Impact)</label>
                            <input 
                                type="number" min="1" max="10" 
                                value={task.weight || 1} 
                                onChange={e => setTask({...task, weight: parseInt(e.target.value) || 1})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ETA (Deadline)</label>
                            <input 
                                type="date"
                                value={task.eta || ''}
                                onChange={e => setTask({...task, eta: e.target.value})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                        </div>
                    </div>

                    {/* Assignee & Cost */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                            <div className="space-y-2">
                                <select 
                                    value={isCustomAssignee ? 'CUSTOM_ASSIGNEE' : (task.assigneeId || '')} 
                                    onChange={e => {
                                        if (e.target.value === 'CUSTOM_ASSIGNEE') {
                                            setTask({...task, assigneeId: 'External Contact'});
                                        } else {
                                            setTask({...task, assigneeId: e.target.value});
                                        }
                                    }} 
                                    className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                    <option value="CUSTOM_ASSIGNEE">-- Other / External --</option>
                                </select>
                                {isCustomAssignee && (
                                    <input 
                                        type="text"
                                        value={task.assigneeId}
                                        onChange={e => setTask({...task, assigneeId: e.target.value})}
                                        placeholder="Enter external name..."
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm bg-indigo-50 dark:bg-indigo-900/20"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="w-24">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost (MD)</label>
                            <input 
                                type="number" 
                                min="0"
                                value={task.cost || 0} 
                                onChange={e => setTask({...task, cost: parseFloat(e.target.value) || 0})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                        </div>
                    </div>

                    {/* Links / Docs */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4" /> External Links (Docs) - Max 5
                        </label>
                        <div className="space-y-2 mb-2">
                            {(task.docUrls || []).map((url, index) => (
                                <div key={index} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                    <Globe className="w-4 h-4 text-slate-400" />
                                    <span className="flex-1 text-sm text-indigo-600 dark:text-indigo-400 truncate cursor-pointer hover:underline" title={url} onClick={() => window.open(url, '_blank')}>{url}</span>
                                    <button onClick={() => removeUrl(index)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {(task.docUrls?.length || 0) < 5 && (
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newUrl}
                                    onChange={e => setNewUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                    onKeyDown={e => e.key === 'Enter' && addUrl()}
                                />
                                <button onClick={addUrl} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                            </div>
                        )}
                    </div>

                    {/* External Dependencies */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <Link2 className="w-4 h-4" /> External Dependencies
                        </label>
                        <div className="space-y-2 mb-2">
                            {(task.externalDependencies || []).map(dep => (
                                <div key={dep.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                    <select 
                                        value={dep.status} 
                                        onChange={(e) => updateExternalDependencyStatus(dep.id, e.target.value as any)}
                                        className={`w-4 h-4 rounded-full appearance-none cursor-pointer ${getRagColor(dep.status)} border-none focus:ring-0`}
                                    >
                                        <option value="Green">Green</option>
                                        <option value="Amber">Amber</option>
                                        <option value="Red">Red</option>
                                    </select>
                                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{dep.label}</span>
                                    <button onClick={() => removeExternalDependency(dep.id)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newDepLabel}
                                onChange={e => setNewDepLabel(e.target.value)}
                                placeholder="e.g. Legal Check"
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                            <select 
                                value={newDepStatus}
                                onChange={e => setNewDepStatus(e.target.value as any)}
                                className="p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            >
                                <option value="Green">Green</option>
                                <option value="Amber">Amber</option>
                                <option value="Red">Red</option>
                            </select>
                            <button onClick={addExternalDependency} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                        </div>
                    </div>

                    {/* Task Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <LayoutList className="w-4 h-4" /> Sub-actions
                        </label>
                        <div className="space-y-2 mb-3">
                            {(task.actions || []).map((action, index) => (
                                <div key={action.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700 group">
                                    <div className="flex flex-col gap-0.5">
                                        <button 
                                            onClick={() => handleMoveAction(index, 'up')}
                                            disabled={index === 0}
                                            className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={() => handleMoveAction(index, 'down')}
                                            disabled={index === (task.actions?.length || 0) - 1}
                                            className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <select 
                                        value={action.status} 
                                        onChange={(e) => handleUpdateActionStatus(action.id, e.target.value as any)}
                                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded cursor-pointer border focus:outline-none ${getActionStatusColor(action.status)}`}
                                    >
                                        <option value="To Do">To Do</option>
                                        <option value="Ongoing">Ongoing</option>
                                        <option value="Blocked">Blocked</option>
                                        <option value="Done">Done</option>
                                    </select>
                                    <input 
                                        type="text"
                                        value={action.text}
                                        onChange={(e) => handleUpdateActionText(action.id, e.target.value)}
                                        className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none focus:ring-0 px-2 py-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                    />
                                    <button onClick={() => handleDeleteAction(action.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newActionText}
                                onChange={e => setNewActionText(e.target.value)}
                                placeholder="Add action step..."
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleAddAction()}
                            />
                            <button onClick={handleAddAction} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">Add</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="taskImp" checked={task.isImportant} onChange={e => setTask({...task, isImportant: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                        <label htmlFor="taskImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                    </div>

                    {/* Checklist Section */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <ListTodo className="w-4 h-4" /> Checklist
                        </label>
                        <div className="space-y-3 mb-2">
                            {(task.checklist || []).map(item => (
                                <div key={item.id} className="group">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={item.done} 
                                            onChange={() => handleToggleChecklistItem(item.id)}
                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" 
                                        />
                                        <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {item.text}
                                        </span>
                                        <button 
                                            onClick={() => setChecklistCommentId(checklistCommentId === item.id ? null : item.id)}
                                            className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${item.comment ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
                                            title="Add/Edit Comment"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {(checklistCommentId === item.id || item.comment) && (
                                        <div className="ml-6 mt-1 flex items-center gap-2">
                                            <input 
                                                type="text"
                                                value={item.comment || ''}
                                                onChange={(e) => handleUpdateChecklistComment(item.id, e.target.value)}
                                                placeholder="Add a note..."
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newChecklistItem}
                                onChange={e => setNewChecklistItem(e.target.value)}
                                placeholder="New item..."
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                            />
                            <button onClick={handleAddChecklistItem} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">Add</button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between pt-4">
                    <button onClick={() => onDelete(projectId, task.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium flex items-center transition-colors">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </button>
                    <button onClick={() => onSave(projectId, task)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Save Task</button>
                </div>
            </div>
        </div>
    );
};

export default TaskEditModal;
