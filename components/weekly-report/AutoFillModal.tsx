
import React from 'react';
import { WeeklyReport as WeeklyReportType, User } from '../../types';
import { Wand2, X, CheckCircle2, Loader2 } from 'lucide-react';

interface AutoFillModalProps {
    isOpen: boolean;
    onClose: () => void;
    recentReportsByUser: Record<string, WeeklyReportType[]>;
    users: User[];
    selectedReportIds: string[];
    onToggleReport: (id: string) => void;
    onConfirm: () => void;
    isFilling: boolean;
}

const AutoFillModal: React.FC<AutoFillModalProps> = ({ 
    isOpen, onClose, recentReportsByUser, users, selectedReportIds, onToggleReport, onConfirm, isFilling 
}) => {
    if (!isOpen) return null;

    const getWeekLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-600 rounded-t-2xl">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            <Wand2 className="w-5 h-5" />
                            Generate Global Report
                        </h3>
                        <button onClick={onClose} className="text-white hover:text-indigo-200">
                            <X className="w-5 h-5" />
                        </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Select weekly reports from your team to consolidate into your current report fields.
                        <br/>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Only showing reports from the last 3 months.</span>
                    </p>
                    
                    {Object.keys(recentReportsByUser).length === 0 && <p className="text-center italic text-slate-400">No recent reports available.</p>}

                    <div className="space-y-4">
                        {Object.entries(recentReportsByUser).map(([userId, userReports]: [string, WeeklyReportType[]]) => {
                            const user = users.find(u => u.id === userId);
                            return (
                                <div key={userId} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="bg-slate-100 dark:bg-slate-700/50 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                        {user?.firstName} {user?.lastName}
                                    </div>
                                    <div>
                                        {userReports.map(report => (
                                            <div 
                                                key={report.id} 
                                                onClick={() => onToggleReport(report.id)}
                                                className={`p-3 flex items-center gap-3 cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors ${selectedReportIds.includes(report.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedReportIds.includes(report.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {selectedReportIds.includes(report.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{getWeekLabel(report.weekOf)}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{report.mainSuccess || "No success recorded"}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                        <button 
                        onClick={onConfirm}
                        disabled={isFilling || selectedReportIds.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {isFilling ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                        Generate Content
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutoFillModal;
