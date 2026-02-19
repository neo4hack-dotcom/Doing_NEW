
import React from 'react';
import { WeeklyReport as WeeklyReportType, User, HealthStatus, UserRole } from '../../types';
import { Sparkles, Bot, Trash2 } from 'lucide-react';

interface ReportCardProps {
    report: WeeklyReportType;
    users: User[];
    currentUser: User | null;
    onGenerateEmail: (report: WeeklyReportType) => void;
    onDelete?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, users, currentUser, onGenerateEmail, onDelete }) => {
    const author = users.find(u => u.id === report.userId);
    
    // Permission Check: Author OR Admin can delete
    const isAuthor = currentUser?.id === report.userId;
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const canDelete = isAuthor || isAdmin;

    const getWeekLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    const getHealthColor = (status?: HealthStatus) => {
        switch(status) {
            case 'Red': return 'bg-red-500';
            case 'Amber': return 'bg-amber-500';
            case 'Green': return 'bg-emerald-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm group">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                        {author?.firstName[0]}{author?.lastName[0]}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{author?.firstName} {author?.lastName}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{getWeekLabel(report.weekOf)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Delete Button (Conditional) */}
                    {onDelete && canDelete && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Report"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}

                    {/* AI Replay Button for History */}
                    <button 
                        onClick={() => onGenerateEmail(report)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Regenerate AI Summary"
                    >
                        <Bot className="w-4 h-4" />
                    </button>

                    <div className="flex gap-1 items-center" title="Team/Project Health">
                        <div className={`w-3 h-3 rounded-full ${getHealthColor(report.teamHealth)}`} title={`Team: ${report.teamHealth}`}></div>
                        <div className={`w-3 h-3 rounded-full ${getHealthColor(report.projectHealth)}`} title={`Projects: ${report.projectHealth}`}></div>
                    </div>
                    <div className="text-xs text-slate-400">
                        Updated: {new Date(report.updatedAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.newThisWeek && (
                    <div className="md:col-span-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1 flex items-center">
                            <Sparkles className="w-3 h-3 mr-1" /> New This Week
                        </h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.newThisWeek}</p>
                    </div>
                )}
                <div>
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Success</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.mainSuccess || '-'}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Issues</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.mainIssue || '-'}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Incidents</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.incident || '-'}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Organization</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.orgaPoint || '-'}</p>
                </div>
                {report.otherSection && (
                    <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Other</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.otherSection}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportCard;
