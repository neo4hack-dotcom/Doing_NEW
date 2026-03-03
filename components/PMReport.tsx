
import React, { useState, useMemo } from 'react';
import {
  FileBarChart, Plus, Trash2, Save, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Shield, Megaphone, Target, Calendar,
  DollarSign, Users, ArrowRight, Sparkles, Download, Edit3, Eye, X,
  CircleDot, AlertCircle, Info, ChevronUp, BarChart3, PieChart, Activity
} from 'lucide-react';
import {
  Team, User, Project, LLMConfig, PMReportData, PMReportIncident,
  PMReportUpdate, PMReportNews, PMReportMilestone, PMReportRisk, RAGStatus
} from '../types';
import { generateId } from '../services/storage';
import { sendChatMessage } from '../services/llmService';

// ─── Props ───
interface PMReportProps {
  teams: Team[];
  users: User[];
  currentUser: User;
  llmConfig: LLMConfig;
  pmReportData: PMReportData[];
  onSavePMReport: (data: PMReportData) => void;
  onDeletePMReport: (id: string) => void;
}

// ─── Sub-views ───
type PMView = 'overview' | 'data-entry' | 'report-preview';

// ─── RAG Dot Component ───
const RAGDot: React.FC<{ status: RAGStatus; size?: 'sm' | 'md' | 'lg' }> = ({ status, size = 'md' }) => {
  const sizeMap = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const colorMap = {
    Green: 'bg-emerald-500 shadow-emerald-500/50',
    Amber: 'bg-amber-500 shadow-amber-500/50',
    Red: 'bg-red-500 shadow-red-500/50'
  };
  return <div className={`${sizeMap[size]} rounded-full ${colorMap[status]} shadow-md`} />;
};

