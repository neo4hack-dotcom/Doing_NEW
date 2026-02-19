
import React, { useState, useMemo } from 'react';
import { User, Team, Meeting, WorkingGroup, TaskStatus, ActionItemStatus, ProjectStatus, TaskPriority } from '../types';
import { CheckCircle2, Circle, AlertCircle, Clock, Briefcase, Users, Calendar, Search, Filter, ArrowUpRight, CheckSquare, LayoutList } from 'lucide-react';

interface MyActionsProps {
    currentUser: User | null;
    teams: Team[];
    meetings: Meeting[];
    groups: WorkingGroup[];
    onUpdateTeam: (team: Team) => void;
    onUpdateMeeting: (meeting: Meeting) => void;
    onUpdateGroup: (group: WorkingGroup) => void;
}

type SourceType = 'PROJECT' | 'MEETING' | 'WORKING_GROUP';

interface UnifiedAction {
    id: string;
    uniqueKey: string; // unique key for react list
    type: SourceType;
    title: string;
    description?: string;
    status: string; // Normalized status
    dueDate?: string;
    priority?: TaskPriority; // Only for tasks usually, but we can map others
    sourceName: string; // Project Name, Meeting Title, or WG Title
    contextInfo?: string; // Team Name, etc.
    
    // References for updates
    originalObject: any;
    parentId: string; // ProjectID, MeetingID, GroupID
    containerId: string; // TeamID, (same as parent for meeting), GroupID
    subId?: string; // SessionID for WG
}

