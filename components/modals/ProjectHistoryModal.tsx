
import React from 'react';
import { Project, AuditEntry } from '../../types';
import { X, History, User, Calendar, Activity } from 'lucide-react';

interface ProjectHistoryModalProps {
    project: Project;
    onClose: () => void;
}

const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({ project, onClose }) => {
    
    // Sort logs by date descending (just in case)
    const sortedLogs = [...(project.auditLog || [])].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return {
            day: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-500" />
                        Project History
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {sortedLogs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No activity recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-12 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                            {sortedLogs.map((entry) => {
                                const { day, time } = formatDate(entry.date);
                                return (
                                    <div key={entry.id} className="relative flex items-start group">
                                        <div className="absolute left-0 w-24 flex flex-col items-end pr-4 text-right">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{day}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{time}</span>
                                        </div>
                                        <div className="absolute left-12 w-2 h-2 bg-indigo-500 rounded-full mt-1.5 -translate-x-1/2 ring-4 ring-white dark:ring-slate-900"></div>
                                        <div className="ml-16 flex-1 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                                    {entry.action}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-800 dark:text-slate-200 mb-2">
                                                {entry.details || 'No details.'}
                                            </p>
                                            <div className="flex items-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-2 mt-1">
                                                <User className="w-3 h-3 mr-1" />
                                                {entry.userName}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button 
                        onClick={onClose}
                        className="w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectHistoryModal;
