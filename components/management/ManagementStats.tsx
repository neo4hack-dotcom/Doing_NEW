
import React, { useMemo } from 'react';
import { Team, Meeting, WorkingGroup, WeeklyReport, TaskStatus, ProjectStatus, ActionItemStatus } from '../../types';
import { Target, AlertTriangle, BarChart3, FileText, ShieldAlert } from 'lucide-react';

interface ManagementStatsProps {
    teams: Team[];
    meetings: Meeting[];
    workingGroups: WorkingGroup[];
    reports: WeeklyReport[];
}

const ManagementStats: React.FC<ManagementStatsProps> = ({ teams, meetings, workingGroups, reports }) => {
    
    // --- AGGREGATION LOGIC ---
    const kpis = useMemo(() => {
        // 1. Projects & Tasks
        const allTasks = teams.flatMap(t => t.projects.filter(p => !p.isArchived).flatMap(p => p.tasks));
        const totalTasks = allTasks.length;
        const blockedTasks = allTasks.filter(t => t.status === TaskStatus.BLOCKED).length;
        const openTasks = allTasks.filter(t => t.status !== TaskStatus.DONE).length;
        const overdueProjects = teams.flatMap(t => t.projects.filter(p => !p.isArchived)).filter(p => p.status !== ProjectStatus.DONE && new Date(p.deadline) < new Date()).length;

        // 2. Meetings
        const allMeetingActions = meetings.flatMap(m => m.actionItems);
        const openMeetingActions = allMeetingActions.filter(a => a.status !== ActionItemStatus.DONE).length;
        const blockedMeetingActions = allMeetingActions.filter(a => a.status === ActionItemStatus.BLOCKED).length;
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const meetingsThisWeek = meetings.filter(m => new Date(m.date) >= oneWeekAgo).length;

        // 3. Working Groups
        const activeGroups = workingGroups.filter(g => !g.archived);
        const allWGSessions = activeGroups.flatMap(g => g.sessions);
        const allWGActions = allWGSessions.flatMap(s => s.actionItems);
        const openWGActions = allWGActions.filter(a => a.status !== ActionItemStatus.DONE).length;
        const blockedWGActions = allWGActions.filter(a => a.status === ActionItemStatus.BLOCKED).length;
        const sessionsThisWeek = allWGSessions.filter(s => new Date(s.date) >= oneWeekAgo).length;

        // 4. Reports
        const pendingReports = reports.filter(r => !r.managerCheck).length;

        // Total Calculations
        const totalOpenActions = openTasks + openMeetingActions + openWGActions;
        const totalBlocked = blockedTasks + blockedMeetingActions + blockedWGActions;
        const totalActivity = meetingsThisWeek + sessionsThisWeek;

        return {
            totalOpenActions,
            totalBlocked,
            totalActivity,
            pendingReports,
            breakdown: {
                tasks: openTasks,
                meetingActions: openMeetingActions,
                wgActions: openWGActions
            },
            alerts: {
                overdueProjects,
                blockedTasks
            }
        };
    }, [teams, meetings, workingGroups, reports]);

    // Distribution Chart Component
    const ActionDistribution = () => {
        const total = kpis.totalOpenActions || 1;
        const pTasks = (kpis.breakdown.tasks / total) * 100;
        const pMeet = (kpis.breakdown.meetingActions / total) * 100;
        const pWG = (kpis.breakdown.wgActions / total) * 100;

        return (
            <div className="mt-2 w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
                <div style={{ width: `${pTasks}%` }} className="bg-blue-500" title={`Project Tasks: ${kpis.breakdown.tasks}`} />
                <div style={{ width: `${pMeet}%` }} className="bg-purple-500" title={`Meeting Actions: ${kpis.breakdown.meetingActions}`} />
                <div style={{ width: `${pWG}%` }} className="bg-orange-500" title={`WG Actions: ${kpis.breakdown.wgActions}`} />
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Card 1: Total Load */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Total Active Work</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{kpis.totalOpenActions}</h3>
                        </div>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Target className="w-5 h-5" />
                        </div>
                    </div>
                    <ActionDistribution />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                        <span className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-1"/>Projects</span>
                        <span className="flex items-center"><div className="w-2 h-2 bg-purple-500 rounded-full mr-1"/>Meetings</span>
                        <span className="flex items-center"><div className="w-2 h-2 bg-orange-500 rounded-full mr-1"/>WG</span>
                    </div>
                </div>

                {/* Card 2: Blockers */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Total Blocked</p>
                            <h3 className={`text-3xl font-black mt-1 ${kpis.totalBlocked > 0 ? 'text-red-600' : 'text-emerald-500'}`}>{kpis.totalBlocked}</h3>
                        </div>
                        <div className={`p-2 rounded-lg ${kpis.totalBlocked > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        <span className="font-bold">{kpis.alerts.blockedTasks}</span> from tasks, <span className="font-bold">{kpis.totalBlocked - kpis.alerts.blockedTasks}</span> from meetings/WGs.
                    </p>
                </div>

                {/* Card 3: Activity Pulse */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Weekly Activity</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{kpis.totalActivity}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        Sessions & Meetings held in the last 7 days.
                    </p>
                </div>
            </div>

            {/* ALERTS & RISKS SECTION */}
            {(kpis.alerts.overdueProjects > 0 || kpis.totalBlocked > 0) && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Critical Attention Required</h4>
                        <ul className="mt-1 text-xs text-red-700 dark:text-red-400 list-disc list-inside">
                            {kpis.alerts.overdueProjects > 0 && <li><strong>{kpis.alerts.overdueProjects}</strong> Projects are Overdue.</li>}
                            {kpis.totalBlocked > 0 && <li><strong>{kpis.totalBlocked}</strong> Action items are currently Blocked.</li>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementStats;
