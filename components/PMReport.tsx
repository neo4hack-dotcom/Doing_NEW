
import React, { useState, useMemo } from 'react';
import {
  FileBarChart, Plus, Trash2, Save, ChevronDown, AlertTriangle,
  CheckCircle2, TrendingUp, Shield, Megaphone, Target, Calendar,
  DollarSign, Users, Sparkles, Download, Edit3, Eye,
  CircleDot, Info, ChevronUp, Activity, Copy, History, Tag
} from 'lucide-react';
import {
  Team, User, Project, LLMConfig, PMReportData,
  RAGStatus
} from '../types';
import { generateId } from '../services/storage';
import { generatePMReportHTML } from '../services/llmService';

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

type PMView = 'overview' | 'data-entry' | 'report-preview';

// ─── RAG helpers ───
const RAGDot: React.FC<{ status: RAGStatus; size?: 'sm' | 'md' | 'lg' }> = ({ status, size = 'md' }) => {
  const s = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' }[size];
  const c = { Green: 'bg-emerald-500 shadow-emerald-500/50', Amber: 'bg-amber-500 shadow-amber-500/50', Red: 'bg-red-500 shadow-red-500/50' }[status];
  return <div className={`${s} rounded-full ${c} shadow-md`} />;
};

const RAGSelector: React.FC<{ value: RAGStatus; onChange: (v: RAGStatus) => void; label?: string }> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">{label}</span>}
    {(['Green', 'Amber', 'Red'] as RAGStatus[]).map(s => (
      <button key={s} onClick={() => onChange(s)}
        className={`px-3 py-1 rounded-md text-xs font-bold border transition-all ${
          value === s
            ? s === 'Green' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' :
              s === 'Amber' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' :
              'bg-red-500 text-white border-red-600 shadow-sm'
            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
        }`}>{s}</button>
    ))}
  </div>
);

