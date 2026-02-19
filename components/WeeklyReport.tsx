
import React, { useState, useEffect } from 'react';
import { User, WeeklyReport as WeeklyReportType, LLMConfig, Team, UserRole, HealthStatus } from '../types';
import { generateWeeklyReportSummary, generateConsolidatedReport, generateManagerSynthesis } from '../services/llmService';
import { Save, History, Archive, CheckCircle2, Pencil, Trash2, RotateCcw } from 'lucide-react';

import WeeklyReportForm from './weekly-report/WeeklyReportForm';
import ReportCard from './weekly-report/ReportCard';
import AutoFillModal from './weekly-report/AutoFillModal';
import AiResultModal from './weekly-report/AiResultModal';
import LanguagePickerModal from './LanguagePickerModal';

interface WeeklyReportProps {
  reports: WeeklyReportType[];
  users: User[];
  currentUser: User | null;
  teams: Team[];
  llmConfig?: LLMConfig; 
  onSaveReport: (report: WeeklyReportType) => void;
  onDeleteReport: (id: string) => void;
}

const WeeklyReport: React.FC<WeeklyReportProps> = ({ reports, users, currentUser, teams, llmConfig, onSaveReport, onDeleteReport }) => {
  const [activeTab, setActiveTab] = useState<'my-report' | 'team-reports' | 'archives'>('my-report');
  
  // AI States
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Auto-Fill State
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [selectedReportIdsForFill, setSelectedReportIdsForFill] = useState<string[]>([]);
  const [isFilling, setIsFilling] = useState(false);

  // Language Picker State
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [pendingLlmAction, setPendingLlmAction] = useState<((lang: 'fr' | 'en') => void) | null>(null);

  // Current Date Logic
  const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  // Use today's date for new reports instead of always forcing Monday
  const todayDate = new Date().toISOString().split('T')[0];
  const currentMonday = getMonday(new Date());
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  const [currentReport, setCurrentReport] = useState<WeeklyReportType>({
      id: '',
      userId: currentUser?.id || '',
      weekOf: todayDate, // Default to today
      newThisWeek: '',
      mainSuccess: '',
      mainIssue: '',
      incident: '',
      orgaPoint: '',
      otherSection: '',
      teamHealth: 'Green',
      projectHealth: 'Green',
      updatedAt: new Date().toISOString()
  });

  const [isDirty, setIsDirty] = useState(false);

  // Load existing report
  useEffect(() => {
      if (!currentUser) return;
      
      // SAFETY: If user has unsaved changes, DO NOT overwrite with server data
      if (isDirty) return;

      // Try to find a report for the current week (Monday based) to resume work
      const existing = reports.find(r => r.userId === currentUser.id && r.weekOf === currentMonday);
      
      // If we are already editing a specific report (ID exists), don't override unless it's a fresh load
      if (currentReport.id) return;

      if (existing) {
          setCurrentReport(existing);
      } else {
          // Reset to new report defaults
          setCurrentReport(prev => ({
              ...prev,
              id: '',
              userId: currentUser.id,
              weekOf: todayDate, // Default to today for new
              updatedAt: new Date().toISOString()
          }));
      }
  }, [currentUser, reports, currentMonday, isDirty]);

  // --- Handlers ---

  const handleSave = () => {
      const reportToSave = {
          ...currentReport,
          id: currentReport.id || Date.now().toString(),
          updatedAt: new Date().toISOString()
      };
      onSaveReport(reportToSave);
      setCurrentReport(reportToSave);
      setIsDirty(false); // Changes saved
      alert("Report saved successfully!");
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Are you sure you want to delete this weekly report? This action cannot be undone.")) {
          onDeleteReport(id);
          
          // If we deleted the current active report, reset the form
          if (id === currentReport.id) {
              setCurrentReport({
                  id: '',
                  userId: currentUser?.id || '',
                  weekOf: currentMonday,
                  newThisWeek: '',
                  mainSuccess: '',
                  mainIssue: '',
                  incident: '',
                  orgaPoint: '',
                  otherSection: '',
                  teamHealth: 'Green',
                  projectHealth: 'Green',
                  updatedAt: new Date().toISOString()
              });
              setIsDirty(false);
          }
      }
  };

  const handleUpdateCurrentReport = (updates: Partial<WeeklyReportType>) => {
      setCurrentReport(prev => ({ ...prev, ...updates }));
      setIsDirty(true); // Mark as dirty on any edit
  };

  const handleResetToCurrent = () => {
      if (isDirty && !window.confirm("You have unsaved changes. Discard them and reload?")) return;

      const existing = reports.find(r => r.userId === currentUser?.id && r.weekOf === currentMonday);
      if (existing) {
          setCurrentReport(existing);
      } else {
          setCurrentReport({
            id: '',
            userId: currentUser?.id || '',
            weekOf: currentMonday,
            newThisWeek: '',
            mainSuccess: '',
            mainIssue: '',
            incident: '',
            orgaPoint: '',
            otherSection: '',
            teamHealth: 'Green',
            projectHealth: 'Green',
            updatedAt: new Date().toISOString()
        });
      }
      setIsDirty(false);
  };

  const handleLoadReport = (report: WeeklyReportType) => {
      if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) return;

      setCurrentReport({ ...report });
      setIsDirty(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveTab('my-report');
  };

  // Admin-only: save feedback without touching the user's report content
  const handleSaveFeedback = (annotation: string) => {
      if (!currentReport.id) return;
      // Base on the latest persisted version to avoid overwriting user's unsaved edits
      const savedReport = reports.find(r => r.id === currentReport.id) || currentReport;
      onSaveReport({
          ...savedReport,
          managerCheck: true,
          managerAnnotation: annotation
      });
      // Keep local currentReport in sync so the form reflects the saved state
      setCurrentReport(prev => ({ ...prev, managerCheck: true, managerAnnotation: annotation }));
  };

  // --- Language Picker Helpers ---

  const askLanguageThen = (action: (lang: 'fr' | 'en') => void) => {
      setPendingLlmAction(() => action);
      setShowLanguagePicker(true);
  };

  const handleLanguageSelected = (lang: 'fr' | 'en') => {
      setShowLanguagePicker(false);
      if (pendingLlmAction) {
          pendingLlmAction(lang);
          setPendingLlmAction(null);
      }
  };

  // --- AI Handlers ---

  const handleGenerateEmail = async (reportToUse: WeeklyReportType = currentReport, language?: 'fr' | 'en') => {
      if (!llmConfig) return alert("AI Configuration missing");
      setIsGeneratingEmail(true);
      setShowSummaryModal(true);
      setGeneratedEmail('');
      
      const email = await generateWeeklyReportSummary(reportToUse, currentUser, llmConfig, language);
      setGeneratedEmail(email);
      setIsGeneratingEmail(false);
  }

  const handleManagerSynthesis = async (language?: 'fr' | 'en') => {
      if (!llmConfig) return alert("AI Configuration missing");
      if (!currentReport.mainSuccess && !currentReport.mainIssue && !currentReport.incident && !currentReport.otherSection && !currentReport.newThisWeek) {
          return alert("Please fill or auto-fill the report sections before generating a synthesis.");
      }
      setIsSynthesizing(true);
      setShowSynthesisModal(true);
      setSynthesisResult('');

      const result = await generateManagerSynthesis(currentReport, llmConfig, language);
      setSynthesisResult(result);
      setIsSynthesizing(false);
  }

  const handleAutoFill = async (language?: 'fr' | 'en') => {
      if (!llmConfig) return alert("AI Configuration missing");
      if (selectedReportIdsForFill.length === 0) return alert("Select at least one report");

      setIsFilling(true);
      const reportsToProcess = reports.filter(r => selectedReportIdsForFill.includes(r.id));

      const consolidated = await generateConsolidatedReport(reportsToProcess, users, teams, llmConfig, language);
      
      setCurrentReport({
          ...currentReport,
          newThisWeek: consolidated.newThisWeek || currentReport.newThisWeek,
          mainSuccess: consolidated.mainSuccess || currentReport.mainSuccess,
          mainIssue: consolidated.mainIssue || currentReport.mainIssue,
          incident: consolidated.incident || currentReport.incident,
          orgaPoint: consolidated.orgaPoint || currentReport.orgaPoint,
          otherSection: consolidated.otherSection || currentReport.otherSection
      });
      setIsDirty(true);

      setIsFilling(false);
      setShowAutoFillModal(false);
      setSelectedReportIdsForFill([]);
  }

  const handleToggleReportSelection = (id: string) => {
      if (selectedReportIdsForFill.includes(id)) {
          setSelectedReportIdsForFill(selectedReportIdsForFill.filter(i => i !== id));
      } else {
          setSelectedReportIdsForFill([...selectedReportIdsForFill, id]);
      }
  }

  // --- Unarchive Handler ---
  const handleUnarchiveReport = (report: WeeklyReportType) => {
      if (window.confirm("Restore this report from archives to recent reports?")) {
          onSaveReport({ ...report, isArchived: false });
      }
  };

  const handleArchiveReport = (report: WeeklyReportType) => {
      if (window.confirm("Archive this report?")) {
          onSaveReport({ ...report, isArchived: true });
      }
  };

  // --- Data Filtering for Lists ---
  const sortedReports = [...reports].sort((a, b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());
  const today = new Date();
  const threeMonthsAgo = new Date(today.setMonth(today.getMonth() - 3));
  // Recent = not explicitly archived AND (within 3 months OR explicitly un-archived)
  const recentReports = sortedReports.filter(r => {
      if (r.isArchived === true) return false; // Explicitly archived
      return true; // Show all non-archived (including old un-archived ones)
  }).filter(r => {
      // For reports older than 3 months, only show if explicitly set isArchived=false
      if (new Date(r.weekOf) < threeMonthsAgo) {
          return r.isArchived === false; // Explicitly un-archived
      }
      return true;
  });
  // Archived = explicitly archived OR older than 3 months (and not explicitly un-archived)
  const archivedReports = sortedReports.filter(r => {
      if (r.isArchived === true) return true; // Explicitly archived
      if (r.isArchived === false) return false; // Explicitly un-archived
      return new Date(r.weekOf) < threeMonthsAgo; // Auto-archive old ones
  });
  const myHistory = sortedReports.filter(r => r.userId === currentUser?.id);

  const reportsByUserForAutoFill = recentReports.reduce((acc, report) => {
      if (report.id === currentReport.id) return acc; // Exclude current
      if (!acc[report.userId]) acc[report.userId] = [];
      acc[report.userId].push(report);
      return acc;
  }, {} as Record<string, WeeklyReportType[]>);

  const getHealthColor = (status?: HealthStatus) => {
      switch(status) {
          case 'Red': return 'bg-red-500';
          case 'Amber': return 'bg-amber-500';
          case 'Green': return 'bg-emerald-500';
          default: return 'bg-slate-300';
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Modals */}
        <AutoFillModal 
            isOpen={showAutoFillModal}
            onClose={() => setShowAutoFillModal(false)}
            recentReportsByUser={reportsByUserForAutoFill}
            users={users}
            selectedReportIds={selectedReportIdsForFill}
            onToggleReport={handleToggleReportSelection}
            onConfirm={() => askLanguageThen((lang) => handleAutoFill(lang))}
            isFilling={isFilling}
        />

        <AiResultModal 
            isOpen={showSummaryModal}
            onClose={() => setShowSummaryModal(false)}
            title="Generated Email Draft"
            content={generatedEmail}
            isLoading={isGeneratingEmail}
            type="email"
        />

        <AiResultModal
            isOpen={showSynthesisModal}
            onClose={() => setShowSynthesisModal(false)}
            title="Manager Synthesis"
            content={synthesisResult}
            isLoading={isSynthesizing}
            type="synthesis"
        />

        <LanguagePickerModal
            isOpen={showLanguagePicker}
            onClose={() => { setShowLanguagePicker(false); setPendingLlmAction(null); }}
            onSelect={handleLanguageSelected}
        />

        {/* Header Tabs */}
        <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
            <button 
                onClick={() => setActiveTab('my-report')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'my-report' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Save className="w-4 h-4" /> My Report
            </button>
            <button 
                onClick={() => setActiveTab('team-reports')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'team-reports' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <History className="w-4 h-4" /> Recent Reports
            </button>
            <button 
                onClick={() => setActiveTab('archives')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'archives' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Archive className="w-4 h-4" /> Archives ({archivedReports.length})
            </button>
        </div>

        {activeTab === 'my-report' && (
            <div className="space-y-8">
                <WeeklyReportForm
                    report={currentReport}
                    currentUser={currentUser}
                    currentMonday={currentMonday}
                    onChange={handleUpdateCurrentReport}
                    onSave={handleSave}
                    onDelete={() => handleDelete(currentReport.id)}
                    onResetToCurrent={handleResetToCurrent}
                    onAutoFill={() => setShowAutoFillModal(true)}
                    onManagerSynthesis={() => askLanguageThen((lang) => handleManagerSynthesis(lang))}
                    onGenerateEmail={() => askLanguageThen((lang) => handleGenerateEmail(currentReport, lang))}
                    onSaveFeedback={isAdmin ? handleSaveFeedback : undefined}
                    isAdmin={isAdmin}
                    llmConfigured={!!llmConfig}
                />

                {/* History Table */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                         <History className="w-5 h-5 text-indigo-500" /> My History
                     </h3>
                     <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                         <table className="w-full text-sm text-left">
                             <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                 <tr>
                                     <th className="px-6 py-3">Week Of</th>
                                     <th className="px-6 py-3">Health (Team/Proj)</th>
                                     <th className="px-6 py-3 text-right">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                 {myHistory.map(report => (
                                     <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                         <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                             {report.weekOf}
                                             {report.weekOf === currentMonday && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Current</span>}
                                         </td>
                                         <td className="px-6 py-4">
                                             <div className="flex gap-2">
                                                 <div className={`w-3 h-3 rounded-full ${getHealthColor(report.teamHealth)}`} title={`Team: ${report.teamHealth || 'N/A'}`}></div>
                                                 <div className={`w-3 h-3 rounded-full ${getHealthColor(report.projectHealth)}`} title={`Project: ${report.projectHealth || 'N/A'}`}></div>
                                             </div>
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                             <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleLoadReport(report)}
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                                    title="Edit Report"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(report.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                             </div>
                                         </td>
                                     </tr>
                                 ))}
                                 {myHistory.length === 0 && (
                                     <tr>
                                         <td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic">
                                             No history found.
                                         </td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                </div>
            </div>
        )}

        {/* Tab 2: Recent Reports */}
        {activeTab === 'team-reports' && (
            <div className="grid grid-cols-1 gap-6 animate-in fade-in">
                {recentReports.map(report => (
                    <ReportCard
                        key={report.id}
                        report={report}
                        users={users}
                        currentUser={currentUser}
                        onGenerateEmail={() => askLanguageThen((lang) => handleGenerateEmail(report, lang))}
                        onDelete={() => handleDelete(report.id)}
                        onArchive={() => handleArchiveReport(report)}
                    />
                ))}
                {recentReports.length === 0 && <div className="text-center py-12 text-slate-500 dark:text-slate-400 italic">No recent reports found.</div>}
            </div>
        )}

        {/* Tab 3: Archives */}
        {activeTab === 'archives' && (
            <div className="grid grid-cols-1 gap-6 animate-in fade-in">
                {archivedReports.map(report => (
                    <ReportCard
                        key={report.id}
                        report={report}
                        users={users}
                        currentUser={currentUser}
                        onGenerateEmail={() => askLanguageThen((lang) => handleGenerateEmail(report, lang))}
                        onDelete={() => handleDelete(report.id)}
                        onUnarchive={() => handleUnarchiveReport(report)}
                    />
                ))}
                {archivedReports.length === 0 && <div className="text-center py-12 text-slate-500 dark:text-slate-400 italic">No archived reports found.</div>}
            </div>
        )}

    </div>
  );
};

export default WeeklyReport;
