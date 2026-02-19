
import React from 'react';
import { Team, ProjectStatus } from '../../types';
import { BarChart3, ListChecks } from 'lucide-react';

interface TeamPortfolioProps {
    teams: Team[];
}

const TeamPortfolio: React.FC<TeamPortfolioProps> = ({ teams }) => {
    return (
        <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Team Portfolio Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => {
                    const activeProjects = team.projects.filter(p => !p.isArchived);
                    const statusCounts = {
                        [ProjectStatus.ACTIVE]: 0,
                        [ProjectStatus.PLANNING]: 0,
                        [ProjectStatus.PAUSED]: 0,
                        [ProjectStatus.DONE]: 0
                    };
                    let totalTasks = 0;

                    activeProjects.forEach(p => {
                        if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
                        totalTasks += p.tasks.length;
                    });

                    return (
                        <div key={team.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-bold text-lg text-slate-800 dark:text-white">{team.name}</h4>
                                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-1 rounded font-bold">
                                    {activeProjects.length} Projects
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-slate-400 font-semibold uppercase">Active</span>
                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{statusCounts[ProjectStatus.ACTIVE]}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-slate-400 font-semibold uppercase">Plan</span>
                                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{statusCounts[ProjectStatus.PLANNING]}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-slate-400 font-semibold uppercase">Done</span>
                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{statusCounts[ProjectStatus.DONE]}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-slate-400 font-semibold uppercase">Pause</span>
                                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{statusCounts[ProjectStatus.PAUSED]}</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center text-sm text-slate-500 dark:text-slate-400">
                                <ListChecks className="w-4 h-4 mr-2" />
                                <strong>{totalTasks}</strong> &nbsp;Total Tasks Associated
                            </div>
                        </div>
                    );
                })}
                {teams.length === 0 && <p className="text-slate-400 italic">No teams defined.</p>}
            </div>
        </div>
    );
};

export default TeamPortfolio;
