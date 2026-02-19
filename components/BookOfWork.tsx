
import React, { useState, useEffect } from 'react';
import { Team, User, Project, ProjectStatus, ProjectRole, Team as TeamType, ExternalDependency } from '../types';
import { Search, ExternalLink, Link as LinkIcon, Users, Network, Calendar, ChevronDown, ChevronRight, LayoutGrid, List, Plus, X, Save, Trash2, Sparkles, Link2, ArrowUpDown, Bot } from 'lucide-react';

interface BookOfWorkProps {
    teams: Team[];
    users: User[];
    onUpdateTeam: (team: Team) => void;
}

const BookOfWork: React.FC<BookOfWorkProps> = ({ teams, users, onUpdateTeam }) => {
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'deadline' | 'status' | 'team' | 'creation'>('name');
    const [editingProject, setEditingProject] = useState<{project: Project, teamId: string} | null>(null);
    const [isNewProject, setIsNewProject] = useState(false);

    // Dependency state for modal
    const [newDepLabel, setNewDepLabel] = useState('');
    const [newDepStatus, setNewDepStatus] = useState<'Green' | 'Amber' | 'Red'>('Green');

    // Initial Empty Project
    const emptyProject: Project = {
        id: '',
        name: '',
        description: '',
        status: ProjectStatus.PLANNING,
        managerId: '',
        deadline: new Date().toISOString().split('T')[0],
        members: [],
        tasks: [],
        isImportant: false,
        docUrls: [],
        dependencies: [],
        externalDependencies: [],
        additionalDescriptions: []
    };

    // Flatten all projects for display
    const allProjects = teams.flatMap(t => t.projects.map(p => ({ ...p, teamName: t.name, teamId: t.id })));
    
    // Filter & Sort
    const filteredProjects = allProjects
        .filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            if (sortBy === 'status') return a.status.localeCompare(b.status);
            if (sortBy === 'team') return a.teamName.localeCompare(b.teamName);
            if (sortBy === 'creation') return b.id.localeCompare(a.id); // Descending (Newest first) based on timestamp ID
            return 0;
        });

    // Handle Escape Key to close modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEditingProject(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCreateProject = () => {
        setIsNewProject(true);
        // Default to first team if available
        const defaultTeamId = teams[0]?.id || '';
        setEditingProject({
            project: { ...emptyProject, id: Date.now().toString() },
            teamId: defaultTeamId
        });
    };

    const handleEditProject = (project: Project, teamId: string) => {
        setIsNewProject(false);
        setEditingProject({ project: { ...project }, teamId });
    };

    const handleSaveProject = () => {
        if (!editingProject) return;

        const { project, teamId } = editingProject;
        if (!project.name || !teamId) {
            alert("Project Name and Team are required.");
            return;
        }

        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        let updatedTeam = { ...team };

        if (isNewProject) {
            updatedTeam.projects = [...updatedTeam.projects, project];
        } else {
            updatedTeam.projects = updatedTeam.projects.map(p => p.id === project.id ? project : p);
        }

        onUpdateTeam(updatedTeam);
        setEditingProject(null);
    };

    const handleDeleteProject = () => {
        if (!editingProject) return;
        if(!window.confirm("Are you sure you want to delete this project?")) return;

        const { project, teamId } = editingProject;
        const team = teams.find(t => t.id === teamId);
        if(!team) return;

        const updatedTeam = { ...team };
        updatedTeam.projects = updatedTeam.projects.filter(p => p.id !== project.id);
        
        onUpdateTeam(updatedTeam);
        setEditingProject(null);
    }

    // --- Form Helpers ---
    const addLink = () => {
        if (!editingProject) return;
        setEditingProject({
            ...editingProject,
            project: { ...editingProject.project, docUrls: [...(editingProject.project.docUrls || []), ''] }
        });
    };

    const updateLink = (index: number, val: string) => {
        if (!editingProject) return;
        const newLinks = [...(editingProject.project.docUrls || [])];
        newLinks[index] = val;
        setEditingProject({ ...editingProject, project: { ...editingProject.project, docUrls: newLinks } });
    };

    const removeLink = (index: number) => {
        if (!editingProject) return;
        const newLinks = (editingProject.project.docUrls || []).filter((_, i) => i !== index);
        setEditingProject({ ...editingProject, project: { ...editingProject.project, docUrls: newLinks } });
    };

    const toggleDependency = (depId: string) => {
        if (!editingProject) return;
        const currentDeps = editingProject.project.dependencies || [];
        const newDeps = currentDeps.includes(depId) 
            ? currentDeps.filter(id => id !== depId)
            : [...currentDeps, depId];
        setEditingProject({ ...editingProject, project: { ...editingProject.project, dependencies: newDeps } });
    };

    const addExternalDependency = () => {
        if (!editingProject || !newDepLabel.trim()) return;
        const newDep: ExternalDependency = {
            id: Date.now().toString(),
            label: newDepLabel,
            status: newDepStatus
        };
        setEditingProject({
            ...editingProject,
            project: {
                ...editingProject.project,
                externalDependencies: [...(editingProject.project.externalDependencies || []), newDep]
            }
        });
        setNewDepLabel('');
        setNewDepStatus('Green');
    };

    const removeExternalDependency = (id: string) => {
        if (!editingProject) return;
        setEditingProject({
            ...editingProject,
            project: {
                ...editingProject.project,
                externalDependencies: (editingProject.project.externalDependencies || []).filter(d => d.id !== id)
            }
        });
    };

    const updateExternalDependencyStatus = (id: string, status: 'Red' | 'Amber' | 'Green') => {
        if (!editingProject) return;
        const updated = (editingProject.project.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d);
        setEditingProject({
            ...editingProject,
            project: { ...editingProject.project, externalDependencies: updated }
        });
    };

    const updateAdditionalDescription = (index: number, value: string) => {
        if (!editingProject) return;
        const newDescriptions = [...(editingProject.project.additionalDescriptions || ['', '', ''])];
        newDescriptions[index] = value;
        setEditingProject({ ...editingProject, project: { ...editingProject.project, additionalDescriptions: newDescriptions } });
    };

    const getStatusBadge = (status: ProjectStatus) => {
        const styles = {
            [ProjectStatus.ACTIVE]: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
            [ProjectStatus.DONE]: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
            [ProjectStatus.PAUSED]: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
            [ProjectStatus.PLANNING]: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status]}`}>{status}</span>;
    };

    const getRagColor = (status: 'Red' | 'Amber' | 'Green') => {
        switch(status) {
            case 'Red': return 'bg-red-500';
            case 'Amber': return 'bg-amber-500';
            case 'Green': return 'bg-emerald-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto relative">
            
            {/* Modal Edit/Create */}
            {editingProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                {isNewProject ? 'Create New Project' : 'Edit Project'}
                            </h3>
                            <button onClick={() => setEditingProject(null)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name *</label>
                                    <input 
                                        type="text" 
                                        value={editingProject.project.name} 
                                        onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, name: e.target.value}})}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                    <textarea 
                                        value={editingProject.project.description}
                                        onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, description: e.target.value}})}
                                        rows={2}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team *</label>
                                    <select 
                                        value={editingProject.teamId}
                                        onChange={e => setEditingProject({...editingProject, teamId: e.target.value})}
                                        disabled={!isNewProject} // Disable team move for simplicity for now
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:opacity-50"
                                    >
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Manager</label>
                                    <select 
                                        value={editingProject.project.managerId || ''}
                                        onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, managerId: e.target.value}})}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">Select Manager...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select 
                                        value={editingProject.project.status}
                                        onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, status: e.target.value as ProjectStatus}})}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deadline</label>
                                    <input 
                                        type="date"
                                        value={editingProject.project.deadline}
                                        onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, deadline: e.target.value}})}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* External Dependencies */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                    <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                                </label>
                                <div className="space-y-2 mb-2">
                                    {(editingProject.project.externalDependencies || []).map(dep => (
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
                                        placeholder="Dependency Name (e.g. API Team)"
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

                            {/* Context Fields */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                                <label className="block text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center">
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    AI Context Layers (Hidden)
                                </label>
                                <div className="space-y-3">
                                    {[0, 1, 2].map(i => (
                                        <div key={i}>
                                            <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Context Layer {i+1}</label>
                                            <textarea 
                                                value={(editingProject.project.additionalDescriptions && editingProject.project.additionalDescriptions[i]) || ''}
                                                onChange={e => updateAdditionalDescription(i, e.target.value)}
                                                maxLength={2000}
                                                rows={2}
                                                className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500"
                                                placeholder={`Add private context for AI... (Max 2000 chars)`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Doc Links */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Documentation Links</label>
                                <div className="space-y-2">
                                    {(editingProject.project.docUrls || []).map((url, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={url}
                                                onChange={e => updateLink(idx, e.target.value)}
                                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                                placeholder="https://..."
                                            />
                                            <button onClick={() => removeLink(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={addLink} className="text-sm text-indigo-600 flex items-center font-medium">
                                        <Plus className="w-4 h-4 mr-1" /> Add Link
                                    </button>
                                </div>
                            </div>

                            {/* Dependencies */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dependencies</label>
                                <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-900">
                                    {allProjects.filter(p => p.id !== editingProject.project.id).map(p => (
                                        <div key={p.id} className="flex items-center gap-2 mb-1">
                                            <input 
                                                type="checkbox"
                                                checked={(editingProject.project.dependencies || []).includes(p.id)}
                                                onChange={() => toggleDependency(p.id)}
                                                className="rounded text-indigo-600"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{p.name} <span className="text-xs text-slate-400">({p.teamName})</span></span>
                                        </div>
                                    ))}
                                    {allProjects.length <= 1 && <span className="text-xs text-slate-400">No other projects available.</span>}
                                </div>
                            </div>

                             {/* Importance */}
                             <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="projImpEdit"
                                    checked={editingProject.project.isImportant}
                                    onChange={e => setEditingProject({...editingProject, project: {...editingProject.project, isImportant: e.target.checked}})}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <label htmlFor="projImpEdit" className="text-sm font-medium text-slate-700 dark:text-slate-300">Mark as Strategic / Important</label>
                            </div>

                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-white dark:bg-slate-900 rounded-b-2xl sticky bottom-0">
                            {!isNewProject ? (
                                <button onClick={handleDeleteProject} className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors">
                                    Delete Project
                                </button>
                            ) : <div></div>}
                            <div className="flex gap-3">
                                <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleSaveProject} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors flex items-center">
                                    <Save className="w-4 h-4 mr-2" /> Save Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex gap-4 w-full md:w-auto items-center">
                    <div className="relative w-full md:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search projects..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                        />
                    </div>
                    
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white cursor-pointer appearance-none"
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="creation">Creation (Newest)</option>
                            <option value="deadline">Deadline (Earliest)</option>
                            <option value="status">Status</option>
                            <option value="team">Team</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <button 
                        onClick={handleCreateProject}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4 mr-2" /> New Project
                    </button>
                </div>
                
                <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map(project => (
                        <div 
                            key={project.id} 
                            onClick={() => handleEditProject(project, project.teamId)}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{project.teamName}</span>
                                {getStatusBadge(project.status)}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                                {project.name}
                                {(project as any).createdByBot && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-200 dark:border-emerald-800" title="Created by PRJ Bot">
                                        <Bot className="w-3 h-3" />
                                        BOT
                                    </span>
                                )}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">{project.description}</p>
                            
                            {/* Metadata */}
                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                {project.docUrls && project.docUrls.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <LinkIcon className="w-4 h-4 text-slate-400 mt-0.5" />
                                        <div className="flex flex-col gap-1">
                                            {project.docUrls.map((url, i) => (
                                                <a key={i} href={url} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate max-w-[200px]">
                                                    {url.replace(/(^\w+:|^)\/\//, '')} <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {project.dependencies && project.dependencies.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <Network className="w-4 h-4 text-slate-400 mt-0.5" />
                                        <div className="flex flex-wrap gap-1">
                                            {project.dependencies.map(depId => {
                                                const depProject = allProjects.find(p => p.id === depId);
                                                return depProject ? (
                                                    <span key={depId} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                        {depProject.name}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {project.externalDependencies && project.externalDependencies.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {project.externalDependencies.map(dep => (
                                            <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                <span className={`w-2 h-2 rounded-full mr-1.5 ${getRagColor(dep.status)}`}></span>
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{dep.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex -space-x-2">
                                        {project.members.map(m => {
                                            const u = users.find(usr => usr.id === m.userId);
                                            return u ? (
                                                <div key={m.userId} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300" title={`${u.firstName} ${u.lastName} (${m.role})`}>
                                                    {u.firstName[0]}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {project.deadline}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">Project</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Contributors</th>
                                <th className="px-6 py-4">Docs & Links</th>
                                <th className="px-6 py-4">Dependencies</th>
                                <th className="px-6 py-4">Deadline</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredProjects.map(project => (
                                <tr 
                                    key={project.id} 
                                    onClick={() => handleEditProject(project, project.teamId)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{project.name}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{project.teamName}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(project.status)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex -space-x-2">
                                            {project.members.map(m => {
                                                const u = users.find(usr => usr.id === m.userId);
                                                return u ? (
                                                    <div key={m.userId} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 cursor-help" title={`${u.firstName} ${u.lastName} (${m.role})`}>
                                                        {u.firstName[0]}{u.lastName[0]}
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {project.docUrls && project.docUrls.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {project.docUrls.map((url, i) => (
                                                    <a key={i} href={url} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                                        <LinkIcon className="w-3 h-3" />
                                                        <span className="truncate max-w-[150px]">{url.replace(/(^\w+:|^)\/\//, '')}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : <span className="text-slate-400 italic text-xs">No links</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {project.dependencies && project.dependencies.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {project.dependencies.map(depId => {
                                                        const depProject = allProjects.find(p => p.id === depId);
                                                        return depProject ? (
                                                            <span key={depId} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                                {depProject.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                            {project.externalDependencies && project.externalDependencies.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {project.externalDependencies.map(dep => (
                                                        <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                                                            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${getRagColor(dep.status)}`}></span>
                                                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[80px]">{dep.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {(!project.dependencies?.length && !project.externalDependencies?.length) && <span className="text-slate-400 italic text-xs">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        {project.deadline}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BookOfWork;