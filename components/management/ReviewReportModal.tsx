
import React, { useState } from 'react';
import { WeeklyReport, User, HealthStatus } from '../../types';
import { X, MessageSquare, Check } from 'lucide-react';

interface ReviewReportModalProps {
    report: WeeklyReport;
    user: User | undefined;
    onClose: () => void;
    onValidate: (report: WeeklyReport, annotation: string) => void;
}

const ReviewReportModal: React.FC<ReviewReportModalProps> = ({ report, user, onClose, onValidate }) => {
    const [annotation, setAnnotation] = useState(report.managerAnnotation || '');

    const getHealthColor = (status?: HealthStatus) => {
        switch(status) {
            case 'Red': return 'bg-red-500';
            case 'Amber': return 'bg-amber-500';
            case 'Green': return 'bg-emerald-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
                    <div>
                         <h3 className="font-bold text-lg text-slate-900 dark:text-white">Review Report</h3>
                         <p className="text-xs text-slate-500">
                             Employee: {user?.firstName} {user?.lastName} | Week: {report.weekOf}
                         </p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="flex gap-4 mb-2">
                        {report.teamHealth && (
                            <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getHealthColor(report.teamHealth)}`}>
                                Team: {report.teamHealth}
                            </div>
                        )}
                        {report.projectHealth && (
                            <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getHealthColor(report.projectHealth)}`}>
                                Projects: {report.projectHealth}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <span className="text-xs font-bold text-emerald-700 uppercase">Success</span>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{report.mainSuccess}</p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                            <span className="text-xs font-bold text-red-700 uppercase">Issues</span>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{report.mainIssue}</p>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-500 uppercase">Incidents / Orga</span>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{report.incident} / {report.orgaPoint}</p>
                    </div>
                    {report.otherSection && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-500 uppercase">Other</span>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{report.otherSection}</p>
                        </div>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Manager Annotation
                        </label>
                        <textarea 
                            value={annotation}
                            onChange={e => setAnnotation(e.target.value)}
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Add your feedback here..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => onValidate(report, annotation)}
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Validate & Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewReportModal;
