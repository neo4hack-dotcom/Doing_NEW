
import React, { useState, useEffect } from 'react';
import { WeeklyReport as WeeklyReportType, LLMConfig } from '../../types';
import { ExtractedReportItem, extractLiveItemsFromReport } from '../../services/llmService';
import {
    X, Wand2, Sparkles, CheckCircle2, Circle, ChevronRight,
    CheckSquare, Square, RefreshCw, ArrowRight, Clock, Zap,
    CheckCircle, AlertCircle, AlertTriangle, Users, MoreHorizontal
} from 'lucide-react';

interface AiAutoBuildModalProps {
    isOpen: boolean;
    onClose: () => void;
    myReports: WeeklyReportType[];       // User's own past reports (sorted newest first)
    currentReportId: string;             // Exclude current report
    llmConfig: LLMConfig;
    onApply: (updates: Partial<WeeklyReportType>) => void;
}

const SECTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    newThisWeek:  { label: 'New This Week',           color: 'indigo',  icon: <Sparkles className="w-3.5 h-3.5" /> },
    mainSuccess:  { label: 'Main Success',            color: 'emerald', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    mainIssue:    { label: 'Main Issue / Blocker',    color: 'red',     icon: <AlertCircle className="w-3.5 h-3.5" /> },
    incident:     { label: 'Incidents',               color: 'orange',  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    orgaPoint:    { label: 'Organizational Point',    color: 'blue',    icon: <Users className="w-3.5 h-3.5" /> },
    otherSection: { label: 'Other',                   color: 'slate',   icon: <MoreHorizontal className="w-3.5 h-3.5" /> },
};

const COLOR_MAP: Record<string, string> = {
    indigo:  'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    red:     'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    orange:  'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    blue:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    slate:   'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
};

type Step = 'select' | 'loading' | 'confirm' | 'done';

const AiAutoBuildModal: React.FC<AiAutoBuildModalProps> = ({
    isOpen, onClose, myReports, currentReportId, llmConfig, onApply
}) => {
    const [step, setStep] = useState<Step>('select');
    const [selectedReportId, setSelectedReportId] = useState<string>('');
    const [extractedItems, setExtractedItems] = useState<ExtractedReportItem[]>([]);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Filter out current report
    const eligibleReports = myReports.filter(r => r.id !== currentReportId && r.id);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setStep('select');
            setSelectedReportId(eligibleReports[0]?.id || '');
            setExtractedItems([]);
            setCheckedIds(new Set());
            setErrorMsg('');
        }
    }, [isOpen]);

    // ESC to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleExtract = async () => {
        const report = eligibleReports.find(r => r.id === selectedReportId);
        if (!report) return;
        setStep('loading');
        setErrorMsg('');
        try {
            const items = await extractLiveItemsFromReport(report, llmConfig);
            if (items.length === 0) {
                setErrorMsg('No items were extracted. The report may be empty or the AI could not parse it.');
                setStep('select');
                return;
            }
            setExtractedItems(items);
            // Pre-check items the LLM thinks are still alive
            const preChecked = new Set(items.filter(i => i.keepAlive).map(i => i.id));
            setCheckedIds(preChecked);
            setStep('confirm');
        } catch (e: any) {
            setErrorMsg(`AI Error: ${e.message}`);
            setStep('select');
        }
    };

    const toggleItem = (id: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => setCheckedIds(new Set(extractedItems.map(i => i.id)));
    const deselectAll = () => setCheckedIds(new Set());

    const handleApply = () => {
        const confirmed = extractedItems.filter(i => checkedIds.has(i.id));
        if (confirmed.length === 0) { onClose(); return; }

        // Group by section and build "From last report: ... / Update this week:" text
        const sections: Record<string, string[]> = {};
        confirmed.forEach(item => {
            if (!sections[item.section]) sections[item.section] = [];
            sections[item.section].push(item.summary);
        });

        const updates: Partial<WeeklyReportType> = {};
        (Object.keys(sections) as Array<keyof typeof sections>).forEach(section => {
            const items = sections[section];
            const formatted = items.map(summary =>
                `• From last report: ${summary}\n  Update this week: `
            ).join('\n\n');
            (updates as any)[section] = formatted;
        });

        onApply(updates);
        setStep('done');
        setTimeout(() => onClose(), 800);
    };

    const selectedCount = checkedIds.size;

    // Group items by section for confirm step
    const itemsBySection: Record<string, ExtractedReportItem[]> = {};
    extractedItems.forEach(item => {
        if (!itemsBySection[item.section]) itemsBySection[item.section] = [];
        itemsBySection[item.section].push(item);
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                            <Wand2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">AI Auto Build</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Carry forward live items from a previous report</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    {['Select Report', 'Review Items', 'Apply'].map((label, idx) => {
                        const stepMap: Record<number, Step[]> = {
                            0: ['select', 'loading'],
                            1: ['confirm'],
                            2: ['done']
                        };
                        const isActive = stepMap[idx]?.includes(step);
                        const isPast = (step === 'confirm' && idx === 0) || (step === 'done' && idx <= 1);
                        return (
                            <React.Fragment key={label}>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                    isActive ? 'bg-indigo-600 text-white' :
                                    isPast ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    'text-slate-400 dark:text-slate-500'
                                }`}>
                                    {isPast ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 flex items-center justify-center">{idx + 1}</span>}
                                    {label}
                                </div>
                                {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">

                    {/* STEP 1: Select */}
                    {(step === 'select' || step === 'loading') && (
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Select a previous report to analyze
                                </label>
                                {eligibleReports.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-sm">
                                        No previous reports found. Save at least one weekly report first.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {eligibleReports.map(report => (
                                            <label
                                                key={report.id}
                                                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                    selectedReportId === report.id
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="reportSelect"
                                                    value={report.id}
                                                    checked={selectedReportId === report.id}
                                                    onChange={() => setSelectedReportId(report.id)}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                    selectedReportId === report.id
                                                        ? 'border-indigo-600 bg-indigo-600'
                                                        : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                    {selectedReportId === report.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                        Week of {report.weekOf}
                                                    </p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                                        {[report.mainSuccess, report.mainIssue, report.incident]
                                                            .filter(Boolean)
                                                            .join(' · ')
                                                            .substring(0, 80) || 'No content preview'}…
                                                    </p>
                                                </div>
                                                <div className="flex gap-1.5 flex-shrink-0">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${report.teamHealth === 'Green' ? 'bg-emerald-500' : report.teamHealth === 'Amber' ? 'bg-amber-500' : 'bg-red-500'}`} title={`Team: ${report.teamHealth}`} />
                                                    <span className={`w-2.5 h-2.5 rounded-full ${report.projectHealth === 'Green' ? 'bg-emerald-500' : report.projectHealth === 'Amber' ? 'bg-amber-500' : 'bg-red-500'}`} title={`Project: ${report.projectHealth}`} />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {errorMsg && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                                <p className="font-semibold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> How it works</p>
                                <p>1. The AI analyzes your selected report and extracts each distinct item.</p>
                                <p>2. It pre-checks items that seem <strong>still ongoing</strong> (blockers, pending tasks, future deadlines).</p>
                                <p>3. You confirm the selection, and items are inserted as <em>"From last report…&nbsp; Update this week:"</em></p>
                            </div>
                        </div>
                    )}

                    {/* STEP 1.5: Loading */}
                    {step === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <RefreshCw className="w-7 h-7 text-white animate-spin" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">Analyzing report with AI…</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Extracting items and checking relevance</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Confirm */}
                    {step === 'confirm' && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedCount}</span> of {extractedItems.length} items selected
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={selectAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Select all</button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={deselectAll} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Deselect all</button>
                                </div>
                            </div>

                            {Object.entries(itemsBySection).map(([section, items]) => {
                                const meta = SECTION_META[section];
                                const colorClass = COLOR_MAP[meta?.color || 'slate'];
                                return (
                                    <div key={section} className="space-y-2">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${colorClass}`}>
                                            {meta?.icon}
                                            {meta?.label || section}
                                        </div>
                                        <div className="space-y-2 pl-2">
                                            {items.map(item => {
                                                const isChecked = checkedIds.has(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => toggleItem(item.id)}
                                                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                            isChecked
                                                                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
                                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60 hover:opacity-80'
                                                        }`}
                                                    >
                                                        <div className="flex-shrink-0 mt-0.5">
                                                            {isChecked
                                                                ? <CheckSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                                                                : <Square className="w-4.5 h-4.5 text-slate-400" />
                                                            }
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug">
                                                                {item.summary}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                {item.keepAlive ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                                                        <Clock className="w-2.5 h-2.5" /> Still relevant
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                                                        Likely closed
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">{item.reason}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
                                <strong>Note:</strong> Selected items will be added to the corresponding sections as <em>"From last report: [summary] — Update this week:"</em>. You can then complete each with new information.
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Done */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-base font-semibold text-slate-800 dark:text-white">Applied successfully!</p>
                            <p className="text-sm text-slate-400">Your report form has been updated.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
                    {step === 'select' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleExtract}
                                disabled={!selectedReportId || eligibleReports.length === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
                            >
                                <Sparkles className="w-4 h-4" />
                                Analyze with AI
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    {step === 'loading' && (
                        <div className="flex-1 text-center text-sm text-slate-400 animate-pulse">Processing…</div>
                    )}

                    {step === 'confirm' && (
                        <>
                            <button
                                onClick={() => setStep('select')}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={selectedCount === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Apply {selectedCount} item{selectedCount !== 1 ? 's' : ''} to report
                            </button>
                        </>
                    )}

                    {step === 'done' && (
                        <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiAutoBuildModal;
