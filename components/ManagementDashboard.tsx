
import React, { useState } from 'react';
import { Team, User, WeeklyReport, LLMConfig, Meeting, WorkingGroup } from '../types';
import { generateManagementInsight, generateRiskAssessment } from '../services/llmService';
import { Briefcase, CheckCircle2, ShieldAlert, Zap, LayoutList } from 'lucide-react';

import ManagementStats from './management/ManagementStats';
import TeamPortfolio from './management/TeamPortfolio';
import TeamProjectList from './management/TeamProjectList'; // Import new component
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
}

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ teams, users, reports, meetings, workingGroups, llmConfig, onUpdateReport, onUpdateTeam }) => {
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  // AI Insights State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [insightType, setInsightType] = useState<'synthesis' | 'risk'>('synthesis');

  // Quick Create State
  const [quickCreateMode, setQuickCreateMode] = useState<'none' | 'project' | 'task'>('none');

  const handleValidateReport = (report: WeeklyReport, annotation: string) => {
      onUpdateReport({
          ...report,
          managerCheck: true,
          managerAnnotation: annotation
      });
      setSelectedReport(null);
  };

  const handleGenerateInsight = async () => {
      if (!llmConfig) return alert("AI not configured");
      setIsAiLoading(true);
      setShowAiModal(true);
      setInsightType('synthesis');
      setAiInsight('');
      
      const activeTeams = teams.map(t => ({
          ...t,
          projects: t.projects.filter(p => !p.isArchived)
      }));

      const insight = await generateManagementInsight(activeTeams, reports, users, llmConfig);
      setAiInsight(insight);
      setIsAiLoading(false);
  };

  const handleManagerAdvice = async () => {
      if (!llmConfig) return alert("AI not configured");
      setIsAiLoading(true);
      setShowAiModal(true);
      setInsightType('risk');
      setAiInsight('');

      const activeTeams = teams.map(t => ({
          ...t,
          projects: t.projects.filter(p => !p.isArchived)
      }));

      const insight = await generateRiskAssessment(activeTeams, reports, users, llmConfig);
      setAiInsight(insight);
      setIsAiLoading(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in relative pb-10">
        
        {/* CROSS-FUNCTIONAL KPIs & ALERTS */}
        <ManagementStats 
            teams={teams} 
            meetings={meetings} 
            workingGroups={workingGroups} 
            reports={reports} 
        />

        {/* TEAM PORTFOLIO OVERVIEW */}
        <TeamPortfolio teams={teams} />

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
