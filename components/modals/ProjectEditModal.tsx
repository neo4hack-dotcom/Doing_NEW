
import React, { useState } from 'react';
import { Project, User, Team, ProjectStatus, ExternalDependency } from '../../types';
import { X, Crown, PenTool, Link2, Trash2, BrainCircuit, AlertTriangle, Save, Plus, Globe, MoveRight, Star } from 'lucide-react';

interface ProjectEditModalProps {
    project: Project;
    users: User[];
    teams: Team[]; // List of all available teams
    teamId: string; // Current team ID
    onSave: (project: Project, targetTeamId: string) => void;
    onDelete?: (projectId: string) => void; // Optional if new
    onClose: () => void;
}

const ProjectEditModal: React.FC<ProjectEditModalProps> = ({ project: initialProject, users, teams, teamId, onSave, onDelete, onClose }) => {
    const [project, setProject] = useState<Project>(initialProject);
    const [selectedTeamId, setSelectedTeamId] = useState<string>(teamId);
    
    // Dependencies State
    const [newDepLabel, setNewDepLabel] = useState('');
    const [newDepStatus, setNewDepStatus] = useState<'Green' | 'Amber' | 'Red'>('Green');

    // URL State
    const [newUrl, setNewUrl] = useState('');

    const isNew = !project.id || project.id === '';

    const getRagColor = (status: 'Red' | 'Amber' | 'Green') => {
        switch(status) {
            case 'Red': return 'bg-red-500 text-white';
            case 'Amber': return 'bg-amber-500 text-white';
            case 'Green': return 'bg-emerald-500 text-white';
            default: return 'bg-slate-400';
        }
    };

    // --- EXTERNAL DEPENDENCIES ---
    const addExternalDependency = () => {
        if (!newDepLabel.trim()) return;
        const newDep: ExternalDependency = {
            id: Date.now().toString(),
            label: newDepLabel,
            status: newDepStatus
        };
        setProject(prev => ({
            ...prev,
            externalDependencies: [...(prev.externalDependencies || []), newDep]
        }));
        setNewDepLabel('');
        setNewDepStatus('Green');
    };

    const removeExternalDependency = (id: string) => {
        setProject(prev => ({
            ...prev,
            externalDependencies: (prev.externalDependencies || []).filter(d => d.id !== id)
        }));
    };

    const updateExternalDependencyStatus = (id: string, status: 'Red' | 'Amber' | 'Green') => {
        setProject(prev => ({
            ...prev,
            externalDependencies: (prev.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d)
        }));
    };

    // --- CONTEXT LAYERS ---
    const updateAdditionalDescription = (index: number, value: string) => {
        const newDescriptions = [...(project.additionalDescriptions || ['', '', ''])];
        newDescriptions[index] = value;
        setProject({ ...project, additionalDescriptions: newDescriptions });
    };

    // --- URLS MANAGEMENT ---
    const addUrl = () => {
        if (!newUrl.trim()) return;
        const currentUrls = project.docUrls || [];
        if (currentUrls.length >= 5) return alert("Maximum 5 links allowed.");
        
        setProject({ ...project, docUrls: [...currentUrls, newUrl.trim()] });
        setNewUrl('');
    };

    const removeUrl = (index: number) => {
        const newUrls = (project.docUrls || []).filter((_, i) => i !== index);
        setProject({ ...project, docUrls: newUrls });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <h3 className="text-lg font-bold dark:text-white">{isNew ? 'Create New Project' : 'Edit Project'}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                    {/* Basic Info */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                        <input type="text" value={project.name} onChange={e => setProject({...project, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <textarea value={project.description} onChange={e => setProject({...project, description: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" rows={3} />
                    </div>
                    
                    {/* Team Selection (Move Project) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            Team Location {selectedTeamId !== teamId && <span className="text-amber-500 ml-2 text-[10px] flex items-center bg-amber-50 dark:bg-amber-900/20 px-1.5 rounded"><MoveRight className="w-3 h-3 mr-1"/> Moving to new team</span>}
                        </label>
                        <select 
                            value={selectedTeamId} 
                            onChange={e => setSelectedTeamId(e.target.value)} 
                            className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name} {t.id === teamId ? '(Current)' : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={project.status} onChange={e => setProject({...project, status: e.target.value as ProjectStatus})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deadline</label>
                            <input type="date" value={project.deadline} onChange={e => setProject({...project, deadline: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                        </div>
                        {/* Cost Field */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost (MD)</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={project.cost || 0} 
                                onChange={e => setProject({...project, cost: parseFloat(e.target.value) || 0})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                        </div>
                    </div>

                    {/* Owner & Architect Fields */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <Crown className="w-3 h-3 text-amber-500" /> Project Owner
                            </label>
                            <input 
                                list="user-list-suggestions" 
                                type="text"
                                value={project.owner || ''} 
                                onChange={e => setProject({...project, owner: e.target.value})}
                                className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder-slate-400"
                                placeholder="Select or type name..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <PenTool className="w-3 h-3 text-indigo-500" /> Architect
                            </label>
                            <input 
                                list="user-list-suggestions" 
                                type="text"
                                value={project.architect || ''} 
                                onChange={e => setProject({...project, architect: e.target.value})}
                                className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder-slate-400"
                                placeholder="Select or type name..."
                            />
                        </div>
                    </div>

                    {/* URLs / Documents */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4" /> External Links (Docs, Specs) - Max 5
                        </label>
                        <div className="space-y-2 mb-2">
                            {(project.docUrls || []).map((url, index) => (
                                <div key={index} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                    <Globe className="w-4 h-4 text-slate-400" />
                                    <span className="flex-1 text-sm text-indigo-600 dark:text-indigo-400 truncate cursor-pointer hover:underline" title={url} onClick={() => window.open(url, '_blank')}>{url}</span>
                                    <button onClick={() => removeUrl(index)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {(project.docUrls?.length || 0) < 5 && (
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newUrl}
                                    onChange={e => setNewUrl(e.target.value)}
                                    placeholder="https://docs.google.com/..."
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
                            <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                        </label>
                        <div className="space-y-2 mb-2">
                            {(project.externalDependencies || []).map(dep => (
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
                                placeholder="e.g. API Team"
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

                    {/* AI Context Fields */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">LLM Context Injection</h4>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 opacity-80">
                                    Data entered here is invisible to the team but used by the AI.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: "1. Strategic Context", placeholder: "e.g. Critical for Q4 IPO..." },
                                { label: "2. Technical Constraints", placeholder: "e.g. Legacy API..." },
                                { label: "3. Team & Risks", placeholder: "e.g. Junior team..." }
                            ].map((layer, i) => (
                                <div key={i}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">{layer.label}</label>
                                    <textarea
                                        value={(project.additionalDescriptions && project.additionalDescriptions[i]) || ''}
                                        onChange={e => updateAdditionalDescription(i, e.target.value)}
                                        maxLength={2000}
                                        rows={2}
                                        className="w-full p-3 text-sm border border-indigo-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-800 dark:text-slate-200"
                                        placeholder={layer.placeholder}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="projImp" checked={project.isImportant} onChange={e => setProject({...project, isImportant: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                        <label htmlFor="projImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <button onClick={() => onSave(project, selectedTeamId)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium flex items-center">
                        <Save className="w-4 h-4 mr-2"/> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectEditModal;
