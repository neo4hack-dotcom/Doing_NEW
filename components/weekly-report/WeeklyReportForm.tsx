
import React, { useState, useEffect } from 'react';
import { WeeklyReport as WeeklyReportType, HealthStatus, UserRole, User } from '../../types';
import { Sparkles, CheckCircle2, AlertOctagon, AlertTriangle, Users, MoreHorizontal, Plus, Wand2, Mail, Save, Calendar, Trash2, ShieldCheck, Bot } from 'lucide-react';

interface WeeklyReportFormProps {
    report: WeeklyReportType;
    currentUser: User | null;
    currentMonday: string;
    onChange: (updates: Partial<WeeklyReportType>) => void;
    onSave: () => void;
    onDelete?: () => void;
    onResetToCurrent: () => void;
    onAutoFill?: () => void;
    onAiAutoBuild?: () => void;
    onManagerSynthesis?: () => void;
    onGenerateEmail?: () => void;
    onSaveFeedback?: (annotation: string) => void;
    isAdmin: boolean;
    llmConfigured: boolean;
}

const WeeklyReportForm: React.FC<WeeklyReportFormProps> = ({
    report, currentUser, currentMonday, onChange, onSave, onDelete, onResetToCurrent,
    onAutoFill, onAiAutoBuild, onManagerSynthesis, onGenerateEmail, onSaveFeedback, isAdmin, llmConfigured
}) => {
    const isPastReport = report.weekOf < currentMonday;
    const isFutureReport = report.weekOf > currentMonday;
    const isNotCurrentWeek = report.weekOf !== currentMonday;

    // Local state for admin feedback (independent from main form edits)
    const [feedbackText, setFeedbackText] = useState(report.managerAnnotation || '');
    const [feedbackSaved, setFeedbackSaved] = useState(false);

    // Sync feedback text when a different report is loaded
    useEffect(() => {
        setFeedbackText(report.managerAnnotation || '');
        setFeedbackSaved(false);
    }, [report.id, report.managerAnnotation]);

    return (
        <div className="animate-in fade-in space-y-8">
            {/* Input Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {report.id ? 'Edit Report' : 'New Report'}
                            </h2>
                            {isPastReport && (
                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                                    Editing Past Report
                                </span>
                            )}
                            {isFutureReport && (
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                                    Future Date
                                </span>
                            )}
                        </div>
                        <div className="flex items-center mt-2 gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center font-mono">
                                <Calendar className="w-3 h-3 mr-1" />
                                Week Of:
                            </span>
                            <input 
                                type="date" 
                                value={report.weekOf}
                                onChange={(e) => onChange({ weekOf: e.target.value })}
                                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={onResetToCurrent}
                            className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-sm font-medium transition-colors flex items-center border border-emerald-200 dark:border-emerald-800"
                        >
                            <Plus className="w-4 h-4 mr-1" /> New Report
                        </button>

                        {/* AI Auto Build Button - Visible to ALL users */}
                        {llmConfigured && onAiAutoBuild && (
                            <button
                                onClick={onAiAutoBuild}
                                className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white px-3 py-2 rounded-lg font-medium transition-all flex items-center shadow-md text-sm"
                                title="AI Auto Build — carry forward items from a previous report"
                            >
                                <Bot className="w-4 h-4 mr-1.5" /> AI Auto Build
                            </button>
                        )}

                            {/* Consolidation Magic Button (Admin Only) */}
                            {llmConfigured && isAdmin && onAutoFill && (
                            <button 
                                onClick={onAutoFill}
                                className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-lg font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center border border-purple-200 dark:border-purple-800 text-sm"
                                title="Auto-fill from recent team reports"
                            >
                                <Wand2 className="w-4 h-4 mr-2" /> Auto-Fill
                            </button>
                        )}
                        
                        {/* Manager Synthesis Button (Admin Only) */}
                        {llmConfigured && isAdmin && onManagerSynthesis && (
                            <button 
                                onClick={onManagerSynthesis}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center shadow-md text-sm"
                                title="Generate structured synthesis from current report fields"
                            >
                                <Sparkles className="w-4 h-4 mr-2" /> Manager Synthèse
                            </button>
                        )}

                        {llmConfigured && onGenerateEmail && (
                            <button 
                                onClick={onGenerateEmail}
                                className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center border border-indigo-200 dark:border-indigo-800 text-sm"
                            >
                                <Mail className="w-4 h-4 mr-2" /> AI Email
                            </button>
                        )}

                        {/* Delete Button (Only if existing report) */}
                        {report.id && onDelete && (
                            <button 
                                onClick={onDelete}
                                className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center border border-red-200 dark:border-red-800 text-sm"
                                title="Delete this report"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}

                        <button 
                            onClick={onSave}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center shadow-md text-sm"
                        >
                            <Save className="w-4 h-4 mr-2" /> Save
                        </button>
                    </div>
                </div>

                {/* Health Status Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Health of the Team</label>
                        <select 
                            value={report.teamHealth || 'Green'} 
                            onChange={e => onChange({ teamHealth: e.target.value as HealthStatus })}
                            className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                        >
                            <option value="Green">🟢 Green</option>
                            <option value="Amber">🟠 Amber</option>
                            <option value="Red">🔴 Red</option>
                        </select>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Health of Projects</label>
                        <select 
                            value={report.projectHealth || 'Green'} 
                            onChange={e => onChange({ projectHealth: e.target.value as HealthStatus })}
                            className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                        >
                            <option value="Green">🟢 Green</option>
                            <option value="Amber">🟠 Amber</option>
                            <option value="Red">🔴 Red</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* New This Week (Full Width) */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 md:col-span-2">
                        <label className="block text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center">
                            <Sparkles className="w-4 h-4 mr-2" /> New this week
                        </label>
                        <textarea 
                            value={report.newThisWeek || ''}
                            onChange={e => onChange({ newThisWeek: e.target.value })}
                            className="w-full h-24 p-3 rounded-lg border-0 ring-1 ring-indigo-200 dark:ring-indigo-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-indigo-800/30"
                            placeholder="Any new arrivals, new topics, or fresh news?"
                        />
                    </div>

                    {/* Main Success */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <label className="block text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Main Success
                        </label>
                        <textarea 
                            value={report.mainSuccess}
                            onChange={e => onChange({ mainSuccess: e.target.value })}
                            className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-emerald-200 dark:ring-emerald-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-emerald-800/30"
                            placeholder="What went well this week?"
                        />
                    </div>

                    {/* Main Issue */}
                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                        <label className="block text-sm font-bold text-red-700 dark:text-red-400 mb-2 flex items-center">
                            <AlertOctagon className="w-4 h-4 mr-2" /> Main Issue / Blocker
                        </label>
                        <textarea 
                            value={report.mainIssue}
                            onChange={e => onChange({ mainIssue: e.target.value })}
                            className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-red-200 dark:ring-red-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white placeholder-red-800/30"
                            placeholder="Any blocking points or major difficulties?"
                        />
                    </div>

                    {/* Incident */}
                    <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                        <label className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" /> Incidents
                        </label>
                        <textarea 
                            value={report.incident}
                            onChange={e => onChange({ incident: e.target.value })}
                            className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-orange-200 dark:ring-orange-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white placeholder-orange-800/30"
                            placeholder="Prod incidents, security alerts..."
                        />
                    </div>

                    {/* Organization */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <label className="block text-sm font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center">
                            <Users className="w-4 h-4 mr-2" /> Organizational Point
                        </label>
                        <textarea 
                            value={report.orgaPoint}
                            onChange={e => onChange({ orgaPoint: e.target.value })}
                            className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-blue-200 dark:ring-blue-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-blue-800/30"
                            placeholder="Leaves, training, team events..."
                        />
                    </div>

                    {/* Other (Full Width) */}
                    <div className="bg-slate-50 dark:bg-slate-900/10 p-4 rounded-xl border border-slate-200 dark:border-slate-800 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2 flex items-center">
                            <MoreHorizontal className="w-4 h-4 mr-2" /> Other
                        </label>
                        <textarea
                            value={report.otherSection}
                            onChange={e => onChange({ otherSection: e.target.value })}
                            className="w-full h-24 p-3 rounded-lg border-0 ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-slate-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                            placeholder="Any other topics..."
                        />
                    </div>
                </div>
            </div>

            {/* Admin Feedback Section — visible to both parties, editable only by admin */}
            {report.id && (isAdmin || report.managerAnnotation) && (
                <div className={`p-6 rounded-2xl border-2 ${isAdmin ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold flex items-center gap-2 ${isAdmin ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                            <ShieldCheck className="w-5 h-5" />
                            Admin Feedback
                            {report.managerCheck && (
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Reviewed
                                </span>
                            )}
                        </h3>
                        {!isAdmin && (
                            <span className="text-xs text-blue-500 dark:text-blue-400 italic bg-blue-100 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">Read-only</span>
                        )}
                    </div>

                    {isAdmin ? (
                        <>
                            <textarea
                                value={feedbackText}
                                onChange={e => { setFeedbackText(e.target.value); setFeedbackSaved(false); }}
                                className="w-full h-28 p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400 outline-none text-slate-900 dark:text-white placeholder-amber-300/60 text-sm resize-none"
                                placeholder="Rédigez votre feedback pour ce rapport... (optionnel)"
                            />
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                                    Ce feedback est conservé dans le rapport et visible par l'auteur.
                                </p>
                                <button
                                    onClick={() => {
                                        if (onSaveFeedback) {
                                            onSaveFeedback(feedbackText);
                                            setFeedbackSaved(true);
                                        }
                                    }}
                                    disabled={!onSaveFeedback}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 ${
                                        feedbackSaved
                                            ? 'bg-green-500 hover:bg-green-600 text-white'
                                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                                    }`}
                                >
                                    {feedbackSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                    {feedbackSaved ? 'Feedback enregistré' : 'Enregistrer le feedback'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
                            {report.managerAnnotation ? (
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap">
                                    "{report.managerAnnotation}"
                                </p>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Aucun commentaire pour l'instant.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WeeklyReportForm;
