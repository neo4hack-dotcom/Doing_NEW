
import React from 'react';
import { Team, Project, TaskStatus, ProjectStatus } from '../../types';
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface StaleProjectTrackerProps {
    teams: Team[];
}

interface FlaggedProject {
    project: Project;
    teamName: string;
    isStale: boolean;
    isUrgent: boolean;
    daysSinceUpdate: number | null;
    daysUntilDeadline: number | null;
}

const StaleProjectTracker: React.FC<StaleProjectTrackerProps> = ({ teams }) => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const flaggedProjects: FlaggedProject[] = [];

    teams.forEach(team => {
        team.projects
            .filter(p => !p.isArchived && p.status !== ProjectStatus.DONE)
            .forEach(project => {
                // Check for stale: no auditLog entry in last 2 weeks
                let lastUpdateDate: Date | null = null;
                if (project.auditLog && project.auditLog.length > 0) {
                    const sorted = [...project.auditLog].sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    lastUpdateDate = new Date(sorted[0].date);
                }
                const isStale = !lastUpdateDate || lastUpdateDate < twoWeeksAgo;
                const daysSinceUpdate = lastUpdateDate
                    ? Math.floor((now.getTime() - lastUpdateDate.getTime()) / (24 * 60 * 60 * 1000))
                    : null;

                // Check for urgent: deadline within next 7 days
                let daysUntilDeadline: number | null = null;
                let isUrgent = false;
                if (project.deadline) {
                    const deadline = new Date(project.deadline);
                    if (!isNaN(deadline.getTime())) {
                        daysUntilDeadline = Math.floor(
                            (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
                        );
                        isUrgent = deadline <= oneWeekFromNow;
                    }
                }

                if (isStale || isUrgent) {
                    flaggedProjects.push({
                        project,
                        teamName: team.name,
                        isStale,
                        isUrgent,
                        daysSinceUpdate,
                        daysUntilDeadline,
                    });
                }
            });
    });

    // Sort: overdue/urgent first, then stale-only
    flaggedProjects.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        // Among urgent, sort by deadline ascending
        if (a.daysUntilDeadline !== null && b.daysUntilDeadline !== null) {
            return a.daysUntilDeadline - b.daysUntilDeadline;
        }
        return 0;
    });

    const getTaskStatusColor = (status: string) => {
        switch (status) {
            case TaskStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case TaskStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case TaskStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            default: return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
        }
    };

    if (flaggedProjects.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">All projects are on track</p>
                <p className="text-sm text-slate-400">No stale projects or urgent deadlines detected.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {flaggedProjects.map(({ project, teamName, isStale, isUrgent, daysSinceUpdate, daysUntilDeadline }) => (
                <div
                    key={project.id}
                    className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${
                        isUrgent
                            ? 'border-red-300 dark:border-red-700'
                            : 'border-amber-200 dark:border-amber-800'
                    }`}
                >
                    {/* Project Header */}
                    <div className={`px-5 py-3 flex items-center justify-between gap-4 ${
                        isUrgent
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-amber-50 dark:bg-amber-900/20'
                    }`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <AlertTriangle className={`w-4 h-4 shrink-0 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{project.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{teamName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {isStale && (
                                <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full">
                                    <Clock className="w-3 h-3" />
                                    {daysSinceUpdate !== null ? `No update for ${daysSinceUpdate}d` : 'No activity tracked'}
                                </span>
                            )}
                            {isUrgent && daysUntilDeadline !== null && (
                                <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                                    daysUntilDeadline < 0
                                        ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    <Calendar className="w-3 h-3" />
                                    {daysUntilDeadline < 0
                                        ? `Overdue by ${Math.abs(daysUntilDeadline)}d`
                                        : daysUntilDeadline === 0
                                            ? 'Due today!'
                                            : `Due in ${daysUntilDeadline}d`}
                                </span>
                            )}
                            {project.deadline && (
                                <span className="text-xs text-slate-400 font-mono">
                                    ETA: {project.deadline}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Tasks list */}
                    {project.tasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {project.tasks.map(task => (
                                <div
                                    key={task.id}
                                    className="flex items-center justify-between px-5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/20 gap-3"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(task.status)}`}>
                                            {task.status}
                                        </span>
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                                    </div>
                                    {task.eta && (
                                        <span className="shrink-0 text-xs text-slate-400 font-mono">{task.eta}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-5 py-3 text-xs text-slate-400 italic">No tasks defined for this project.</div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default StaleProjectTracker;
