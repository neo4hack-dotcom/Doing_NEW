
import React, { useState } from 'react';
import { Team, User, WeeklyReport, LLMConfig, Meeting, WorkingGroup, AppNotification, OneOffQuery } from '../types';
import { generateManagementInsight, generateRiskAssessment } from '../services/llmService';
import { Briefcase, CheckCircle2, ShieldAlert, Zap, LayoutList, Bell, Eye, ClipboardList, AlertTriangle, Clock, Search } from 'lucide-react';

import LanguagePickerModal from './LanguagePickerModal';
import ManagementStats from './management/ManagementStats';
import StaleProjectTracker from './management/StaleProjectTracker';
import TeamProjectList from './management/TeamProjectList';
import QuickCreateModal from './management/QuickCreateModal';
import ReviewReportModal from './management/ReviewReportModal';
import AiInsightModal from './management/AiInsightModal';

interface ManagementDashboardProps {
  teams: Team[];
  users: User[];
  reports: WeeklyReport[];
  meetings: Meeting[];
  workingGroups: WorkingGroup[];
  llmConfig?: LLMConfig;
  onUpdateReport: (report: WeeklyReport) => void;
  onUpdateTeam?: (team: Team) => void;
  notifications: AppNotification[];
  currentUserId: string;
  onMarkNotificationSeen: (notificationId: string) => void;
  oneOffQueries?: OneOffQuery[];
}

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ teams, users, reports, meetings, workingGroups, llmConfig, onUpdateReport, onUpdateTeam, notifications, currentUserId, onMarkNotificationSeen, oneOffQueries = [] }) => {
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // AI Insights State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [insightType, setInsightType] = useState<'synthesis' | 'risk'>('synthesis');

  // Quick Create State
  const [quickCreateMode, setQuickCreateMode] = useState<'none' | 'project' | 'task'>('none');

  // Language Picker State
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [pendingLlmAction, setPendingLlmAction] = useState<((lang: 'fr' | 'en') => void) | null>(null);

  // --- Global One-Off Query KPIs ---
  const activeGlobalQueries = oneOffQueries.filter(q => !q.archived && q.status !== 'cancelled');
  const globalQueryPending = activeGlobalQueries.filter(q => q.status === 'pending').length;
  const globalQueryInProgress = activeGlobalQueries.filter(q => q.status === 'in_progress').length;

  const askLanguageThen = (action: (lang: 'fr' | 'en') => void) => {
      setPendingLlmAction(() => action);
      setShowLanguagePicker(true);
  };
  const handleLanguageSelected = (lang: 'fr' | 'en') => {
      setShowLanguagePicker(false);
      if (pendingLlmAction) { pendingLlmAction(lang); setPendingLlmAction(null); }
  };

  // Filter admin notifications that haven't been seen
  const unseenNotifications = (notifications || []).filter(n =>
    n.targetRole === 'admin' && !(n.seenBy || []).includes(currentUserId)
  );

  const displayedNotifications = showAllNotifications ? unseenNotifications : unseenNotifications.slice(0, 5);

  const handleValidateReport = (report: WeeklyReport, annotation: string) => {
      onUpdateReport({
          ...report,
          managerCheck: true,
          managerAnnotation: annotation
      });
      setSelectedReport(null);
  };

  const handleGenerateInsight = () => {
      if (!llmConfig) return alert("AI not configured");
      askLanguageThen(async (lang) => {
          setIsAiLoading(true);
          setShowAiModal(true);
          setInsightType('synthesis');
          setAiInsight('');

          const activeTeams = teams.map(t => ({
              ...t,
              projects: t.projects.filter(p => !p.isArchived)
          }));

          const insight = await generateManagementInsight(activeTeams, reports, users, llmConfig, undefined, lang);
          setAiInsight(insight);
          setIsAiLoading(false);
      });
  };

  const handleManagerAdvice = () => {
      if (!llmConfig) return alert("AI not configured");
      askLanguageThen(async (lang) => {
          setIsAiLoading(true);
          setShowAiModal(true);
          setInsightType('risk');
          setAiInsight('');

          const activeTeams = teams.map(t => ({
              ...t,
              projects: t.projects.filter(p => !p.isArchived)
          }));

          const insight = await generateRiskAssessment(activeTeams, reports, users, llmConfig, lang);
          setAiInsight(insight);
          setIsAiLoading(false);
      });
  }

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'project_created':
      case 'project_updated':
        return <Briefcase className="w-4 h-4 text-indigo-500" />;
      case 'task_created':
      case 'task_updated':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'report_created':
      case 'report_updated':
        return <ClipboardList className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in relative pb-10">

        {/* GLOBAL ONE-OFF QUERIES KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-violet-100 dark:bg-violet-800/40 rounded-xl p-3 shrink-0">
              <Search className="w-6 h-6 text-violet-600 dark:text-violet-300" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-1">One-Off Queries en cours</p>
              <span className="text-4xl font-extrabold text-violet-700 dark:text-violet-200">{globalQueryPending + globalQueryInProgress}</span>
              <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">Tous utilisateurs confondus</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 shrink-0">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">En attente</p>
              <span className="text-4xl font-extrabold text-amber-600 dark:text-amber-400">{globalQueryPending}</span>
              <p className="text-xs text-slate-400 mt-1">Queries à traiter</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 shrink-0">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">En traitement</p>
              <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{globalQueryInProgress}</span>
              <p className="text-xs text-slate-400 mt-1">Queries en cours</p>
            </div>
          </div>
        </div>

        {/* NOTIFICATION CENTER (Admin) */}
        {unseenNotifications.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Activity Notifications</h3>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unseenNotifications.length}</span>
              </div>
              {unseenNotifications.length > 5 && (
                <button
                  onClick={() => setShowAllNotifications(!showAllNotifications)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {showAllNotifications ? 'Show less' : `Show all (${unseenNotifications.length})`}
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[300px] overflow-y-auto">
              {displayedNotifications.map(n => (
                <div key={n.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div>{getNotifIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium truncate">{n.message}</p>
                    {n.details && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{n.details}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatTime(n.createdAt)}</span>
                  <button
                    onClick={() => onMarkNotificationSeen(n.id)}
                    className="shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2.5 py-1.5 rounded-md transition-colors font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    Mark as seen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CROSS-FUNCTIONAL KPIs & ALERTS */}
        <ManagementStats
            teams={teams}
            meetings={meetings}
            workingGroups={workingGroups}
            reports={reports}
        />

        {/* STALE & URGENT PROJECT TRACKER */}
        <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Projects Requiring Attention
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">
                    — stale (&gt;2 weeks no update) or deadline within 1 week
                </span>
            </h3>
            <StaleProjectTracker teams={teams} />
        </div>

        {/* TEAM PROJECT LIST (Detailed View) */}
        <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-indigo-500" />
                Detailed Project Status
            </h3>
            <TeamProjectList teams={teams} />
        </div>

        {/* Quick Actions & AI Bar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between sticky bottom-4 shadow-lg z-20">
             <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-slate-500 uppercase tracking-wide mr-2">Quick Actions:</span>
                 <button
                    onClick={() => setQuickCreateMode('project')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm font-medium"
                 >
                     <Briefcase className="w-4 h-4" /> New Project
                 </button>
                 <button
                    onClick={() => setQuickCreateMode('task')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm font-medium"
                 >
                     <CheckCircle2 className="w-4 h-4" /> New Task
                 </button>
             </div>

             <div className="flex gap-3">
                <button
                    onClick={handleManagerAdvice}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                >
                    <ShieldAlert className="w-4 h-4 fill-current" />
                    Manager Advise
                </button>

                <button
                    onClick={handleGenerateInsight}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                >
                    <Zap className="w-4 h-4 fill-current" />
                    AI Team Synthesis
                </button>
             </div>
        </div>

        {/* --- MODALS --- */}

        <LanguagePickerModal
            isOpen={showLanguagePicker}
            onClose={() => setShowLanguagePicker(false)}
            onSelect={handleLanguageSelected}
        />

        <AiInsightModal
            isOpen={showAiModal}
            type={insightType}
            content={aiInsight}
            isLoading={isAiLoading}
            onClose={() => setShowAiModal(false)}
        />

        <QuickCreateModal
            isOpen={quickCreateMode !== 'none'}
            mode={quickCreateMode === 'project' ? 'project' : 'task'}
            onClose={() => setQuickCreateMode('none')}
            teams={teams}
            users={users}
            onUpdateTeam={onUpdateTeam}
        />

        {selectedReport && (
            <ReviewReportModal
                report={selectedReport}
                user={users.find(u => u.id === selectedReport.userId)}
                onClose={() => setSelectedReport(null)}
                onValidate={handleValidateReport}
            />
        )}

    </div>
  );
};

export default ManagementDashboard;