const MyActions: React.FC<MyActionsProps> = ({ currentUser, teams, meetings, groups, onUpdateTeam, onUpdateMeeting, onUpdateGroup }) => {
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'TODO' | 'DONE'>('TODO');
    const [searchTerm, setSearchTerm] = useState('');

    // --- DATA AGGREGATION ---
    const allActions = useMemo(() => {
        if (!currentUser) return [];
        const actions: UnifiedAction[] = [];

        // 1. PROJECT TASKS
        teams.forEach(team => {
            team.projects.forEach(project => {
                if (project.isArchived) return; // Skip archived
                project.tasks.forEach(task => {
                    if (task.assigneeId === currentUser.id) {
                        actions.push({
                            id: task.id,
                            uniqueKey: `proj-${task.id}`,
                            type: 'PROJECT',
                            title: task.title,
                            description: task.description,
                            status: task.status,
                            dueDate: task.eta,
                            priority: task.priority,
                            sourceName: project.name,
                            contextInfo: `Project • ${team.name}`,
                            originalObject: task,
                            parentId: project.id,
                            containerId: team.id
                        });
                    }
                });
            });
        });

        // 2. MEETING ACTIONS
        meetings.forEach(meeting => {
            meeting.actionItems.forEach((item, idx) => {
                if (item.ownerId === currentUser.id) {
                    actions.push({
                        id: item.id,
                        uniqueKey: `meet-${item.id}`,
                        type: 'MEETING',
                        title: item.description,
                        status: item.status,
                        dueDate: item.dueDate,
                        priority: item.priority,
                        sourceName: meeting.title,
                        contextInfo: `Meeting • ${meeting.date}`,
                        originalObject: item,
                        parentId: meeting.id,
                        containerId: meeting.id // Meeting is its own container in update logic usually
                    });
                }
            });
        });

        // 3. WORKING GROUP ACTIONS
        groups.forEach(group => {
            if (group.archived) return;
            group.sessions.forEach(session => {
                session.actionItems.forEach((item, idx) => {
                    if (item.ownerId === currentUser.id) {
                        actions.push({
                            id: item.id,
                            uniqueKey: `wg-${item.id}`,
                            type: 'WORKING_GROUP',
                            title: item.description,
                            status: item.status,
                            dueDate: item.dueDate,
                            priority: item.priority,
                            sourceName: group.title,
                            contextInfo: `WG Session • ${session.date}`,
                            originalObject: item,
                            parentId: group.id,
                            containerId: group.id,
                            subId: session.id
                        });
                    }
                });
            });
        });

        // Sort by Date (Overdue first, then soonest)
        return actions.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

    }, [teams, meetings, groups, currentUser]);

    // --- FILTERING ---
    const filteredActions = allActions.filter(action => {
        // Status Filter
        if (filterStatus === 'TODO') {
            const isDone = action.status === TaskStatus.DONE || action.status === ActionItemStatus.DONE;
            if (isDone) return false;
        }
        if (filterStatus === 'DONE') {
            const isDone = action.status === TaskStatus.DONE || action.status === ActionItemStatus.DONE;
            if (!isDone) return false;
        }

        // Search Filter
        const searchContent = (action.title + action.sourceName + (action.description || '')).toLowerCase();
        if (searchTerm && !searchContent.includes(searchTerm.toLowerCase())) return false;

        return true;
    });

    // --- UPDATERS ---

    const handleStatusUpdate = (action: UnifiedAction, newStatus: string) => {
        // 1. PROJECT TASK UPDATE
        if (action.type === 'PROJECT') {
            const team = teams.find(t => t.id === action.containerId);
            if (!team) return;
            const updatedProjects = team.projects.map(p => {
                if (p.id === action.parentId) {
                    const updatedTasks = p.tasks.map(t => 
                        t.id === action.id ? { ...t, status: newStatus as TaskStatus } : t
                    );
                    return { ...p, tasks: updatedTasks };
                }
                return p;
            });
            onUpdateTeam({ ...team, projects: updatedProjects });
        }

        // 2. MEETING ACTION UPDATE
        if (action.type === 'MEETING') {
            const meeting = meetings.find(m => m.id === action.parentId);
            if (!meeting) return;
            const updatedItems = meeting.actionItems.map(ai => 
                ai.id === action.id ? { ...ai, status: newStatus as ActionItemStatus } : ai
            );
            onUpdateMeeting({ ...meeting, actionItems: updatedItems });
        }

        // 3. WORKING GROUP UPDATE
        if (action.type === 'WORKING_GROUP') {
            const group = groups.find(g => g.id === action.containerId);
            if (!group) return;
            const updatedSessions = group.sessions.map(s => {
                if (s.id === action.subId) {
                    const updatedItems = s.actionItems.map(ai => 
                        ai.id === action.id ? { ...ai, status: newStatus as ActionItemStatus } : ai
                    );
                    return { ...s, actionItems: updatedItems };
                }
                return s;
            });
            onUpdateGroup({ ...group, sessions: updatedSessions });
        }
    };

    // --- RENDER HELPERS ---

    const getSourceIcon = (type: SourceType) => {
        switch (type) {
            case 'PROJECT': return <Briefcase className="w-4 h-4 text-blue-500" />;
            case 'MEETING': return <Users className="w-4 h-4 text-purple-500" />;
            case 'WORKING_GROUP': return <LayoutList className="w-4 h-4 text-orange-500" />;
        }
    };

    const isOverdue = (dateStr?: string) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date() && new Date(dateStr).toDateString() !== new Date().toDateString();
    };

    const getStatusOptions = (type: SourceType) => {
        if (type === 'PROJECT') return Object.values(TaskStatus);
        return Object.values(ActionItemStatus);
    };

    const getStatusColor = (status: string) => {
        if (status === 'Done' || status === 'Done') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'Blocked') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        if (status === 'In Progress' || status === 'Ongoing') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    };

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckSquare className="w-6 h-6 text-indigo-500" />
                        My Actions
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Consolidated view of all your tasks across the platform.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 flex shadow-sm">
                        <button 
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterStatus === 'ALL' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            All
                        </button>
                        <button 
                            onClick={() => setFilterStatus('TODO')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterStatus === 'TODO' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            Active
                        </button>
                        <button 
                            onClick={() => setFilterStatus('DONE')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterStatus === 'DONE' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            Completed
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search tasks by title, project or context..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    />
                </div>
                <div className="text-xs text-slate-500 font-medium">
                    Showing {filteredActions.length} items
                </div>
            </div>

            {/* Action List */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {filteredActions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <CheckSquare className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No actions found.</p>
                        <p className="text-sm">You're all caught up!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredActions.map(action => (
                            <div key={action.uniqueKey} className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex flex-col md:flex-row gap-4 group">
                                {/* Status Control */}
                                <div className="flex items-start pt-1">
                                    <select
                                        value={action.status}
                                        onChange={(e) => handleStatusUpdate(action, e.target.value)}
                                        className={`appearance-none cursor-pointer w-4 h-4 rounded border flex items-center justify-center text-[0px] focus:ring-2 focus:ring-indigo-500 outline-none
                                            ${(action.status === 'Done' || action.status === 'Done') 
                                                ? 'bg-emerald-500 border-emerald-500' 
                                                : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500'
                                            }`}
                                        style={{backgroundImage: 'none'}} // remove default arrow
                                    >
                                        {getStatusOptions(action.type).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`text-sm font-bold truncate ${(action.status === 'Done' || action.status === 'Done') ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                            {action.title}
                                        </h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusColor(action.status)}`}>
                                            {action.status}
                                        </span>
                                        {action.priority && action.priority !== TaskPriority.MEDIUM && (
                                            <span className={`text-[10px] font-bold ${action.priority === TaskPriority.URGENT ? 'text-red-500' : 'text-orange-500'}`}>
                                                {action.priority}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300" title={action.type}>
                                            {getSourceIcon(action.type)}
                                            {action.sourceName}
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-600">|</span>
                                        <span className="truncate max-w-[200px]">{action.contextInfo}</span>
                                    </div>
                                </div>

                                {/* Meta & Actions */}
                                <div className="flex items-center gap-4 text-sm min-w-[150px] justify-end">
                                    {action.dueDate ? (
                                        <div className={`flex items-center gap-1.5 ${isOverdue(action.dueDate) && action.status !== 'Done' ? 'text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded' : 'text-slate-500'}`}>
                                            {isOverdue(action.dueDate) && action.status !== 'Done' ? <AlertCircle className="w-4 h-4"/> : <Calendar className="w-4 h-4" />}
                                            {action.dueDate}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 dark:text-slate-600 text-xs italic">No Date</span>
                                    )}
                                    
                                    {/* Action dropdown for status change (Better UX than checkbox for multiple states) */}
                                    <div className="relative">
                                        <select 
                                            value={action.status}
                                            onChange={(e) => handleStatusUpdate(action, e.target.value)}
                                            className="bg-transparent text-xs font-medium text-indigo-600 dark:text-indigo-400 border-none outline-none focus:ring-0 cursor-pointer text-right"
                                        >
                                            {getStatusOptions(action.type).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyActions;
