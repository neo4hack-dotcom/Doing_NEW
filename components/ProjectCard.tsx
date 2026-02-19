
import React, { useState } from 'react';
import { Project, User, TaskStatus, ProjectStatus, TaskPriority, Task, TaskActionStatus } from '../types';
import { 
    AlertTriangle, Calendar, Pencil, Trash2, RotateCcw, Archive, ChevronDown,
    Eye, EyeOff, ArrowUpAz, Sparkles, Plus, AlertCircle, ListTodo,
    Flag, Scale, UserPlus, UserCircle2, Link2, Network, Crown, PenTool, Coins, History, Star, ExternalLink, Globe, Cpu
} from 'lucide-react';

interface ProjectCardProps {
    project: Project;
    users: User[];
    teamId: string;
    isExpanded: boolean;
    isSelected: boolean;
    showArchived: boolean;
    onToggleExpand: (projectId: string) => void;
    onToggleSelection: (projectId: string) => void;
    onEditProject: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
    onArchiveProject: (projectId: string, restore: boolean) => void;
    onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
    onViewHistory: () => void; 
    onToggleFavorite: () => void; // New Prop
    
    // Task callbacks
    onAddTask: (projectId: string) => void;
    onEditTask: (projectId: string, task: Task) => void;
    onDeleteTask: (projectId: string, taskId: string) => void;
    onUpdateTaskField: (projectId: string, taskId: string, field: keyof Task, value: any) => void;
    onGenerateRoadmap: (project: Project) => void;
    loadingRoadmap: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
    project, users, isExpanded, isSelected, showArchived,
    onToggleExpand, onToggleSelection, onEditProject, onDeleteProject, onArchiveProject, onUpdateProjectStatus, onViewHistory, onToggleFavorite,
    onAddTask, onEditTask, onDeleteTask, onUpdateTaskField, onGenerateRoadmap, loadingRoadmap
}) => {
    const [showContext, setShowContext] = useState(false);

    // Calculations
    const progress = project.tasks.length > 0 
        ? (project.tasks.filter(t => t.status === TaskStatus.DONE).reduce((sum, t) => sum + (t.weight || 1), 0) / project.tasks.reduce((sum, t) => sum + (t.weight || 1), 0)) * 100 
        : 0;

    const blockedTasks = project.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
    const isOverdue = new Date() > new Date(project.deadline) && project.status !== ProjectStatus.DONE;
    
    let healthColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
    let healthLabel = 'On Track';
    if (isOverdue || blockedTasks > 2) {
        healthColor = 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
        healthLabel = 'Off Track';
    } else if (blockedTasks > 0) {
        healthColor = 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
        healthLabel = 'At Risk';
    }

    const sortedTasks = [...project.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
    const hasContext = project.additionalDescriptions && project.additionalDescriptions.some(d => d.trim().length > 0);

    // Style for favorite projects
    const favoriteStyle = project.isFavorite 
        ? 'border-amber-400 ring-1 ring-amber-400/50 bg-amber-50/30 dark:bg-amber-900/10' 
        : isExpanded ? 'border-indigo-200 dark:border-indigo-500/30 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';

    const getStatusColor = (status: TaskStatus | ProjectStatus) => {
        switch (status) {
          case ProjectStatus.DONE:
          case TaskStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
          case ProjectStatus.ACTIVE:
          case TaskStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
          case TaskStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
          case ProjectStatus.PAUSED: return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
          case ProjectStatus.PLANNING: return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
          default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
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

    const getPriorityColor = (priority: TaskPriority) => {
        switch(priority) {
            case TaskPriority.URGENT: return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
            case TaskPriority.HIGH: return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
            case TaskPriority.MEDIUM: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
            case TaskPriority.LOW: return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
        }
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${favoriteStyle}`}>
            {/* Header */}
            <div className={`p-6 ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                <div className="flex flex-col md:flex-row gap-6 md:items-center">
                    <div className="flex items-center">
                        <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelection(project.id)}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>

                    <div className="flex-1 cursor-pointer" onClick={() => onToggleExpand(project.id)}>
                        <div className="flex items-center gap-3 mb-2">
                            {/* Favorite Star */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                                className="focus:outline-none"
                                title="Toggle Favorite"
                            >
                                <Star className={`w-5 h-5 ${project.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'} transition-colors`} />
                            </button>

                            {project.isImportant && (
                                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" fill="currentColor" fillOpacity={0.2} />
                            )}
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                                {project.name}
                                {project.createdByBot && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-200 dark:border-emerald-800" title="Created by PRJ Bot">
                                        <Cpu className="w-3 h-3" />
                                        BOT
                                    </span>
                                )}
                            </h3>
                            
                            <div onClick={(e) => e.stopPropagation()}>
                                <select 
                                    value={project.status}
                                    onChange={(e) => onUpdateProjectStatus(project.id, e.target.value as ProjectStatus)}
                                    disabled={project.isArchived}
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer appearance-none ${getStatusColor(project.status)} disabled:opacity-70 disabled:cursor-not-allowed`}
                                >
                                    {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${healthColor}`}>
                                {healthLabel}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{project.description}</p>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                            {project.owner && (
                                <span className="flex items-center text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800" title="Product Owner">
                                    <Crown className="w-3 h-3 mr-1" /> {project.owner}
                                </span>
                            )}
                            {project.architect && (
                                <span className="flex items-center text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800" title="Architect">
                                    <PenTool className="w-3 h-3 mr-1" /> {project.architect}
                                </span>
                            )}
                            {project.externalDependencies && project.externalDependencies.length > 0 && (
                                <>
                                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                    {project.externalDependencies.map(dep => (
                                        <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                            <span className={`w-2 h-2 rounded-full mr-1.5 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{dep.label}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col items-end min-w-[100px]">
                            <span className="text-xs uppercase font-semibold text-slate-400 mb-1">Timeline</span>
                            <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                {project.deadline}
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-end w-32">
                            <div className="flex justify-between w-full mb-1">
                                <span className="text-xs font-semibold">Weighted Progress</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); onViewHistory(); }} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="View Audit Log">
                                <History className="w-4 h-4" />
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <Pencil className="w-4 h-4" />
                            </button>

                            {isExpanded && (
                                <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}

                            {isExpanded && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onArchiveProject(project.id, project.isArchived || false);
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${project.isArchived 
                                        ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    title={project.isArchived ? "Restore to Live" : "Archive (Complete)"}
                                >
                                    {project.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                </button>
                            )}
                        </div>

                        <div onClick={() => onToggleExpand(project.id)} className="cursor-pointer">
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 p-6">
                    
                    {/* Documentation Links Section */}
                    {project.docUrls && project.docUrls.length > 0 && (
                        <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                <Globe className="w-4 h-4" /> Documentation & Resources
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {project.docUrls.map((url, i) => (
                                    <a 
                                        key={i} 
                                        href={url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                                    >
                                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-md text-indigo-600 dark:text-indigo-400">
                                            <Link2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm text-indigo-600 dark:text-indigo-400 truncate flex-1 group-hover:underline">
                                            {url.replace(/(^\w+:|^)\/\//, '').split('/')[0]}
                                        </span>
                                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Context Toggle */}
                    {hasContext && (
                        <div className="mb-6">
                            <button onClick={() => setShowContext(!showContext)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:underline mb-2">
                                {showContext ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                {showContext ? 'Hide AI Context' : 'Show AI Context'}
                            </button>
                            {showContext && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                                    {project.additionalDescriptions?.map((desc, i) => (
                                        desc.trim() && (
                                            <div key={i} className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                <span className="text-[10px] uppercase font-bold text-indigo-400 mb-1 block">Context Layer {i+1}</span>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{desc}</p>
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Task Toolbar */}
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                            Tasks ({project.tasks.length})
                            <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 font-normal normal-case flex items-center">
                                <ArrowUpAz className="w-3 h-3 mr-1" /> Sorted by Order
                            </span>
                        </h4>
                        <div className="flex gap-2">
                            <button onClick={() => onGenerateRoadmap(project)} className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-md transition-colors" disabled={loadingRoadmap}>
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Booklet
                            </button>
                            {!project.isArchived && (
                                <button onClick={() => onAddTask(project.id)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md transition-colors">
                                    <Plus className="w-4 h-4 mr-1" /> Add Task
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Task Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-3 w-16 text-center">#</th>
                                    <th className="px-6 py-3">Task Name</th>
                                    <th className="px-6 py-3 w-32">Status (Click)</th>
                                    <th className="px-6 py-3 w-32">Priority</th>
                                    <th className="px-6 py-3 w-20">Cost (MD)</th>
                                    <th className="px-6 py-3 w-24">Weight</th>
                                    <th className="px-6 py-3 w-40">Assignee</th>
                                    <th className="px-6 py-3 w-20 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedTasks.map(task => {
                                    const assigneeUser = users.find(u => u.id === task.assigneeId);
                                    const isExternalAssignee = task.assigneeId && !assigneeUser;
                                    const taskOverdue = task.eta && new Date(task.eta).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== TaskStatus.DONE;
                                    const checklistDone = task.checklist ? task.checklist.filter(i => i.done).length : 0;
                                    const checklistTotal = task.checklist ? task.checklist.length : 0;
                                    const actionsDone = task.actions ? task.actions.filter(a => a.status === 'Done').length : 0;
                                    const actionsTotal = task.actions ? task.actions.length : 0;

                                    return (
                                        <tr key={task.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${task.isImportant ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-6 py-4 text-center font-mono text-slate-400 text-xs">{task.order}</td>
                                            <td className="px-6 py-4 relative">
                                                {task.isImportant && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                                <div className="flex items-center gap-2">
                                                    {task.isImportant && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                    <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{task.description}</div>
                                                
                                                {/* Actions Progress Bar */}
                                                {actionsTotal > 0 && (
                                                    <div className="mt-2 flex items-center gap-2 w-full max-w-[200px]">
                                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                            {task.actions?.map((action, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`h-full flex-1 ${action.status === 'Done' ? 'bg-emerald-500' : action.status === 'Blocked' ? 'bg-red-500' : action.status === 'Ongoing' ? 'bg-blue-500' : 'bg-transparent'}`}
                                                                    style={{ borderRight: idx !== actionsTotal - 1 ? '1px solid white' : 'none' }}
                                                                ></div>
                                                            ))}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400">{actionsDone}/{actionsTotal}</span>
                                                    </div>
                                                )}

                                                {/* Task Dependencies */}
                                                {task.externalDependencies && task.externalDependencies.length > 0 && (
                                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                                        {task.externalDependencies.map(dep => (
                                                            <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                                                <span className="text-slate-600 dark:text-slate-300">{dep.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {task.eta && (
                                                        <div className={`flex items-center text-xs ${taskOverdue ? 'text-red-600 font-bold bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                                                            {taskOverdue && <AlertCircle className="w-3 h-3 mr-1" />}
                                                            <Calendar className="w-3 h-3 mr-1" /> {task.eta}
                                                        </div>
                                                    )}
                                                    {checklistTotal > 0 && (
                                                        <div className="flex items-center text-xs text-slate-400" title={`${checklistDone}/${checklistTotal} items completed`}>
                                                            <ListTodo className="w-3 h-3 mr-1" /> {checklistDone}/{checklistTotal}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={task.status}
                                                    onChange={(e) => onUpdateTaskField(project.id, task.id, 'status', e.target.value)}
                                                    className={`text-xs font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full appearance-none ${getStatusColor(task.status).replace('border', 'ring')}`}
                                                >
                                                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                    <Flag className="w-3 h-3 mr-1" /> {task.priority}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-600 dark:text-slate-400 text-xs font-mono">
                                                    {task.cost ? <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" />{task.cost}</span> : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs font-mono font-bold">
                                                    <Scale className="w-3 h-3 mr-1.5" /> {task.weight || 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {assigneeUser ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">{assigneeUser.firstName[0]}</div>
                                                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{assigneeUser.firstName}</span>
                                                        </>
                                                    ) : isExternalAssignee ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400"><UserPlus className="w-3 h-3" /></div>
                                                            <span className="text-indigo-600 dark:text-indigo-300 truncate max-w-[100px] text-xs font-medium">{task.assigneeId}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 italic flex items-center"><UserCircle2 className="w-4 h-4 mr-1"/> Unassigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => onEditTask(project.id, task)} className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => onDeleteTask(project.id, task.id)} className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {project.tasks.length === 0 && (
                                    <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No tasks created yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectCard;
