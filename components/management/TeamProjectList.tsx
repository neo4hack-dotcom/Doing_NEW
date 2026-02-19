
import React from 'react';
import { Team, ProjectStatus, TaskStatus } from '../../types';
import { AlertCircle, CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';

interface TeamProjectListProps {
    teams: Team[];
}

const TeamProjectList: React.FC<TeamProjectListProps> = ({ teams }) => {

    const getStatusBadge = (status: ProjectStatus) => {
        const styles = {
            [ProjectStatus.ACTIVE]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
            [ProjectStatus.DONE]: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            [ProjectStatus.PAUSED]: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            [ProjectStatus.PLANNING]: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[status]}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {teams.map(team => {
                // Filter out archived projects to keep the view relevant
                const activeProjects = team.projects.filter(p => !p.isArchived);
                
                if (activeProjects.length === 0) return null;

                return (
                    <div key={team.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center">
                                {team.name}
                            </h3>
                            <span className="text-xs text-slate-500 font-mono bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                {activeProjects.length} Active Projects
                            </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-3 w-1/3">Project Name</th>
                                        <th className="px-6 py-3 w-32">Status</th>
                                        <th className="px-6 py-3">Task Distribution</th>
                                        <th className="px-6 py-3 w-24 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {activeProjects.map(project => {
                                        const totalTasks = project.tasks.length;
                                        const done = project.tasks.filter(t => t.status === TaskStatus.DONE).length;
                                        const ongoing = project.tasks.filter(t => t.status === TaskStatus.ONGOING).length;
                                        const blocked = project.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
                                        // "Todo" is the rest
                                        
                                        // Calculate percentages for the bar
                                        const pDone = totalTasks > 0 ? (done / totalTasks) * 100 : 0;
                                        const pOngoing = totalTasks > 0 ? (ongoing / totalTasks) * 100 : 0;
                                        const pBlocked = totalTasks > 0 ? (blocked / totalTasks) * 100 : 0;
                                        // Ensure Todo fills the rest visually if needed, or just let the background show
                                        // A simple stacked bar approach:

                                        return (
                                            <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                                            {project.isImportant && <AlertCircle className="w-3.5 h-3.5 text-red-500 fill-red-100 dark:fill-red-900/20" />}
                                                            {project.name}
                                                        </span>
                                                        <span className="text-xs text-slate-400 line-clamp-1 group-hover:text-indigo-500 transition-colors">
                                                            {project.description}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(project.status)}
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex flex-col justify-center h-full">
                                                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
                                                            {done > 0 && <div style={{width: `${pDone}%`}} className="bg-emerald-500 hover:bg-emerald-400 transition-colors" title={`Done: ${done}`} />}
                                                            {ongoing > 0 && <div style={{width: `${pOngoing}%`}} className="bg-blue-500 hover:bg-blue-400 transition-colors" title={`In Progress: ${ongoing}`} />}
                                                            {blocked > 0 && <div style={{width: `${pBlocked}%`}} className="bg-red-500 hover:bg-red-400 transition-colors" title={`Blocked: ${blocked}`} />}
                                                        </div>
                                                        <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400 font-medium">
                                                            {done > 0 && <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"/> {done} Done</span>}
                                                            {ongoing > 0 && <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"/> {ongoing} Active</span>}
                                                            {blocked > 0 && <span className="flex items-center text-red-500"><div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"/> {blocked} Blocked</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                        {totalTasks}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
            
            {/* Legend Footer */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-3 h-3 bg-emerald-500 rounded mr-2"></span> Done
                </div>
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-3 h-3 bg-blue-500 rounded mr-2"></span> In Progress
                </div>
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-3 h-3 bg-red-500 rounded mr-2"></span> Blocked
                </div>
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-3 h-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded mr-2"></span> To Do
                </div>
            </div>
        </div>
    );
};

export default TeamProjectList;
