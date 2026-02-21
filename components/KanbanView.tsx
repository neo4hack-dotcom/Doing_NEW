
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    Kanban as KanbanIcon, Sparkles, RefreshCw, X, ChevronLeft, ChevronRight,
    Bot, Zap, AlertTriangle, CheckCircle2, Clock, Pause, LayoutGrid,
    Users, Calendar, Flag, Star, Archive, ExternalLink, Brain, ArrowRight
} from 'lucide-react';
import { Team, Project, ProjectStatus, User, LLMConfig, UserRole } from '../types';
import { generateProjectCard } from '../services/llmService';
import FormattedText from './FormattedText';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KanbanViewProps {
    teams: Team[];
    currentUser: User | null;
    users: User[];
    llmConfig?: LLMConfig;
    onUpdateTeam: (team: Team) => void;
    allTeams: Team[];   // Full unfiltered teams for write-back
}

interface DragState {
    projectId: string;
    fromTeamId: string;
    fromStatus: ProjectStatus;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES: { value: ProjectStatus; label: string; icon: React.ReactNode; color: string; bg: string; border: string; dot: string }[] = [
    {
        value: ProjectStatus.PLANNING,
        label: 'Planning',
        icon: <Clock className="w-4 h-4" />,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-400'
    },
    {
        value: ProjectStatus.ACTIVE,
        label: 'Active',
        icon: <Zap className="w-4 h-4" />,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-400'
    },
    {
        value: ProjectStatus.PAUSED,
        label: 'Paused',
        icon: <Pause className="w-4 h-4" />,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-400'
    },
    {
        value: ProjectStatus.DONE,
        label: 'Done',
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: 'text-slate-500 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-800',
        border: 'border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400'
    },
];

// ── Project Card ─────────────────────────────────────────────────────────────

interface ProjectKanbanCardProps {
    project: Project;
    users: User[];
    onDragStart: (e: React.DragEvent, projectId: string, teamId: string, status: ProjectStatus) => void;
    onClick: () => void;
}

const ProjectKanbanCard: React.FC<ProjectKanbanCardProps> = ({ project, users, onDragStart, onClick }) => {
    const manager = users.find(u => u.id === project.managerId);
    const totalTasks = project.tasks.length;
    const doneTasks = project.tasks.filter(t => t.status === 'Done').length;
    const blockedTasks = project.tasks.filter(t => t.status === 'Blocked').length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.status !== ProjectStatus.DONE;

    const statusCfg = STATUSES.find(s => s.value === project.status) || STATUSES[1];

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, project.id, '', project.status)}
            onClick={onClick}
            className={`group relative bg-white dark:bg-slate-800 rounded-xl border-2 ${
                project.isImportant
                    ? 'border-amber-300 dark:border-amber-700'
                    : 'border-slate-200 dark:border-slate-700'
            } shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-indigo-300 dark:hover:border-indigo-600 select-none`}
        >
            {/* Top accent bar */}
            <div className={`h-1 rounded-t-[10px] ${statusCfg.dot}`} />

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            {project.isImportant && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                                {project.name}
                            </h4>
                        </div>
                        {project.description && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                                {project.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {totalTasks > 0 && (
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{doneTasks}/{totalTasks} tasks</span>
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    progress === 100 ? 'bg-emerald-500' :
                                    progress > 50 ? 'bg-indigo-500' :
                                    progress > 25 ? 'bg-amber-500' : 'bg-slate-400'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        {blockedTasks > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="w-2.5 h-2.5" /> {blockedTasks} blocked
                            </span>
                        )}
                        {project.deadline && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                isOverdue
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                                <Calendar className="w-2.5 h-2.5" />
                                {project.deadline}
                            </span>
                        )}
                    </div>
                    {manager && (
                        <div className="flex items-center gap-1" title={`${manager.firstName} ${manager.lastName}`}>
                            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                                {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Drag handle hint */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="grid grid-cols-2 gap-0.5 w-3">
                    {[...Array(6)].map((_, i) => <div key={i} className="w-0.5 h-0.5 bg-slate-400 rounded-full" />)}
                </div>
            </div>
        </div>
    );
};

// ── Drop Column ───────────────────────────────────────────────────────────────

interface DropColumnProps {
    status: typeof STATUSES[0];
    projects: Project[];
    teamId: string;
    users: User[];
    isDragOver: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, targetStatus: ProjectStatus, targetTeamId: string) => void;
    onDragStart: (e: React.DragEvent, projectId: string, teamId: string, status: ProjectStatus) => void;
    onCardClick: (project: Project) => void;
}

const DropColumn: React.FC<DropColumnProps> = ({
    status, projects, teamId, users, isDragOver,
    onDragOver, onDragLeave, onDrop, onDragStart, onCardClick
}) => {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, status.value, teamId)}
            className={`flex flex-col min-h-[200px] rounded-2xl border-2 transition-all duration-150 ${
                isDragOver
                    ? `${status.border} ${status.bg} scale-[1.01] shadow-lg`
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
        >
            {/* Column header */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border-b ${status.border}`}>
                <div className={`flex items-center gap-2 ${status.color}`}>
                    {status.icon}
                    <span className="text-sm font-bold">{status.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.color} border ${status.border}`}>
                    {projects.length}
                </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-3">
                {projects.map(project => (
                    <ProjectKanbanCard
                        key={project.id}
                        project={project}
                        users={users}
                        onDragStart={(e, pId, _, pStatus) => onDragStart(e, pId, teamId, pStatus)}
                        onClick={() => onCardClick(project)}
                    />
                ))}
                {projects.length === 0 && (
                    <div className={`flex items-center justify-center h-20 rounded-xl border-2 border-dashed ${
                        isDragOver ? status.border : 'border-slate-200 dark:border-slate-700'
                    } transition-colors`}>
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                            {isDragOver ? 'Drop here' : 'No projects'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Project Detail Drawer ─────────────────────────────────────────────────────

interface ProjectDetailDrawerProps {
    project: Project | null;
    team: Team | null;
    users: User[];
    llmConfig?: LLMConfig;
    onClose: () => void;
}

const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({ project, team, users, llmConfig, onClose }) => {
    const [aiResult, setAiResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!project || !llmConfig) return;
        setIsGenerating(true);
        setAiResult('');
        try {
            const result = await generateProjectCard([project], users, llmConfig);
            setAiResult(result);
        } catch (e: any) {
            setAiResult(`Error: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!project) return null;

    const manager = users.find(u => u.id === project.managerId);
    const totalTasks = project.tasks.length;
    const doneTasks = project.tasks.filter(t => t.status === 'Done').length;
    const blockedTasks = project.tasks.filter(t => t.status === 'Blocked').length;
    const statusCfg = STATUSES.find(s => s.value === project.status) || STATUSES[1];

    return (
        <div className="fixed inset-0 z-50 flex" onClick={onClose}>
            {/* Backdrop */}
            <div className="flex-1 bg-black/40 backdrop-blur-sm" />

            {/* Drawer */}
            <div
                className="w-full max-w-md bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}>
                                    {statusCfg.icon} {statusCfg.label}
                                </span>
                                {project.isImportant && <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800"><Star className="w-3 h-3 fill-amber-400" /> Important</span>}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{project.name}</h3>
                            {team && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{team.name}</p>}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex-shrink-0 mt-1 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-5">
                    {/* Description */}
                    {project.description && (
                        <div>
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Description</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{project.description}</p>
                        </div>
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Total Tasks', value: totalTasks, color: 'text-slate-700 dark:text-slate-200' },
                            { label: 'Completed', value: doneTasks, color: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Blocked', value: blockedTasks, color: blockedTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Meta */}
                    <div className="space-y-2">
                        {manager && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="font-medium">Manager:</span>
                                <span>{manager.firstName} {manager.lastName}</span>
                            </div>
                        )}
                        {project.deadline && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="font-medium">Deadline:</span>
                                <span className={new Date(project.deadline) < new Date() && project.status !== ProjectStatus.DONE ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{project.deadline}</span>
                            </div>
                        )}
                    </div>

                    {/* Tasks list */}
                    {project.tasks.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Tasks</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {project.tasks.slice(0, 10).map(task => (
                                    <div key={task.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                            task.status === 'Done' ? 'bg-emerald-500' :
                                            task.status === 'Blocked' ? 'bg-red-500' :
                                            task.status === 'In Progress' ? 'bg-blue-500' :
                                            'bg-slate-300 dark:bg-slate-600'
                                        }`} />
                                        <span className={`text-xs flex-1 truncate ${task.status === 'Done' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{task.title}</span>
                                        {task.eta && <span className="text-[10px] text-slate-400 flex-shrink-0">{task.eta}</span>}
                                    </div>
                                ))}
                                {project.tasks.length > 10 && (
                                    <p className="text-xs text-slate-400 italic text-center">+{project.tasks.length - 10} more tasks</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI Analysis */}
                    {llmConfig && (
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
                            >
                                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                {isGenerating ? 'Analyzing…' : 'AI Project Analysis'}
                            </button>

                            {aiResult && (
                                <div className="mt-4 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles className="w-4 h-4 text-violet-500" />
                                        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">AI Analysis</span>
                                    </div>
                                    <FormattedText text={aiResult} className="text-xs" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── AI Team Insight Modal ─────────────────────────────────────────────────────

interface AITeamInsightProps {
    isOpen: boolean;
    onClose: () => void;
    result: string;
    isLoading: boolean;
}

const AITeamInsightPanel: React.FC<AITeamInsightProps> = ({ isOpen, onClose, result, isLoading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Kanban Insight</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Portfolio analysis for this team</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <RefreshCw className="w-7 h-7 text-white animate-spin" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Generating AI analysis…</p>
                        </div>
                    ) : (
                        <FormattedText text={result} />
                    )}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={onClose} className="w-full py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main KanbanView ───────────────────────────────────────────────────────────

const KanbanView: React.FC<KanbanViewProps> = ({
    teams, currentUser, users, llmConfig, onUpdateTeam, allTeams
}) => {
    const [activeTeamIdx, setActiveTeamIdx] = useState(0);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragOverKey, setDragOverKey] = useState<string | null>(null); // "teamId-status"
    const [selectedProject, setSelectedProject] = useState<{ project: Project; team: Team } | null>(null);
    const [aiInsightOpen, setAiInsightOpen] = useState(false);
    const [aiInsightResult, setAiInsightResult] = useState('');
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    const teamNavRef = useRef<HTMLDivElement>(null);

    // Only non-archived teams with at least some access
    const visibleTeams = useMemo(() =>
        teams.filter(t => t.projects.some(p => !p.isArchived)),
        [teams]
    );

    const activeTeam = visibleTeams[activeTeamIdx] || visibleTeams[0];

    // Get active (non-archived) projects for the active team
    const activeProjects = useMemo(() =>
        (activeTeam?.projects || []).filter(p => !p.isArchived),
        [activeTeam]
    );

    // Project count summary per team
    const teamSummary = useCallback((team: Team) => {
        const active = team.projects.filter(p => !p.isArchived && p.status === ProjectStatus.ACTIVE).length;
        const blocked = team.projects.filter(p => !p.isArchived && p.tasks.some(t => t.status === 'Blocked')).length;
        return { active, blocked };
    }, []);

    // ── Drag & Drop ────────────────────────────────────────────────────────────

    const handleDragStart = useCallback((
        e: React.DragEvent, projectId: string, teamId: string, status: ProjectStatus
    ) => {
        setDragState({ projectId, fromTeamId: activeTeam?.id || teamId, fromStatus: status });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', projectId);
    }, [activeTeam]);

    const handleDragOver = useCallback((e: React.DragEvent, status: ProjectStatus, teamId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverKey(`${teamId}-${status}`);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverKey(null);
    }, []);

    const handleDrop = useCallback((
        e: React.DragEvent, targetStatus: ProjectStatus, targetTeamId: string
    ) => {
        e.preventDefault();
        setDragOverKey(null);

        if (!dragState) return;
        if (dragState.fromStatus === targetStatus) {
            setDragState(null);
            return;
        }

        const teamId = activeTeam?.id;
        if (!teamId) return;

        // Find the full team in allTeams to perform the update
        const fullTeam = allTeams.find(t => t.id === teamId);
        if (!fullTeam) return;

        const updatedProjects = fullTeam.projects.map(p =>
            p.id === dragState.projectId
                ? { ...p, status: targetStatus }
                : p
        );

        onUpdateTeam({ ...fullTeam, projects: updatedProjects });
        setDragState(null);
    }, [dragState, activeTeam, allTeams, onUpdateTeam]);

    const handleDragEnd = useCallback(() => {
        setDragState(null);
        setDragOverKey(null);
    }, []);

    // ── AI Insight ─────────────────────────────────────────────────────────────

    const handleGenerateInsight = async () => {
        if (!llmConfig || !activeTeam) return;
        setAiInsightOpen(true);
        setIsGeneratingInsight(true);
        setAiInsightResult('');
        try {
            const activePs = activeTeam.projects.filter(p => !p.isArchived);
            const result = await generateProjectCard(activePs, users, llmConfig);
            setAiInsightResult(result);
        } catch (e: any) {
            setAiInsightResult(`Error: ${e.message}`);
        } finally {
            setIsGeneratingInsight(false);
        }
    };

    // ── Scroll team nav ────────────────────────────────────────────────────────

    const scrollNav = (dir: 'left' | 'right') => {
        if (teamNavRef.current) {
            teamNavRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
        }
    };

    if (visibleTeams.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <KanbanIcon className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-center">
                    <p className="text-slate-600 dark:text-slate-300 font-medium">No projects accessible</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Projects you have access to will appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 min-h-0">

            {/* AI Insight Modal */}
            <AITeamInsightPanel
                isOpen={aiInsightOpen}
                onClose={() => setAiInsightOpen(false)}
                result={aiInsightResult}
                isLoading={isGeneratingInsight}
            />

            {/* Project Detail Drawer */}
            {selectedProject && (
                <ProjectDetailDrawer
                    project={selectedProject.project}
                    team={selectedProject.team}
                    users={users}
                    llmConfig={llmConfig}
                    onClose={() => setSelectedProject(null)}
                />
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
                            <LayoutGrid className="w-5 h-5 text-white" />
                        </div>
                        Kanban Board
                    </h1>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 ml-12">
                        Drag &amp; drop projects between stages · changes sync instantly to Projects &amp; Tasks
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {llmConfig && (
                        <button
                            onClick={handleGenerateInsight}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all"
                        >
                            <Sparkles className="w-4 h-4" />
                            AI Insight
                        </button>
                    )}
                </div>
            </div>

            {/* Team Navigation */}
            <div className="relative">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => scrollNav('left')}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div
                        ref={teamNavRef}
                        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {visibleTeams.map((team, idx) => {
                            const summary = teamSummary(team);
                            const isActive = idx === activeTeamIdx;
                            return (
                                <button
                                    key={team.id}
                                    onClick={() => setActiveTeamIdx(idx)}
                                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                                        isActive
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-md'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <Users className="w-4 h-4" />
                                    {team.name}
                                    <div className="flex items-center gap-1 ml-1">
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                            isActive ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {team.projects.filter(p => !p.isArchived).length}
                                        </span>
                                        {summary.blocked > 0 && (
                                            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                ⚠ {summary.blocked}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => scrollNav('right')}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Team stats bar */}
            {activeTeam && (
                <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{activeTeam.name}</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                    {STATUSES.map(s => {
                        const count = activeProjects.filter(p => p.status === s.value).length;
                        return (
                            <div key={s.value} className={`flex items-center gap-1.5 text-xs font-semibold ${s.color}`}>
                                {s.icon}
                                <span>{count} {s.label}</span>
                            </div>
                        );
                    })}
                    <div className="ml-auto text-xs text-slate-400 dark:text-slate-500 italic">
                        {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''} · drag to move
                    </div>
                </div>
            )}

            {/* Kanban Board */}
            {activeTeam && (
                <div
                    className="grid grid-cols-4 gap-4 min-h-[400px]"
                    onDragEnd={handleDragEnd}
                >
                    {STATUSES.map(status => {
                        const colProjects = activeProjects.filter(p => p.status === status.value);
                        const dropKey = `${activeTeam.id}-${status.value}`;
                        return (
                            <DropColumn
                                key={status.value}
                                status={status}
                                projects={colProjects}
                                teamId={activeTeam.id}
                                users={users}
                                isDragOver={dragOverKey === dropKey && dragState !== null}
                                onDragOver={(e) => handleDragOver(e, status.value, activeTeam.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onDragStart={(e, pId, tId, pStatus) => handleDragStart(e, pId, tId, pStatus)}
                                onCardClick={(project) => setSelectedProject({ project, team: activeTeam })}
                            />
                        );
                    })}
                </div>
            )}

            {/* Quick tips */}
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-600 dark:text-indigo-400 flex-wrap">
                <span className="flex items-center gap-1.5 font-semibold"><Zap className="w-3.5 h-3.5" /> Tips:</span>
                <span>Drag a card to change project status</span>
                <span className="text-indigo-300">·</span>
                <span>Click a card to view details &amp; AI analysis</span>
                <span className="text-indigo-300">·</span>
                <span>Changes instantly sync to Projects &amp; Tasks</span>
                {llmConfig && <><span className="text-indigo-300">·</span><span>Use <strong>AI Insight</strong> for team portfolio analysis</span></>}
            </div>
        </div>
    );
};

export default KanbanView;