// ─── RAG Badge Component ───
const RAGBadge: React.FC<{ status: RAGStatus; label: string }> = ({ status, label }) => {
  const colors = {
    Green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    Amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    Red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${colors[status]}`}>
      <RAGDot status={status} size="sm" />
      {label}
    </div>
  );
};

// ─── RAG Selector ───
const RAGSelector: React.FC<{ value: RAGStatus; onChange: (v: RAGStatus) => void; label?: string }> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">{label}</span>}
    {(['Green', 'Amber', 'Red'] as RAGStatus[]).map(s => (
      <button
        key={s}
        onClick={() => onChange(s)}
        className={`px-3 py-1 rounded-md text-xs font-bold border transition-all ${
          value === s
            ? s === 'Green' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' :
              s === 'Amber' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' :
              'bg-red-500 text-white border-red-600 shadow-sm'
            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
        }`}
      >
        {s}
      </button>
    ))}
  </div>
);

// ─── Empty Report Template ───
const createEmptyReport = (projectId: string, userId: string): PMReportData => ({
  id: generateId(),
  projectId,
  userId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  overallStatus: 'Green',
  scopeStatus: 'Green',
  scheduleStatus: 'Green',
  budgetStatus: 'Green',
  resourceStatus: 'Green',
  executiveSummary: '',
  keyDecisions: '',
  nextSteps: '',
  incidents: [],
  updates: [],
  news: [],
  milestones: [],
  risks: [],
  budgetAllocated: 0,
  budgetSpent: 0,
  budgetForecast: 0,
  overallCompletionPct: 0,
});

// ════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════
const PMReport: React.FC<PMReportProps> = ({
  teams, users, currentUser, llmConfig, pmReportData, onSavePMReport, onDeletePMReport
}) => {
  const [view, setView] = useState<PMView>('overview');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editingReport, setEditingReport] = useState<PMReportData | null>(null);
  const [generatedHTML, setGeneratedHTML] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    rag: true, summary: true, incidents: true, updates: true, news: true, milestones: true, risks: true, budget: true
  });

  // ─── Projects flat list ───
  const allProjects = useMemo(() => {
    const projects: (Project & { teamName: string })[] = [];
    teams.forEach(t => t.projects.forEach(p => {
      if (!p.isArchived) projects.push({ ...p, teamName: t.name });
    }));
    return projects;
  }, [teams]);

  // ─── Reports grouped by project ───
  const reportsByProject = useMemo(() => {
    const map: Record<string, PMReportData[]> = {};
    pmReportData.forEach(r => {
      if (!map[r.projectId]) map[r.projectId] = [];
      map[r.projectId].push(r);
    });
    return map;
  }, [pmReportData]);

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleProject = (id: string) => setSelectedProjectIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // ─── Start editing a report ───
  const handleEditReport = (projectId: string) => {
    const existing = pmReportData.find(r => r.projectId === projectId);
    setEditingReport(existing ? { ...existing } : createEmptyReport(projectId, currentUser.id));
    setView('data-entry');
  };

  // ─── Save current editing report ───
  const handleSave = () => {
    if (!editingReport) return;
    onSavePMReport({ ...editingReport, updatedAt: new Date().toISOString() });
    setView('overview');
    setEditingReport(null);
  };

  // ─── LLM generation of the one-pager ───
  const handleGenerateReport = async () => {
    if (selectedProjectIds.length === 0) return;
    setIsGenerating(true);
    try {
      const reportsForGeneration = selectedProjectIds.map(pid => {
        const report = pmReportData.find(r => r.projectId === pid);
        const project = allProjects.find(p => p.id === pid);
        return { project, report };
      }).filter(x => x.report && x.project);

      if (reportsForGeneration.length === 0) {
        setGeneratedHTML('<p class="text-red-500">No report data found for selected projects. Please fill in data first.</p>');
        setView('report-preview');
        setIsGenerating(false);
        return;
      }

      const dataPayload = reportsForGeneration.map(({ project, report }) => ({
        projectName: project!.name,
        teamName: project!.teamName,
        status: project!.status,
        deadline: project!.deadline,
        ...report
      }));

      const prompt = `You are an expert project management report designer. Generate a professional HTML one-pager executive status report for senior management based on the following project data.

IMPORTANT FORMATTING RULES:
- Use clean, modern HTML with inline CSS styles
- Use a professional color palette: #1e293b (dark text), #4f46e5 (indigo accent), #10b981 (green), #f59e0b (amber), #ef4444 (red)
- For RAG indicators, use colored circles: Green=#10b981, Amber=#f59e0b, Red=#ef4444
- Create visual progress bars for completion percentages
- Use tables with clean borders for milestones and risks
- Include clear section headers with borders
- Make it look like a premium consulting deck / professional status report
- Keep it concise but visually rich
- Do NOT use any JavaScript, only HTML and inline CSS
- Create clean cards/boxes for each major section
- If multiple projects, create a section per project with clear separators

SECTIONS TO INCLUDE:
1. Executive Summary with overall RAG status indicators (Overall, Scope, Schedule, Budget, Resources)
2. Key Metrics: completion %, budget utilization, milestone progress
3. Incidents table (if any) with severity and status
4. Key Updates with impact indicators
5. News & Achievements
6. Milestone Timeline / Gantt-style visual
7. Risk Register with likelihood/impact matrix
8. Budget Overview with visual bar
9. Key Decisions & Next Steps

PROJECT DATA:
${JSON.stringify(dataPayload, null, 2)}

Generate ONLY the HTML content (no <html>, <head>, or <body> tags - just the inner content starting with a div). Make it look absolutely stunning and professional.`;

      let responseText = '';
      try {
        responseText = await sendChatMessage([], prompt, llmConfig);
      } catch {
        // Fallback: generate a structured HTML report from the data directly
        responseText = generateFallbackHTML(reportsForGeneration as any);
      }

      // Extract HTML from response (in case LLM wraps it in markdown code blocks)
      const htmlMatch = responseText.match(/```html\s*([\s\S]*?)```/) || responseText.match(/```\s*([\s\S]*?)```/);
      setGeneratedHTML(htmlMatch ? htmlMatch[1].trim() : responseText);
      setView('report-preview');
    } catch (err) {
      console.error('Report generation failed:', err);
      setGeneratedHTML('<p style="color:red;">Report generation failed. Please check your LLM configuration.</p>');
      setView('report-preview');
    }
    setIsGenerating(false);
  };

  // ─── Fallback HTML when LLM is unavailable ───
  const generateFallbackHTML = (data: { project: Project & { teamName: string }; report: PMReportData }[]) => {
    const ragColor = (s: RAGStatus) => s === 'Green' ? '#10b981' : s === 'Amber' ? '#f59e0b' : '#ef4444';
    const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return `<div style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;max-width:1200px;margin:0 auto;color:#1e293b;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:24px;">
        <div>
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#1e293b;">Project Status Report</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Generated ${now}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Confidential</div>
        </div>
      </div>
      ${data.map(({ project, report }) => `
        <div style="margin-bottom:32px;page-break-inside:avoid;">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:16px 20px;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;font-size:18px;font-weight:700;">${project.name}</h2>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.85;">${project.teamName} | Deadline: ${project.deadline}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
            <!-- RAG Status Row -->
            <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
              ${['Overall', 'Scope', 'Schedule', 'Budget', 'Resource'].map(label => {
                const key = label === 'Overall' ? 'overallStatus' : label === 'Resource' ? 'resourceStatus' : `${label.toLowerCase()}Status`;
                const status = (report as any)[key] as RAGStatus;
                return `<div style="flex:1;min-width:120px;background:#f8fafc;border-radius:8px;padding:12px;text-align:center;border:1px solid #e2e8f0;">
                  <div style="width:20px;height:20px;border-radius:50%;background:${ragColor(status)};margin:0 auto 6px;box-shadow:0 0 8px ${ragColor(status)}40;"></div>
                  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
                </div>`;
              }).join('')}
            </div>
            <!-- Completion Bar -->
            <div style="margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:600;color:#374151;">Overall Completion</span>
                <span style="font-size:12px;font-weight:700;color:#4f46e5;">${report.overallCompletionPct}%</span>
              </div>
              <div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
                <div style="height:100%;width:${report.overallCompletionPct}%;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:5px;transition:width 0.3s;"></div>
              </div>
            </div>
            <!-- Executive Summary -->
            ${report.executiveSummary ? `
            <div style="background:#f0f9ff;border-left:4px solid #4f46e5;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
              <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e40af;">Executive Summary</h4>
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.5;">${report.executiveSummary}</p>
            </div>` : ''}
            <!-- Budget -->
            ${report.budgetAllocated ? `
            <div style="display:flex;gap:16px;margin-bottom:16px;">
              <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Allocated</div>
                <div style="font-size:18px;font-weight:700;color:#1e293b;">$${(report.budgetAllocated || 0).toLocaleString()}</div>
              </div>
              <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Spent</div>
                <div style="font-size:18px;font-weight:700;color:#f59e0b;">$${(report.budgetSpent || 0).toLocaleString()}</div>
              </div>
              <div style="flex:1;background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Forecast</div>
                <div style="font-size:18px;font-weight:700;color:${(report.budgetForecast || 0) > (report.budgetAllocated || 0) ? '#ef4444' : '#10b981'};">$${(report.budgetForecast || 0).toLocaleString()}</div>
              </div>
            </div>` : ''}
            <!-- Milestones -->
            ${report.milestones.length > 0 ? `
            <div style="margin-bottom:16px;">
              <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Milestones</h4>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;font-weight:600;">Milestone</th><th style="padding:8px;text-align:center;">Planned</th><th style="padding:8px;text-align:center;">Revised</th><th style="padding:8px;text-align:center;">Status</th><th style="padding:8px;text-align:center;">Progress</th></tr>
                ${report.milestones.map(m => `<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;">${m.name}</td>
                  <td style="padding:8px;text-align:center;">${m.plannedDate}</td>
                  <td style="padding:8px;text-align:center;">${m.revisedDate || '—'}</td>
                  <td style="padding:8px;text-align:center;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ragColor(m.status)};"></span></td>
                  <td style="padding:8px;text-align:center;">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
                      <div style="flex:1;max-width:80px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${m.completionPct}%;background:#4f46e5;border-radius:3px;"></div></div>
                      <span style="font-weight:600;">${m.completionPct}%</span>
                    </div>
                  </td>
                </tr>`).join('')}
              </table>
            </div>` : ''}
            <!-- Incidents -->
            ${report.incidents.length > 0 ? `
            <div style="margin-bottom:16px;">
              <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Incidents</h4>
              ${report.incidents.map(inc => `<div style="display:flex;align-items:start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:white;background:${inc.severity === 'Critical' ? '#ef4444' : inc.severity === 'Major' ? '#f59e0b' : '#64748b'};">${inc.severity}</span>
                <div style="flex:1;"><div style="font-size:12px;font-weight:600;">${inc.title}</div><div style="font-size:11px;color:#64748b;">${inc.description}</div></div>
                <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${inc.status === 'Resolved' ? '#d1fae5' : inc.status === 'Investigating' ? '#fef3c7' : '#fee2e2'};color:${inc.status === 'Resolved' ? '#065f46' : inc.status === 'Investigating' ? '#92400e' : '#991b1b'};font-weight:600;">${inc.status}</span>
              </div>`).join('')}
            </div>` : ''}
            <!-- Risks -->
            ${report.risks.length > 0 ? `
            <div style="margin-bottom:16px;">
              <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Risk Register</h4>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;font-weight:600;">Risk</th><th style="padding:8px;text-align:center;">Likelihood</th><th style="padding:8px;text-align:center;">Impact</th><th style="padding:8px;text-align:left;">Mitigation</th><th style="padding:8px;">Owner</th></tr>
                ${report.risks.map(r => `<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;">${r.description}</td>
                  <td style="padding:8px;text-align:center;"><span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:${r.likelihood === 'High' ? '#fee2e2' : r.likelihood === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${r.likelihood === 'High' ? '#991b1b' : r.likelihood === 'Medium' ? '#92400e' : '#065f46'};">${r.likelihood}</span></td>
                  <td style="padding:8px;text-align:center;"><span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:${r.impact === 'High' ? '#fee2e2' : r.impact === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${r.impact === 'High' ? '#991b1b' : r.impact === 'Medium' ? '#92400e' : '#065f46'};">${r.impact}</span></td>
                  <td style="padding:8px;font-size:11px;">${r.mitigation}</td>
                  <td style="padding:8px;font-size:11px;">${r.owner}</td>
                </tr>`).join('')}
              </table>
            </div>` : ''}
            <!-- Updates & News -->
            ${report.updates.length > 0 ? `
            <div style="margin-bottom:16px;">
              <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Updates</h4>
              ${report.updates.map(u => `<div style="display:flex;align-items:start;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-top:4px;background:${ragColor(u.impact)};flex-shrink:0;"></span>
                <div><span style="font-size:11px;font-weight:600;color:#4f46e5;background:#eef2ff;padding:1px 6px;border-radius:3px;">${u.category}</span> <span style="font-size:12px;font-weight:600;margin-left:4px;">${u.title}</span><div style="font-size:11px;color:#64748b;margin-top:2px;">${u.description}</div></div>
              </div>`).join('')}
            </div>` : ''}
            ${report.news.length > 0 ? `
            <div style="margin-bottom:16px;">
              <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">News & Achievements</h4>
              ${report.news.map(n => `<div style="display:flex;align-items:start;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px;background:${n.type === 'Achievement' ? '#d1fae5' : n.type === 'Change' ? '#fef3c7' : '#e0e7ff'};color:${n.type === 'Achievement' ? '#065f46' : n.type === 'Change' ? '#92400e' : '#3730a3'};">${n.type}</span>
                <div><div style="font-size:12px;font-weight:600;">${n.title}</div><div style="font-size:11px;color:#64748b;">${n.description}</div></div>
              </div>`).join('')}
            </div>` : ''}
            <!-- Next Steps -->
            ${report.nextSteps ? `
            <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:12px 16px;border-radius:0 8px 8px 0;">
              <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#065f46;">Next Steps</h4>
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.5;">${report.nextSteps}</p>
            </div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  };

  // ─── PDF Export (landscape) ───
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PM Status Report</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; background: white; padding: 20px; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 8px; text-align: left; }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print();window.close();" style="background:#4f46e5;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
      Print / Save as PDF
    </button>
    <button onclick="window.close();" style="margin-left:12px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;padding:12px 24px;border-radius:8px;font-size:14px;cursor:pointer;">
      Cancel
    </button>
  </div>
  ${generatedHTML}
</body>
</html>`);
    printWindow.document.close();
  };

  // ════════════════════════════════════════
  //  DATA ENTRY FORM
  // ════════════════════════════════════════
  const renderDataEntry = () => {
    if (!editingReport) return null;
    const project = allProjects.find(p => p.id === editingReport.projectId);

    const SectionHeader: React.FC<{ id: string; icon: React.ReactNode; title: string; count?: number }> = ({ id, icon, title, count }) => (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</span>
          {typeof count === 'number' && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">{count}</span>}
        </div>
        {expandedSections[id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
    );

    const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";
    const textareaClass = `${inputClass} resize-none`;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Data Entry: {project?.name || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Fill in project status data to generate the PM report</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setView('overview'); setEditingReport(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>

        {/* ─── RAG STATUS ─── */}
        <SectionHeader id="rag" icon={<CircleDot className="w-4 h-4 text-indigo-500" />} title="RAG Status" />
        {expandedSections.rag && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RAGSelector label="Overall" value={editingReport.overallStatus} onChange={v => setEditingReport({ ...editingReport, overallStatus: v })} />
              <RAGSelector label="Scope" value={editingReport.scopeStatus} onChange={v => setEditingReport({ ...editingReport, scopeStatus: v })} />
              <RAGSelector label="Schedule" value={editingReport.scheduleStatus} onChange={v => setEditingReport({ ...editingReport, scheduleStatus: v })} />
              <RAGSelector label="Budget" value={editingReport.budgetStatus} onChange={v => setEditingReport({ ...editingReport, budgetStatus: v })} />
              <RAGSelector label="Resource" value={editingReport.resourceStatus} onChange={v => setEditingReport({ ...editingReport, resourceStatus: v })} />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Complete</span>
                <input type="range" min={0} max={100} value={editingReport.overallCompletionPct}
                  onChange={e => setEditingReport({ ...editingReport, overallCompletionPct: parseInt(e.target.value) })}
                  className="flex-1 accent-indigo-600" />
                <span className="text-sm font-bold text-indigo-600 w-10 text-right">{editingReport.overallCompletionPct}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── EXECUTIVE SUMMARY ─── */}
        <SectionHeader id="summary" icon={<FileBarChart className="w-4 h-4 text-indigo-500" />} title="Summary & Decisions" />
        {expandedSections.summary && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Executive Summary</label>
              <textarea rows={3} className={textareaClass} value={editingReport.executiveSummary}
                onChange={e => setEditingReport({ ...editingReport, executiveSummary: e.target.value })}
                placeholder="Brief overview of project status for senior management..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Key Decisions</label>
              <textarea rows={2} className={textareaClass} value={editingReport.keyDecisions}
                onChange={e => setEditingReport({ ...editingReport, keyDecisions: e.target.value })}
                placeholder="Key decisions made or pending..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Next Steps</label>
              <textarea rows={2} className={textareaClass} value={editingReport.nextSteps}
                onChange={e => setEditingReport({ ...editingReport, nextSteps: e.target.value })}
                placeholder="Planned actions for the coming period..." />
            </div>
          </div>
        )}

        {/* ─── INCIDENTS ─── */}
        <SectionHeader id="incidents" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title="Incidents" count={editingReport.incidents.length} />
        {expandedSections.incidents && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.incidents.map((inc, idx) => (
              <div key={inc.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({
                  ...editingReport,
                  incidents: editingReport.incidents.filter(i => i.id !== inc.id)
                })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input className={inputClass} placeholder="Title" value={inc.title}
                    onChange={e => {
                      const newInc = [...editingReport.incidents];
                      newInc[idx] = { ...newInc[idx], title: e.target.value };
                      setEditingReport({ ...editingReport, incidents: newInc });
                    }} />
                  <input type="date" className={inputClass} value={inc.date}
                    onChange={e => {
                      const newInc = [...editingReport.incidents];
                      newInc[idx] = { ...newInc[idx], date: e.target.value };
                      setEditingReport({ ...editingReport, incidents: newInc });
                    }} />
                  <div className="flex gap-2">
                    <select className={inputClass} value={inc.severity}
                      onChange={e => {
                        const newInc = [...editingReport.incidents];
                        newInc[idx] = { ...newInc[idx], severity: e.target.value as any };
                        setEditingReport({ ...editingReport, incidents: newInc });
                      }}>
                      <option value="Critical">Critical</option>
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                    </select>
                    <select className={inputClass} value={inc.status}
                      onChange={e => {
                        const newInc = [...editingReport.incidents];
                        newInc[idx] = { ...newInc[idx], status: e.target.value as any };
                        setEditingReport({ ...editingReport, incidents: newInc });
                      }}>
                      <option value="Open">Open</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
                <textarea rows={2} className={textareaClass} placeholder="Description..." value={inc.description}
                  onChange={e => {
                    const newInc = [...editingReport.incidents];
                    newInc[idx] = { ...newInc[idx], description: e.target.value };
                    setEditingReport({ ...editingReport, incidents: newInc });
                  }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({
              ...editingReport,
              incidents: [...editingReport.incidents, { id: generateId(), date: new Date().toISOString().split('T')[0], title: '', description: '', severity: 'Minor', status: 'Open' }]
            })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add Incident
            </button>
          </div>
        )}

        {/* ─── UPDATES ─── */}
        <SectionHeader id="updates" icon={<TrendingUp className="w-4 h-4 text-blue-500" />} title="Updates" count={editingReport.updates.length} />
        {expandedSections.updates && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.updates.map((upd, idx) => (
              <div key={upd.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({
                  ...editingReport,
                  updates: editingReport.updates.filter(u => u.id !== upd.id)
                })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input className={inputClass} placeholder="Title" value={upd.title}
                    onChange={e => {
                      const arr = [...editingReport.updates];
                      arr[idx] = { ...arr[idx], title: e.target.value };
                      setEditingReport({ ...editingReport, updates: arr });
                    }} />
                  <input type="date" className={inputClass} value={upd.date}
                    onChange={e => {
                      const arr = [...editingReport.updates];
                      arr[idx] = { ...arr[idx], date: e.target.value };
                      setEditingReport({ ...editingReport, updates: arr });
                    }} />
                  <select className={inputClass} value={upd.category}
                    onChange={e => {
                      const arr = [...editingReport.updates];
                      arr[idx] = { ...arr[idx], category: e.target.value as any };
                      setEditingReport({ ...editingReport, updates: arr });
                    }}>
                    {['Scope', 'Timeline', 'Budget', 'Resource', 'Technical', 'Risk', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <RAGSelector value={upd.impact} onChange={v => {
                    const arr = [...editingReport.updates];
                    arr[idx] = { ...arr[idx], impact: v };
                    setEditingReport({ ...editingReport, updates: arr });
                  }} />
                </div>
                <textarea rows={2} className={textareaClass} placeholder="Description..." value={upd.description}
                  onChange={e => {
                    const arr = [...editingReport.updates];
                    arr[idx] = { ...arr[idx], description: e.target.value };
                    setEditingReport({ ...editingReport, updates: arr });
                  }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({
              ...editingReport,
              updates: [...editingReport.updates, { id: generateId(), date: new Date().toISOString().split('T')[0], category: 'Other', title: '', description: '', impact: 'Green' }]
            })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add Update
            </button>
          </div>
        )}

        {/* ─── NEWS ─── */}
        <SectionHeader id="news" icon={<Megaphone className="w-4 h-4 text-emerald-500" />} title="News & Achievements" count={editingReport.news.length} />
        {expandedSections.news && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.news.map((n, idx) => (
              <div key={n.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({
                  ...editingReport,
                  news: editingReport.news.filter(x => x.id !== n.id)
                })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input className={inputClass} placeholder="Title" value={n.title}
                    onChange={e => {
                      const arr = [...editingReport.news];
                      arr[idx] = { ...arr[idx], title: e.target.value };
                      setEditingReport({ ...editingReport, news: arr });
                    }} />
                  <input type="date" className={inputClass} value={n.date}
                    onChange={e => {
                      const arr = [...editingReport.news];
                      arr[idx] = { ...arr[idx], date: e.target.value };
                      setEditingReport({ ...editingReport, news: arr });
                    }} />
                  <select className={inputClass} value={n.type}
                    onChange={e => {
                      const arr = [...editingReport.news];
                      arr[idx] = { ...arr[idx], type: e.target.value as any };
                      setEditingReport({ ...editingReport, news: arr });
                    }}>
                    <option value="Achievement">Achievement</option>
                    <option value="Announcement">Announcement</option>
                    <option value="Change">Change</option>
                    <option value="Info">Info</option>
                  </select>
                </div>
                <textarea rows={2} className={textareaClass} placeholder="Description..." value={n.description}
                  onChange={e => {
                    const arr = [...editingReport.news];
                    arr[idx] = { ...arr[idx], description: e.target.value };
                    setEditingReport({ ...editingReport, news: arr });
                  }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({
              ...editingReport,
              news: [...editingReport.news, { id: generateId(), date: new Date().toISOString().split('T')[0], title: '', description: '', type: 'Info' }]
            })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add News
            </button>
          </div>
        )}

        {/* ─── MILESTONES ─── */}
        <SectionHeader id="milestones" icon={<Target className="w-4 h-4 text-purple-500" />} title="Milestones / Planning" count={editingReport.milestones.length} />
        {expandedSections.milestones && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.milestones.map((m, idx) => (
              <div key={m.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({
                  ...editingReport,
                  milestones: editingReport.milestones.filter(x => x.id !== m.id)
                })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <input className={`${inputClass} col-span-2`} placeholder="Milestone name" value={m.name}
                    onChange={e => {
                      const arr = [...editingReport.milestones];
                      arr[idx] = { ...arr[idx], name: e.target.value };
                      setEditingReport({ ...editingReport, milestones: arr });
                    }} />
                  <input type="date" className={inputClass} value={m.plannedDate} title="Planned date"
                    onChange={e => {
                      const arr = [...editingReport.milestones];
                      arr[idx] = { ...arr[idx], plannedDate: e.target.value };
                      setEditingReport({ ...editingReport, milestones: arr });
                    }} />
                  <input type="date" className={inputClass} value={m.revisedDate || ''} title="Revised date"
                    onChange={e => {
                      const arr = [...editingReport.milestones];
                      arr[idx] = { ...arr[idx], revisedDate: e.target.value || undefined };
                      setEditingReport({ ...editingReport, milestones: arr });
                    }} />
                  <RAGSelector value={m.status} onChange={v => {
                    const arr = [...editingReport.milestones];
                    arr[idx] = { ...arr[idx], status: v };
                    setEditingReport({ ...editingReport, milestones: arr });
                  }} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 min-w-[60px]">Progress</span>
                  <input type="range" min={0} max={100} value={m.completionPct}
                    onChange={e => {
                      const arr = [...editingReport.milestones];
                      arr[idx] = { ...arr[idx], completionPct: parseInt(e.target.value) };
                      setEditingReport({ ...editingReport, milestones: arr });
                    }}
                    className="flex-1 accent-indigo-600" />
                  <span className="text-sm font-bold text-indigo-600 w-10 text-right">{m.completionPct}%</span>
                </div>
              </div>
            ))}
            <button onClick={() => setEditingReport({
              ...editingReport,
              milestones: [...editingReport.milestones, { id: generateId(), name: '', plannedDate: '', status: 'Green', completionPct: 0 }]
            })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add Milestone
            </button>
          </div>
        )}

        {/* ─── RISKS ─── */}
        <SectionHeader id="risks" icon={<Shield className="w-4 h-4 text-orange-500" />} title="Risk Register" count={editingReport.risks.length} />
        {expandedSections.risks && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.risks.map((r, idx) => (
              <div key={r.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({
                  ...editingReport,
                  risks: editingReport.risks.filter(x => x.id !== r.id)
                })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input className={`${inputClass} col-span-2`} placeholder="Risk description" value={r.description}
                    onChange={e => {
                      const arr = [...editingReport.risks];
                      arr[idx] = { ...arr[idx], description: e.target.value };
                      setEditingReport({ ...editingReport, risks: arr });
                    }} />
                  <select className={inputClass} value={r.likelihood}
                    onChange={e => {
                      const arr = [...editingReport.risks];
                      arr[idx] = { ...arr[idx], likelihood: e.target.value as any };
                      setEditingReport({ ...editingReport, risks: arr });
                    }}>
                    <option value="Low">Likelihood: Low</option>
                    <option value="Medium">Likelihood: Medium</option>
                    <option value="High">Likelihood: High</option>
                  </select>
                  <select className={inputClass} value={r.impact}
                    onChange={e => {
                      const arr = [...editingReport.risks];
                      arr[idx] = { ...arr[idx], impact: e.target.value as any };
                      setEditingReport({ ...editingReport, risks: arr });
                    }}>
                    <option value="Low">Impact: Low</option>
                    <option value="Medium">Impact: Medium</option>
                    <option value="High">Impact: High</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <textarea rows={2} className={textareaClass} placeholder="Mitigation plan..." value={r.mitigation}
                    onChange={e => {
                      const arr = [...editingReport.risks];
                      arr[idx] = { ...arr[idx], mitigation: e.target.value };
                      setEditingReport({ ...editingReport, risks: arr });
                    }} />
                  <input className={inputClass} placeholder="Risk owner" value={r.owner}
                    onChange={e => {
                      const arr = [...editingReport.risks];
                      arr[idx] = { ...arr[idx], owner: e.target.value };
                      setEditingReport({ ...editingReport, risks: arr });
                    }} />
                </div>
              </div>
            ))}
            <button onClick={() => setEditingReport({
              ...editingReport,
              risks: [...editingReport.risks, { id: generateId(), description: '', likelihood: 'Medium', impact: 'Medium', mitigation: '', owner: '' }]
            })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add Risk
            </button>
          </div>
        )}

        {/* ─── BUDGET ─── */}
        <SectionHeader id="budget" icon={<DollarSign className="w-4 h-4 text-green-500" />} title="Budget" />
        {expandedSections.budget && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Allocated</label>
                <input type="number" className={inputClass} value={editingReport.budgetAllocated || ''}
                  onChange={e => setEditingReport({ ...editingReport, budgetAllocated: parseFloat(e.target.value) || 0 })}
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Spent</label>
                <input type="number" className={inputClass} value={editingReport.budgetSpent || ''}
                  onChange={e => setEditingReport({ ...editingReport, budgetSpent: parseFloat(e.target.value) || 0 })}
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Forecast</label>
                <input type="number" className={inputClass} value={editingReport.budgetForecast || ''}
                  onChange={e => setEditingReport({ ...editingReport, budgetForecast: parseFloat(e.target.value) || 0 })}
                  placeholder="0" />
              </div>
            </div>
            {(editingReport.budgetAllocated || 0) > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                  <span>Budget Utilization</span>
                  <span className="font-bold text-indigo-600">{Math.round(((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) > 0.9
                        ? 'bg-red-500' : ((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) > 0.7
                        ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.round(((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════
  //  REPORT PREVIEW
  // ════════════════════════════════════════
  const renderReportPreview = () => (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-500" />
            Report Preview
          </h2>
          <p className="text-sm text-gray-500 mt-1">Review before exporting to PDF</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('overview')}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Back
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md">
            <Download className="w-4 h-4" /> Export PDF (Landscape)
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm overflow-auto" style={{ aspectRatio: '297/210', maxHeight: '70vh' }}>
        <div dangerouslySetInnerHTML={{ __html: generatedHTML }} />
      </div>
    </div>
  );

  // ════════════════════════════════════════
  //  OVERVIEW (main page)
  // ════════════════════════════════════════
  const renderOverview = () => (
    <div className="max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileBarChart className="w-5 h-5 text-white" />
              </div>
              PM Report
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Generate professional project status reports for senior management
            </p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={selectedProjectIds.length === 0 || isGenerating}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${
              selectedProjectIds.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg'
            }`}
          >
            {isGenerating ? (
              <><Activity className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Report ({selectedProjectIds.length})</>
            )}
          </button>
        </div>
      </div>

      {/* Instruction Banner */}
      <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800 dark:text-indigo-300">
          <span className="font-bold">How it works:</span> 1) Select projects below 2) Click "Edit Data" to fill in status data 3) Select projects and click "Generate Report" to create a one-pager 4) Export to landscape PDF
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allProjects.map(project => {
          const report = pmReportData.find(r => r.projectId === project.id);
          const isSelected = selectedProjectIds.includes(project.id);
          const tasksTotal = project.tasks.length;
          const tasksDone = project.tasks.filter(t => t.status === 'Done').length;

          return (
            <div
              key={project.id}
              className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 p-5 transition-all cursor-pointer hover:shadow-md ${
                isSelected
                  ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
              onClick={() => toggleProject(project.id)}
            >
              {/* Selection indicator */}
              <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'
              }`}>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>

              {/* Project header */}
              <div className="flex items-start gap-3 mb-3 pr-8">
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${
                  project.status === 'Active' ? 'bg-emerald-500' :
                  project.status === 'Planning' ? 'bg-blue-500' :
                  project.status === 'Paused' ? 'bg-amber-500' : 'bg-gray-400'
                }`} />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{project.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{project.teamName} &bull; {project.status}</p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {project.deadline}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {project.members.length}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {tasksDone}/{tasksTotal}
                </span>
              </div>

              {/* Report status */}
              {report ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RAGDot status={report.overallStatus} size="sm" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Updated: {new Date(report.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleEditReport(project.id); }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Data
                  </button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); handleEditReport(project.id); }}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Report Data
                </button>
              )}
            </div>
          );
        })}
      </div>

      {allProjects.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No projects available</p>
          <p className="text-sm mt-1">Projects will appear here once they are created</p>
        </div>
      )}
    </div>
  );

  // ─── Main render ───
  return (
    <div>
      {view === 'overview' && renderOverview()}
      {view === 'data-entry' && renderDataEntry()}
      {view === 'report-preview' && renderReportPreview()}
    </div>
  );
};

export default PMReport;