const createEmptyReport = (projectId: string, userId: string, version: number = 1): PMReportData => ({
  id: generateId(), projectId, userId,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  version, versionLabel: `v${version} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  overallStatus: 'Green', scopeStatus: 'Green', scheduleStatus: 'Green', budgetStatus: 'Green', resourceStatus: 'Green',
  executiveSummary: '', keyDecisions: '', nextSteps: '',
  incidents: [], updates: [], news: [], milestones: [], risks: [],
  budgetAllocated: 0, budgetSpent: 0, budgetForecast: 0, overallCompletionPct: 0,
});

const cloneReport = (src: PMReportData, newVersion: number): PMReportData => ({
  ...JSON.parse(JSON.stringify(src)),
  id: generateId(),
  version: newVersion,
  versionLabel: `v${newVersion} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ════════════════════════════════════════
//  FALLBACK HTML GENERATOR (consulting-deck style)
// ════════════════════════════════════════
const buildConsultingDeckHTML = (data: { project: Project & { teamName: string }; report: PMReportData }[]) => {
  const rc = (s: RAGStatus) => s === 'Green' ? '#10b981' : s === 'Amber' ? '#f59e0b' : '#ef4444';
  const rcBg = (s: RAGStatus) => s === 'Green' ? '#ecfdf5' : s === 'Amber' ? '#fffbeb' : '#fef2f2';
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const css = `
    <style>
      .deck{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;max-width:1140px;margin:0 auto}
      .deck *{box-sizing:border-box}
      .deck-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #4f46e5;padding-bottom:14px;margin-bottom:28px}
      .deck-header h1{margin:0;font-size:26px;font-weight:800;background:linear-gradient(135deg,#4f46e5,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .deck-header .sub{font-size:12px;color:#64748b;margin-top:4px}
      .deck-header .conf{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700}
      .prj-banner{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#9333ea 100%);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center}
      .prj-banner h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px}
      .prj-banner .meta{font-size:11px;opacity:.8;margin-top:3px}
      .prj-banner .pct{font-size:28px;font-weight:800;letter-spacing:-1px}
      .prj-banner .pct-label{font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:1px}
      .prj-body{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:24px;background:#fff;margin-bottom:32px}
      .rag-row{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap}
      .rag-card{flex:1;min-width:100px;text-align:center;padding:14px 8px;border-radius:10px;border:1px solid #e2e8f0;background:#fafbfc}
      .rag-circle{width:24px;height:24px;border-radius:50%;margin:0 auto 8px;box-shadow:0 0 12px rgba(0,0,0,.15)}
      .rag-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.7px}
      .progress-wrap{margin-bottom:22px}
      .progress-bar-outer{height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden}
      .progress-bar-inner{height:100%;border-radius:6px;background:linear-gradient(90deg,#4f46e5,#7c3aed);transition:width .3s}
      .progress-label{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px}
      .section-title{font-size:14px;font-weight:700;color:#1e293b;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px}
      .section-title .dot{width:8px;height:8px;border-radius:50%;background:#4f46e5}
      .card-summary{padding:14px 18px;border-radius:10px;margin-bottom:18px;font-size:12px;line-height:1.6;color:#334155}
      .card-blue{background:#eff6ff;border-left:4px solid #4f46e5}
      .card-green{background:#f0fdf4;border-left:4px solid #10b981}
      .card-amber{background:#fffbeb;border-left:4px solid #f59e0b}
      .metric-row{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}
      .metric-box{flex:1;min-width:120px;background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #e2e8f0;text-align:center}
      .metric-label{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px}
      .metric-value{font-size:22px;font-weight:800;margin-top:4px}
      table.deck-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;margin-bottom:18px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
      table.deck-table th{background:#f1f5f9;padding:10px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#475569}
      table.deck-table td{padding:10px 12px;border-top:1px solid #f1f5f9}
      table.deck-table tr:hover td{background:#fafbfc}
      .severity-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:#fff}
      .sev-critical{background:#ef4444}.sev-major{background:#f59e0b}.sev-minor{background:#64748b}
      .status-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
      .likelihood-badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600}
      .update-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9}
      .update-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}
      .cat-tag{font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:#eef2ff;color:#4f46e5}
      .news-type{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px}
    </style>`;

  const projectBlocks = data.map(({ project, report }) => {
    const budgetPct = (report.budgetAllocated || 0) > 0 ? Math.round(((report.budgetSpent || 0) / (report.budgetAllocated || 1)) * 100) : 0;

    return `
    <div style="page-break-inside:avoid;">
      <div class="prj-banner">
        <div>
          <h2>${project.name}</h2>
          <div class="meta">${project.teamName} &bull; ${project.status} &bull; Deadline: ${project.deadline} &bull; v${report.version}</div>
        </div>
        <div style="text-align:right">
          <div class="pct">${report.overallCompletionPct}%</div>
          <div class="pct-label">Complete</div>
        </div>
      </div>
      <div class="prj-body">
        <!-- RAG STATUS -->
        <div class="rag-row">
          ${['Overall', 'Scope', 'Schedule', 'Budget', 'Resource'].map(label => {
            const key = label === 'Overall' ? 'overallStatus' : label === 'Resource' ? 'resourceStatus' : `${label.toLowerCase()}Status`;
            const st = (report as any)[key] as RAGStatus;
            return `<div class="rag-card" style="background:${rcBg(st)}">
              <div class="rag-circle" style="background:${rc(st)}"></div>
              <div class="rag-label">${label}</div>
            </div>`;
          }).join('')}
        </div>

        <!-- PROGRESS BAR -->
        <div class="progress-wrap">
          <div class="progress-label"><span>Overall Progress</span><span style="color:#4f46e5">${report.overallCompletionPct}%</span></div>
          <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${report.overallCompletionPct}%"></div></div>
        </div>

        <!-- EXECUTIVE SUMMARY -->
        ${report.executiveSummary ? `<div class="card-summary card-blue"><strong style="color:#1e40af">Executive Summary</strong><br/>${report.executiveSummary}</div>` : ''}

        <!-- BUDGET METRICS -->
        ${(report.budgetAllocated || 0) > 0 ? `
        <div class="section-title"><div class="dot"></div>Budget Overview</div>
        <div class="metric-row">
          <div class="metric-box"><div class="metric-label">Allocated</div><div class="metric-value" style="color:#1e293b">$${(report.budgetAllocated || 0).toLocaleString()}</div></div>
          <div class="metric-box"><div class="metric-label">Spent</div><div class="metric-value" style="color:#f59e0b">$${(report.budgetSpent || 0).toLocaleString()}</div></div>
          <div class="metric-box"><div class="metric-label">Forecast</div><div class="metric-value" style="color:${(report.budgetForecast || 0) > (report.budgetAllocated || 0) ? '#ef4444' : '#10b981'}">$${(report.budgetForecast || 0).toLocaleString()}</div></div>
          <div class="metric-box"><div class="metric-label">Utilization</div>
            <div class="metric-value" style="color:${budgetPct > 90 ? '#ef4444' : budgetPct > 70 ? '#f59e0b' : '#10b981'}">${budgetPct}%</div>
          </div>
        </div>` : ''}

        <!-- MILESTONES -->
        ${report.milestones.length > 0 ? `
        <div class="section-title"><div class="dot"></div>Milestone Tracker</div>
        <table class="deck-table">
          <tr><th>Milestone</th><th style="text-align:center">Planned</th><th style="text-align:center">Revised</th><th style="text-align:center">Status</th><th style="text-align:center;width:160px">Progress</th></tr>
          ${report.milestones.map(m => `<tr>
            <td style="font-weight:600">${m.name}</td>
            <td style="text-align:center;font-size:11px">${m.plannedDate}</td>
            <td style="text-align:center;font-size:11px;${m.revisedDate && m.revisedDate > m.plannedDate ? 'color:#ef4444;font-weight:700' : ''}">${m.revisedDate || '—'}</td>
            <td style="text-align:center"><div style="width:14px;height:14px;border-radius:50%;background:${rc(m.status)};margin:0 auto;box-shadow:0 0 6px ${rc(m.status)}40"></div></td>
            <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden"><div style="height:100%;width:${m.completionPct}%;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:4px"></div></div><span style="font-size:11px;font-weight:700;color:#4f46e5;min-width:32px;text-align:right">${m.completionPct}%</span></div></td>
          </tr>`).join('')}
        </table>` : ''}

        <!-- INCIDENTS -->
        ${report.incidents.length > 0 ? `
        <div class="section-title"><div class="dot" style="background:#ef4444"></div>Incidents</div>
        <table class="deck-table">
          <tr><th style="width:80px">Severity</th><th>Incident</th><th style="width:200px">Description</th><th style="width:90px">Status</th><th style="width:90px">Date</th></tr>
          ${report.incidents.map(inc => `<tr>
            <td><span class="severity-badge sev-${inc.severity.toLowerCase()}">${inc.severity}</span></td>
            <td style="font-weight:600">${inc.title}</td>
            <td style="font-size:11px;color:#64748b">${inc.description}</td>
            <td><span class="status-badge" style="background:${inc.status === 'Resolved' ? '#d1fae5' : inc.status === 'Investigating' ? '#fef3c7' : '#fee2e2'};color:${inc.status === 'Resolved' ? '#065f46' : inc.status === 'Investigating' ? '#92400e' : '#991b1b'}">${inc.status}</span></td>
            <td style="font-size:11px;color:#64748b">${inc.date}</td>
          </tr>`).join('')}
        </table>` : ''}

        <!-- RISKS -->
        ${report.risks.length > 0 ? `
        <div class="section-title"><div class="dot" style="background:#f59e0b"></div>Risk Register</div>
        <table class="deck-table">
          <tr><th>Risk</th><th style="width:85px;text-align:center">Likelihood</th><th style="width:85px;text-align:center">Impact</th><th>Mitigation</th><th style="width:90px">Owner</th></tr>
          ${report.risks.map(r => `<tr>
            <td style="font-weight:600">${r.description}</td>
            <td style="text-align:center"><span class="likelihood-badge" style="background:${r.likelihood === 'High' ? '#fee2e2' : r.likelihood === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${r.likelihood === 'High' ? '#991b1b' : r.likelihood === 'Medium' ? '#92400e' : '#065f46'}">${r.likelihood}</span></td>
            <td style="text-align:center"><span class="likelihood-badge" style="background:${r.impact === 'High' ? '#fee2e2' : r.impact === 'Medium' ? '#fef3c7' : '#d1fae5'};color:${r.impact === 'High' ? '#991b1b' : r.impact === 'Medium' ? '#92400e' : '#065f46'}">${r.impact}</span></td>
            <td style="font-size:11px;color:#475569">${r.mitigation}</td>
            <td style="font-size:11px;font-weight:600">${r.owner}</td>
          </tr>`).join('')}
        </table>` : ''}

        <!-- UPDATES -->
        ${report.updates.length > 0 ? `
        <div class="section-title"><div class="dot" style="background:#3b82f6"></div>Key Updates</div>
        <div style="margin-bottom:18px">
          ${report.updates.map(u => `<div class="update-item">
            <div class="update-dot" style="background:${rc(u.impact)}"></div>
            <div><span class="cat-tag">${u.category}</span> <span style="font-size:12px;font-weight:600;margin-left:4px">${u.title}</span><div style="font-size:11px;color:#64748b;margin-top:3px">${u.description}</div></div>
          </div>`).join('')}
        </div>` : ''}

        <!-- NEWS -->
        ${report.news.length > 0 ? `
        <div class="section-title"><div class="dot" style="background:#10b981"></div>News & Achievements</div>
        <div style="margin-bottom:18px">
          ${report.news.map(n => `<div class="update-item">
            <span class="news-type" style="background:${n.type === 'Achievement' ? '#d1fae5' : n.type === 'Change' ? '#fef3c7' : '#e0e7ff'};color:${n.type === 'Achievement' ? '#065f46' : n.type === 'Change' ? '#92400e' : '#3730a3'}">${n.type}</span>
            <div><div style="font-size:12px;font-weight:600">${n.title}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${n.description}</div></div>
          </div>`).join('')}
        </div>` : ''}

        <!-- KEY DECISIONS & NEXT STEPS -->
        ${report.keyDecisions ? `<div class="card-summary card-amber"><strong style="color:#92400e">Key Decisions</strong><br/>${report.keyDecisions}</div>` : ''}
        ${report.nextSteps ? `<div class="card-summary card-green"><strong style="color:#065f46">Next Steps</strong><br/>${report.nextSteps}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `${css}<div class="deck">
    <div class="deck-header">
      <div><h1>Project Status Report</h1><div class="sub">Generated ${now} &bull; ${data.length} project${data.length > 1 ? 's' : ''}</div></div>
      <div style="text-align:right"><div class="conf">Confidential</div></div>
    </div>
    ${projectBlocks}
  </div>`;
};

// ════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════
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
  const [versionPanelProject, setVersionPanelProject] = useState<string | null>(null);

  const allProjects = useMemo(() => {
    const projects: (Project & { teamName: string })[] = [];
    teams.forEach(t => t.projects.forEach(p => {
      if (!p.isArchived) projects.push({ ...p, teamName: t.name });
    }));
    return projects;
  }, [teams]);

  const getProjectVersions = (projectId: string): PMReportData[] => {
    return pmReportData
      .filter(r => r.projectId === projectId)
      .sort((a, b) => (b.version || 1) - (a.version || 1));
  };

  const getLatestVersion = (projectId: string): PMReportData | undefined => {
    const versions = getProjectVersions(projectId);
    return versions[0];
  };

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleProject = (id: string) => setSelectedProjectIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // ─── Start editing a specific version ───
  const handleEditVersion = (report: PMReportData) => {
    setEditingReport({ ...report });
    setVersionPanelProject(null);
    setView('data-entry');
  };

  // ─── Create a new version from the latest one (or blank) ───
  const handleNewVersion = (projectId: string) => {
    const latest = getLatestVersion(projectId);
    const newVersion = latest ? (latest.version || 1) + 1 : 1;
    const newReport = latest
      ? cloneReport(latest, newVersion)
      : createEmptyReport(projectId, currentUser.id, newVersion);
    setEditingReport(newReport);
    setVersionPanelProject(null);
    setView('data-entry');
  };

  // ─── Quick edit: go to latest version for a project ───
  const handleEditReport = (projectId: string) => {
    const latest = getLatestVersion(projectId);
    if (latest) {
      handleEditVersion(latest);
    } else {
      handleNewVersion(projectId);
    }
  };

  const handleSave = () => {
    if (!editingReport) return;
    const toSave = { ...editingReport, updatedAt: new Date().toISOString() };
    if (!toSave.version) toSave.version = 1;
    if (!toSave.versionLabel) toSave.versionLabel = `v${toSave.version}`;
    onSavePMReport(toSave);
    setView('overview');
    setEditingReport(null);
  };

  // ─── Report generation ───
  const handleGenerateReport = async () => {
    if (selectedProjectIds.length === 0) return;
    setIsGenerating(true);
    try {
      const reportsForGeneration = selectedProjectIds.map(pid => {
        const report = getLatestVersion(pid);
        const project = allProjects.find(p => p.id === pid);
        return { project, report };
      }).filter(x => x.report && x.project) as { project: Project & { teamName: string }; report: PMReportData }[];

      if (reportsForGeneration.length === 0) {
        setGeneratedHTML('<p style="color:#ef4444;font-family:sans-serif;padding:20px;">No report data found for selected projects. Please fill in data first.</p>');
        setView('report-preview');
        setIsGenerating(false);
        return;
      }

      const dataPayload = reportsForGeneration.map(({ project, report }) => ({
        projectName: project.name, teamName: project.teamName,
        status: project.status, deadline: project.deadline, ...report
      }));

      const prompt = `You are an expert executive report designer. Generate ONLY raw HTML (no markdown, no code fences) for a professional project status one-pager.

CRITICAL OUTPUT RULES:
- Output ONLY HTML. Start with <style> or <div>. Do NOT wrap in \`\`\` or markdown.
- Use <style> tags with classes for styling (NOT inline styles everywhere).
- Use a clean color palette: #1e293b, #4f46e5, #10b981, #f59e0b, #ef4444.
- RAG circles: colored divs (Green=#10b981, Amber=#f59e0b, Red=#ef4444).
- Progress bars as nested divs with percentage width.
- Tables with clean headers for milestones/risks.
- Cards with colored left borders for summaries.
- Professional typography, proper spacing, consulting-deck quality.
- NO JavaScript. NO <html>/<head>/<body> tags.

SECTIONS: Executive Summary with RAG indicators (Overall/Scope/Schedule/Budget/Resource), Completion bar, Budget metrics, Milestones table, Incidents table, Risk Register, Updates, News, Key Decisions, Next Steps.

DATA:
${JSON.stringify(dataPayload, null, 2)}`;

      let html = '';
      try {
        html = await generatePMReportHTML(prompt, llmConfig);
        // Strip markdown code fences if present
        const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (fenceMatch) html = fenceMatch[1].trim();
        // Basic sanity: if result has no HTML tags at all, use fallback
        if (!/<[a-z][\s\S]*>/i.test(html)) throw new Error('No HTML in response');
      } catch {
        html = buildConsultingDeckHTML(reportsForGeneration);
      }
      setGeneratedHTML(html);
      setView('report-preview');
    } catch (err) {
      console.error('Report generation failed:', err);
      setGeneratedHTML('<p style="color:#ef4444;font-family:sans-serif;padding:20px;">Report generation failed. Please check your LLM configuration.</p>');
      setView('report-preview');
    }
    setIsGenerating(false);
  };

  // ─── PDF Export ───
  const handleExportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>PM Status Report</title>
<style>@page{size:landscape;margin:12mm}@media print{body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.no-print{display:none!important}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;background:#fff;padding:20px;font-size:12px}</style>
</head><body>
<div class="no-print" style="text-align:center;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,.3)">Print / Save as PDF</button>
  <button onclick="window.close()" style="margin-left:14px;background:#fff;color:#374151;border:1px solid #d1d5db;padding:14px 28px;border-radius:10px;font-size:15px;cursor:pointer">Cancel</button>
  <p style="margin-top:10px;font-size:12px;color:#64748b">Use your browser's print dialog to save as PDF in landscape orientation</p>
</div>${generatedHTML}</body></html>`);
    w.document.close();
  };

  // ════════════════════════════════════════
  //  DATA ENTRY FORM
  // ════════════════════════════════════════
  const renderDataEntry = () => {
    if (!editingReport) return null;
    const project = allProjects.find(p => p.id === editingReport.projectId);

    const SectionHeader: React.FC<{ id: string; icon: React.ReactNode; title: string; count?: number }> = ({ id, icon, title, count }) => (
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</span>
          {typeof count === 'number' && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">{count}</span>}
        </div>
        {expandedSections[id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
    );

    const ic = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";
    const tc = `${ic} resize-none`;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              {project?.name || 'Unknown'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">Version {editingReport.version || 1}</span>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">{editingReport.versionLabel}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setView('overview'); setEditingReport(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>

        {/* VERSION LABEL */}
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Version Label</label>
          <input className={ic} value={editingReport.versionLabel} onChange={e => setEditingReport({ ...editingReport, versionLabel: e.target.value })} placeholder="e.g. v3 — Sprint 12 Closing" />
        </div>

        {/* RAG */}
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
                <input type="range" min={0} max={100} value={editingReport.overallCompletionPct} onChange={e => setEditingReport({ ...editingReport, overallCompletionPct: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
                <span className="text-sm font-bold text-indigo-600 w-10 text-right">{editingReport.overallCompletionPct}%</span>
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY */}
        <SectionHeader id="summary" icon={<FileBarChart className="w-4 h-4 text-indigo-500" />} title="Summary & Decisions" />
        {expandedSections.summary && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
            <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Executive Summary</label>
              <textarea rows={3} className={tc} value={editingReport.executiveSummary} onChange={e => setEditingReport({ ...editingReport, executiveSummary: e.target.value })} placeholder="Brief overview of project status for senior management..." /></div>
            <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Key Decisions</label>
              <textarea rows={2} className={tc} value={editingReport.keyDecisions} onChange={e => setEditingReport({ ...editingReport, keyDecisions: e.target.value })} placeholder="Key decisions made or pending..." /></div>
            <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Next Steps</label>
              <textarea rows={2} className={tc} value={editingReport.nextSteps} onChange={e => setEditingReport({ ...editingReport, nextSteps: e.target.value })} placeholder="Planned actions for the coming period..." /></div>
          </div>
        )}

        {/* INCIDENTS */}
        <SectionHeader id="incidents" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title="Incidents" count={editingReport.incidents.length} />
        {expandedSections.incidents && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.incidents.map((inc, idx) => (
              <div key={inc.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({ ...editingReport, incidents: editingReport.incidents.filter(i => i.id !== inc.id) })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input className={ic} placeholder="Title" value={inc.title} onChange={e => { const a = [...editingReport.incidents]; a[idx] = { ...a[idx], title: e.target.value }; setEditingReport({ ...editingReport, incidents: a }); }} />
                  <input type="date" className={ic} value={inc.date} onChange={e => { const a = [...editingReport.incidents]; a[idx] = { ...a[idx], date: e.target.value }; setEditingReport({ ...editingReport, incidents: a }); }} />
                  <div className="flex gap-2">
                    <select className={ic} value={inc.severity} onChange={e => { const a = [...editingReport.incidents]; a[idx] = { ...a[idx], severity: e.target.value as any }; setEditingReport({ ...editingReport, incidents: a }); }}><option>Critical</option><option>Major</option><option>Minor</option></select>
                    <select className={ic} value={inc.status} onChange={e => { const a = [...editingReport.incidents]; a[idx] = { ...a[idx], status: e.target.value as any }; setEditingReport({ ...editingReport, incidents: a }); }}><option>Open</option><option>Investigating</option><option>Resolved</option></select>
                  </div>
                </div>
                <textarea rows={2} className={tc} placeholder="Description..." value={inc.description} onChange={e => { const a = [...editingReport.incidents]; a[idx] = { ...a[idx], description: e.target.value }; setEditingReport({ ...editingReport, incidents: a }); }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({ ...editingReport, incidents: [...editingReport.incidents, { id: generateId(), date: new Date().toISOString().split('T')[0], title: '', description: '', severity: 'Minor', status: 'Open' }] })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center"><Plus className="w-4 h-4" /> Add Incident</button>
          </div>
        )}

        {/* UPDATES */}
        <SectionHeader id="updates" icon={<TrendingUp className="w-4 h-4 text-blue-500" />} title="Updates" count={editingReport.updates.length} />
        {expandedSections.updates && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.updates.map((upd, idx) => (
              <div key={upd.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({ ...editingReport, updates: editingReport.updates.filter(u => u.id !== upd.id) })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input className={ic} placeholder="Title" value={upd.title} onChange={e => { const a = [...editingReport.updates]; a[idx] = { ...a[idx], title: e.target.value }; setEditingReport({ ...editingReport, updates: a }); }} />
                  <input type="date" className={ic} value={upd.date} onChange={e => { const a = [...editingReport.updates]; a[idx] = { ...a[idx], date: e.target.value }; setEditingReport({ ...editingReport, updates: a }); }} />
                  <select className={ic} value={upd.category} onChange={e => { const a = [...editingReport.updates]; a[idx] = { ...a[idx], category: e.target.value as any }; setEditingReport({ ...editingReport, updates: a }); }}>{['Scope', 'Timeline', 'Budget', 'Resource', 'Technical', 'Risk', 'Other'].map(c => <option key={c}>{c}</option>)}</select>
                  <RAGSelector value={upd.impact} onChange={v => { const a = [...editingReport.updates]; a[idx] = { ...a[idx], impact: v }; setEditingReport({ ...editingReport, updates: a }); }} />
                </div>
                <textarea rows={2} className={tc} placeholder="Description..." value={upd.description} onChange={e => { const a = [...editingReport.updates]; a[idx] = { ...a[idx], description: e.target.value }; setEditingReport({ ...editingReport, updates: a }); }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({ ...editingReport, updates: [...editingReport.updates, { id: generateId(), date: new Date().toISOString().split('T')[0], category: 'Other', title: '', description: '', impact: 'Green' }] })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center"><Plus className="w-4 h-4" /> Add Update</button>
          </div>
        )}

        {/* NEWS */}
        <SectionHeader id="news" icon={<Megaphone className="w-4 h-4 text-emerald-500" />} title="News & Achievements" count={editingReport.news.length} />
        {expandedSections.news && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.news.map((n, idx) => (
              <div key={n.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({ ...editingReport, news: editingReport.news.filter(x => x.id !== n.id) })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input className={ic} placeholder="Title" value={n.title} onChange={e => { const a = [...editingReport.news]; a[idx] = { ...a[idx], title: e.target.value }; setEditingReport({ ...editingReport, news: a }); }} />
                  <input type="date" className={ic} value={n.date} onChange={e => { const a = [...editingReport.news]; a[idx] = { ...a[idx], date: e.target.value }; setEditingReport({ ...editingReport, news: a }); }} />
                  <select className={ic} value={n.type} onChange={e => { const a = [...editingReport.news]; a[idx] = { ...a[idx], type: e.target.value as any }; setEditingReport({ ...editingReport, news: a }); }}><option>Achievement</option><option>Announcement</option><option>Change</option><option>Info</option></select>
                </div>
                <textarea rows={2} className={tc} placeholder="Description..." value={n.description} onChange={e => { const a = [...editingReport.news]; a[idx] = { ...a[idx], description: e.target.value }; setEditingReport({ ...editingReport, news: a }); }} />
              </div>
            ))}
            <button onClick={() => setEditingReport({ ...editingReport, news: [...editingReport.news, { id: generateId(), date: new Date().toISOString().split('T')[0], title: '', description: '', type: 'Info' }] })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center"><Plus className="w-4 h-4" /> Add News</button>
          </div>
        )}

        {/* MILESTONES */}
        <SectionHeader id="milestones" icon={<Target className="w-4 h-4 text-purple-500" />} title="Milestones / Planning" count={editingReport.milestones.length} />
        {expandedSections.milestones && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.milestones.map((m, idx) => (
              <div key={m.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({ ...editingReport, milestones: editingReport.milestones.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <input className={`${ic} col-span-2`} placeholder="Milestone name" value={m.name} onChange={e => { const a = [...editingReport.milestones]; a[idx] = { ...a[idx], name: e.target.value }; setEditingReport({ ...editingReport, milestones: a }); }} />
                  <input type="date" className={ic} value={m.plannedDate} title="Planned" onChange={e => { const a = [...editingReport.milestones]; a[idx] = { ...a[idx], plannedDate: e.target.value }; setEditingReport({ ...editingReport, milestones: a }); }} />
                  <input type="date" className={ic} value={m.revisedDate || ''} title="Revised" onChange={e => { const a = [...editingReport.milestones]; a[idx] = { ...a[idx], revisedDate: e.target.value || undefined }; setEditingReport({ ...editingReport, milestones: a }); }} />
                  <RAGSelector value={m.status} onChange={v => { const a = [...editingReport.milestones]; a[idx] = { ...a[idx], status: v }; setEditingReport({ ...editingReport, milestones: a }); }} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 min-w-[60px]">Progress</span>
                  <input type="range" min={0} max={100} value={m.completionPct} onChange={e => { const a = [...editingReport.milestones]; a[idx] = { ...a[idx], completionPct: parseInt(e.target.value) }; setEditingReport({ ...editingReport, milestones: a }); }} className="flex-1 accent-indigo-600" />
                  <span className="text-sm font-bold text-indigo-600 w-10 text-right">{m.completionPct}%</span>
                </div>
              </div>
            ))}
            <button onClick={() => setEditingReport({ ...editingReport, milestones: [...editingReport.milestones, { id: generateId(), name: '', plannedDate: '', status: 'Green', completionPct: 0 }] })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center"><Plus className="w-4 h-4" /> Add Milestone</button>
          </div>
        )}

        {/* RISKS */}
        <SectionHeader id="risks" icon={<Shield className="w-4 h-4 text-orange-500" />} title="Risk Register" count={editingReport.risks.length} />
        {expandedSections.risks && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            {editingReport.risks.map((r, idx) => (
              <div key={r.id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 relative">
                <button onClick={() => setEditingReport({ ...editingReport, risks: editingReport.risks.filter(x => x.id !== r.id) })} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input className={`${ic} col-span-2`} placeholder="Risk description" value={r.description} onChange={e => { const a = [...editingReport.risks]; a[idx] = { ...a[idx], description: e.target.value }; setEditingReport({ ...editingReport, risks: a }); }} />
                  <select className={ic} value={r.likelihood} onChange={e => { const a = [...editingReport.risks]; a[idx] = { ...a[idx], likelihood: e.target.value as any }; setEditingReport({ ...editingReport, risks: a }); }}><option value="Low">Likelihood: Low</option><option value="Medium">Likelihood: Medium</option><option value="High">Likelihood: High</option></select>
                  <select className={ic} value={r.impact} onChange={e => { const a = [...editingReport.risks]; a[idx] = { ...a[idx], impact: e.target.value as any }; setEditingReport({ ...editingReport, risks: a }); }}><option value="Low">Impact: Low</option><option value="Medium">Impact: Medium</option><option value="High">Impact: High</option></select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <textarea rows={2} className={tc} placeholder="Mitigation plan..." value={r.mitigation} onChange={e => { const a = [...editingReport.risks]; a[idx] = { ...a[idx], mitigation: e.target.value }; setEditingReport({ ...editingReport, risks: a }); }} />
                  <input className={ic} placeholder="Risk owner" value={r.owner} onChange={e => { const a = [...editingReport.risks]; a[idx] = { ...a[idx], owner: e.target.value }; setEditingReport({ ...editingReport, risks: a }); }} />
                </div>
              </div>
            ))}
            <button onClick={() => setEditingReport({ ...editingReport, risks: [...editingReport.risks, { id: generateId(), description: '', likelihood: 'Medium', impact: 'Medium', mitigation: '', owner: '' }] })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-full justify-center"><Plus className="w-4 h-4" /> Add Risk</button>
          </div>
        )}

        {/* BUDGET */}
        <SectionHeader id="budget" icon={<DollarSign className="w-4 h-4 text-green-500" />} title="Budget" />
        {expandedSections.budget && (
          <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Allocated</label><input type="number" className={ic} value={editingReport.budgetAllocated || ''} onChange={e => setEditingReport({ ...editingReport, budgetAllocated: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Spent</label><input type="number" className={ic} value={editingReport.budgetSpent || ''} onChange={e => setEditingReport({ ...editingReport, budgetSpent: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Forecast</label><input type="number" className={ic} value={editingReport.budgetForecast || ''} onChange={e => setEditingReport({ ...editingReport, budgetForecast: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            {(editingReport.budgetAllocated || 0) > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                  <span>Budget Utilization</span>
                  <span className="font-bold text-indigo-600">{Math.round(((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) > 0.9 ? 'bg-red-500' : ((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.round(((editingReport.budgetSpent || 0) / (editingReport.budgetAllocated || 1)) * 100))}%` }} />
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Eye className="w-5 h-5 text-indigo-500" /> Report Preview</h2>
          <p className="text-sm text-gray-500 mt-1">Review before exporting to PDF</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('overview')} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Back</button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"><Download className="w-4 h-4" /> Export PDF (Landscape)</button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm overflow-auto" style={{ maxHeight: '75vh' }}>
        <div dangerouslySetInnerHTML={{ __html: generatedHTML }} />
      </div>
    </div>
  );

  // ════════════════════════════════════════
  //  VERSION HISTORY PANEL
  // ════════════════════════════════════════
  const renderVersionPanel = (projectId: string) => {
    const versions = getProjectVersions(projectId);
    const project = allProjects.find(p => p.id === projectId);
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVersionPanelProject(null)}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-500" /> Version History</h3>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
            <button onClick={() => setVersionPanelProject(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><ChevronDown className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-4 overflow-y-auto max-h-[55vh] space-y-3">
            {versions.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No versions yet</p>}
            {versions.map((v, i) => (
              <div key={v.id} className={`p-4 rounded-xl border transition-all ${i === 0 ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{v.versionLabel || `v${v.version || 1}`}</span>
                    {i === 0 && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">LATEST</span>}
                  </div>
                  <RAGDot status={v.overallStatus} size="sm" />
                </div>
                <div className="text-xs text-gray-500 mb-3 flex items-center gap-3">
                  <span>Created: {new Date(v.createdAt).toLocaleDateString()}</span>
                  <span>Updated: {new Date(v.updatedAt).toLocaleDateString()}</span>
                  <span>{v.overallCompletionPct}% complete</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditVersion(v)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"><Edit3 className="w-3 h-3" /> Edit</button>
                  {versions.length > 1 && <button onClick={() => { if (confirm('Delete this version?')) onDeletePMReport(v.id); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-500 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
            <button onClick={() => handleNewVersion(projectId)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors w-full justify-center shadow-sm"><Copy className="w-4 h-4" /> New Version (clone latest)</button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════
  //  OVERVIEW
  // ════════════════════════════════════════
  const renderOverview = () => (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg"><FileBarChart className="w-5 h-5 text-white" /></div>
            PM Report
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Generate professional project status reports for senior management</p>
        </div>
        <button onClick={handleGenerateReport} disabled={selectedProjectIds.length === 0 || isGenerating}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${selectedProjectIds.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg'}`}>
          {isGenerating ? <><Activity className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Report ({selectedProjectIds.length})</>}
        </button>
      </div>

      <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800 dark:text-indigo-300">
          <span className="font-bold">How it works:</span> 1) Select projects 2) Click "Edit Data" to fill status data (each save creates a version) 3) Use "History" to manage versions 4) Select projects and "Generate Report" 5) Export to landscape PDF
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allProjects.map(project => {
          const latest = getLatestVersion(project.id);
          const versionCount = getProjectVersions(project.id).length;
          const isSelected = selectedProjectIds.includes(project.id);
          const tasksDone = project.tasks.filter(t => t.status === 'Done').length;

          return (
            <div key={project.id} className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 p-5 transition-all cursor-pointer hover:shadow-md ${isSelected ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-800'}`} onClick={() => toggleProject(project.id)}>
              <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>

              <div className="flex items-start gap-3 mb-3 pr-8">
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${project.status === 'Active' ? 'bg-emerald-500' : project.status === 'Planning' ? 'bg-blue-500' : project.status === 'Paused' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{project.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{project.teamName} &bull; {project.status}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {project.deadline}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project.members.length}</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {tasksDone}/{project.tasks.length}</span>
              </div>

              {latest ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RAGDot status={latest.overallStatus} size="sm" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{latest.versionLabel || `v${latest.version || 1}`}</span>
                    <span className="text-xs text-gray-400">&bull; {new Date(latest.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); setVersionPanelProject(project.id); }}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <History className="w-3 h-3" /> {versionCount}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleEditReport(project.id); }}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={e => { e.stopPropagation(); handleEditReport(project.id); }}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
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

  return (
    <div>
      {view === 'overview' && renderOverview()}
      {view === 'data-entry' && renderDataEntry()}
      {view === 'report-preview' && renderReportPreview()}
      {versionPanelProject && renderVersionPanel(versionPanelProject)}
    </div>
  );
};

export default PMReport;
