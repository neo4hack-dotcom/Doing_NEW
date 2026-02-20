
import { Team, User, TaskStatus, LLMConfig, Meeting, WeeklyReport, ChatMessage, Project, WorkingGroup, ActionItemStatus, SmartTodo } from "../types";

// --- PROMPTS PAR DÉFAUT ---
// Chaque prompt correspond à un cas d'usage spécifique (rapports, réunions, etc.)
// Les variables {{DATA}} et {{TITLE}} seront remplacées dynamiquement

export const DEFAULT_PROMPTS = {
    team_report: `
You are an expert executive assistant in project management. Write a concise and professional status report based on the provided data.

DATA:
{{DATA}}

EXPECTED FORMAT (Markdown):
1. **Executive Summary**: Overall team health in 2 sentences. Use **Bold** for key metrics.
2. **Key Attention Points**: Bullet list of blockers or risks (overdue dates). Use **Bold** with words like "Alert", "Critical", "Warning".
3. **Action Plan**: 3 recommended actions for the manager.

Be factual, direct, and constructive. Write in English.
`,
    meeting_summary: `
You are an efficient executive secretary. Generate professional meeting minutes ready to be sent as an email based on the data.

DATA:
{{DATA}}

EXPECTED FORMAT:
Subject: [Minutes] {{TITLE}}

Body:
1. **Summary**: A clear paragraph summarizing main discussions.
2. **Key Decisions**: Bullet points of agreed items (Use the validated decisions provided). Use **Bold**.
3. **Action Items**: Clean list of assigned actions.

Tone: Professional, neutral, efficient. Write in English.
`,
    weekly_email: `
You are an executive assistant helping an employee write a professional weekly status update email to their management.

DATA:
{{DATA}}

TASK:
Write a concise, professional email draft. Include the RAG status in the header or summary.

EXPECTED FORMAT:
Subject: Weekly Update - {{NAME}} - {{WEEK}}

Hi Team / [Manager Name],

[Executive summary paragraph (2 sentences max). Mention Team/Project Health].

**🆕 New This Week**
[Bulleted list of new topics or arrivals. Use **Bold** for key items]

**🚀 Key Achievements**
[Bulleted list based on success. Use **Bold** for numbers or big wins]

**⚠️ Challenges & Blockers**
[Bulleted list based on issues. Use **Bold** with words like "Alert", "Blocker" if serious.]

**🔔 Other Updates**
[Combine Incidents, Organization, and Other points]

Best regards,
{{NAME}}
Write in English.
`,
    weekly_autofill: `
You are a manager consolidating the weekly reports of your team.

SOURCE DATA:
{{DATA}}

TASK:
Synthesize all these reports into a single consolidated report.
For each category (New This Week, Success, Issues, Incidents, Organization, Other), list the items as bullet points.
IMPORTANT: You MUST preserve the context of the Team Name and the Project/Subject for each point.

Format for each bullet point:
- **[Team Name - User Name]** [Project/Context]: The specific achievement or issue.

CRITICAL: RETURN ONLY A VALID JSON OBJECT. NO MARKDOWN. NO CODE BLOCKS.

Structure required:
{
  "newThisWeek": "Bullet list of new items/topics...",
  "mainSuccess": "Bullet list of achievements...",
  "mainIssue": "Bullet list of blocking issues...",
  "incident": "Bullet list of incidents...",
  "orgaPoint": "Bullet list of HR/Orga points...",
  "otherSection": "Bullet list of other relevant info..."
}

Language: English.
`,
    manager_synthesis: `
You are a Senior Project Manager generating a high-level executive synthesis based on team reports.

DATA TO ANALYZE (Consolidated Categories):
{{DATA}}

TASK:
Generate a clear, structured summary organized by Project/Subject.
Synthesize the information provided in the input categories.
Cross-reference information if multiple people mention the same project.

CONSTRAINTS:
1. **NO Hallucinations**: Use ONLY the facts provided in the data. Do not invent details.
2. **Tone**: Positive and constructive. Rephrase difficulties as challenges to be managed, unless it is a major critical incident.
3. **Alerts**: Use **Bold** with "Warning" ONLY for key critical points/blockers.
4. **Structure**:
   - **Executive Overview**: 2-3 sentences.
   - **Project/Topic Updates**: Group updates by project name. Use bullet points.
   - **New & Noteworthy**: Specific section for "New This Week" items.
   - **Team & HR**: Brief section for organizational points.

Write in English.
`,
    management_insight: `
You are a high-end Management Consultant presenting to the Board of Directors.
Analyze the following data to provide a strategic, beautiful, and structured overview.

DATA:
{{DATA}}

MANDATORY "BEAUTIFUL" STRUCTURE (Use Headers and Emojis):

### 🌍 Global Executive Summary
(2-3 powerful sentences summarizing the global state. Mention if things are generally Green or Red).

### 🏢 Team-by-Team Analysis
For each team, use a sub-header like "**Team Name**" and provide:
*   **⚡ Velocity & State**: Summary of activity.
*   **📉 Risks & Blockers**: If any issues, bold them using "Critical" or "Warning".
*   **⭐ Wins**: Highlight key successes.

### 🎯 Strategic Watchlist
*   List top 3 items management must focus on immediately.

Be insightful, professional, and use formatting (bold, lists) to make it easy to read. Write in English.
`,
    project_roadmap: `
You are a Senior Technical Program Manager. Your goal is to produce a "Project Booklet / Roadmap" based strictly on the provided raw data.

DATA:
{{DATA}}

TASK:
Rephrase the content to materialize a clear, professional Roadmap.
Deduce the project phases from the tasks, deadlines, and context.

MANDATORY STRUCTURE:

### 📖 Executive Context
(Reformulate the description and additional context layers into a professional intro).

### 🛣️ Project Roadmap & Phases
(Group tasks logically into phases if possible, or chronological blocks. Show progress).
*   **Phase 1: [Name deduced]** (Status)
    *   Key deliverables...
*   **Phase 2: [Name deduced]** (Status) ...

### ⚠️ Attention Points & Recommendations
(Strictly FACTUAL. Do not invent risks not present in data).
*   If blocked tasks exist: "Alert: [Task] is blocked."
*   If deadline near: "Warning: Deadline approaching."
*   If NO risks found in data, write: "✅ No specific alerts detected based on current data."

Tone: Formal, "Consulting" style. 100% Accurate. No Hallucinations.
`,
    working_group_full: `
You are a Project Director analyzing the full history of a Working Group.
Your goal is to produce a comprehensive report summarizing the group's lifecycle, decisions, and remaining work.

DATA:
{{DATA}}

MANDATORY STRUCTURE:

### 📑 Executive Summary
(Overview of the working group's purpose and progress from start to now).

### ✅ Key Achievements & Closed Topics
(List major topics discussed and actions marked as DONE. Highlight solved checklist items).

### 🏛️ Strategic Decisions
(Summarize the KEY DECISIONS taken across sessions).

### 🚧 Remaining Work (The "Rest to Do")
(List actions that are NOT Done (Ongoing, To Start, Blocked). List checklist items NOT checked).
*   **Actions**: ...
*   **Checklist**: ...

### ⚠️ Risks & Blockers
(Highlight any item marked as BLOCKED or URGENT).

Tone: Professional, synthesis-oriented. English.
`,
    working_group_session: `
You are a Project Manager Assistant. Generate a summary strictly for the LAST session of this working group.

DATA:
{{DATA}}

MANDATORY STRUCTURE:

### 📅 Session Recap ({{DATE}})
(Summarize the notes of this specific session).

### ⚖️ Key Decisions
(List explicitly the decisions made in this session).

### ⚡ Action Plan (Next Steps)
(List ONLY actions from this session that are NOT Done).
*   [Action] (Owner / ETA)

### 📋 Checklist Status
(List checklist items relevant to this session that are NOT Done).

### 🔔 Alerts
(If any action is BLOCKED or checklist item is URGENT).

Tone: Action-oriented. English.
`,
    risk_assessment: `
ACT AS: A Senior Risk Manager and Auditor.

INPUT DATA:
{{DATA}}

MISSION:
Detect HIGH RISKS linked to Projects (delays, blockers) or Resources (burnout, recurring issues, negative trend).

CONSTRAINT:
- If NO major risk is detected, output exactly: "No major risks detected."
- If risks are detected, format them as a concise Markdown list.
- Be very precise. Cite the Project or User concerned.
- Use **Bold** for severity level (e.g. **CRITICAL**, **HIGH RISK**).

Output Example:
- **CRITICAL**: Project X is overdue and has blocked tasks since 3 weeks.
- **HIGH RISK**: User Y reports Red status for 3 consecutive weeks. Burnout risk.
`,
    project_card: `
You are a senior portfolio manager. Generate a comprehensive **Project Card** summarizing the selected projects.

DATA:
{{DATA}}

EXPECTED FORMAT (Markdown):

## 📊 Portfolio Overview
A 2-3 sentence executive summary of the overall portfolio health and key themes.

## 🏆 Key Achievements
- Bullet list of completed work, milestones reached, and wins across all projects. Use **Bold** for highlights.

## 🗺️ Roadmap & Next Steps
- Bullet list of upcoming deliverables and planned work per project. Include ETAs when available.

## ⚠️ Risks & Blockers
- Bullet list of blocked tasks, overdue items, red external dependencies. Use **Bold** with "Critical", "Alert" for high-severity items.

## 🔍 Attention Points
- Functional and technical items requiring management attention. Mention stale projects, resource gaps, or dependency concerns.

Be factual, structured, and actionable. Write in English.
`,
    document_synthesis: `
Task: Generate a professional summary of the provided document or content.

Content to analyze:
{{DATA}}

Mandatory Output Format (Bullet points):
• Context: (What the document is about)
• Key Takeaways: (Key info, numbers, decisions). Use **Bold** for numbers/wins.
• Attention Points: (Risks, required actions). Use **Bold** with "Alert" or "Warning" for risks.

Be creative but precise. Format response in clean Markdown. Answer in ENGLISH.
`
};

// --- FONCTIONS UTILITAIRES DE PRÉPARATION DES DONNÉES ---
// Ces fonctions formatent les données pour les envoyer aux modèles LLM

const prepareTeamData = (team: Team, manager: User | undefined): string => {
  // Prépare les données d'une équipe avec ses projets et tâches pour l'IA
  const projectSummaries = team.projects.map(p => {
    const totalTasks = p.tasks.length;
    const closed = p.tasks.filter(t => t.status === TaskStatus.DONE).length;
    const blocked = p.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
    
    const context = (p.additionalDescriptions || [])
        .filter(d => d != null && d.trim().length > 0)
        .map((d, i) => `Context Layer ${i+1}: ${d}`)
        .join('\n');

    return `
      Project: ${p.name}
      Description: ${p.description}
      ${context ? `Detailed Context:\n${context}` : ''}
      Progress: ${closed}/${totalTasks} tasks completed.
      Blocking Points: ${blocked} tasks blocked.
      Task Details:
      ${p.tasks.map(t => `- [${t.status}] ${t.title} (ETA: ${t.eta}, Owner: ${t.assigneeId || 'Unassigned'})`).join('\n')}
    `;
  }).join('\n---\n');

  return `
    Team: ${team.name}
    Manager: ${manager?.firstName || 'N/A'} ${manager?.lastName || ''}.
    Project Data:
    ${projectSummaries}
  `;
};

const prepareProjectDetailData = (project: Project, users: User[]): string => {
    // Extrait les données détaillées d'un projet (tâches, dépendances, etc.)
    const managerName = users.find(u => u.id === project.managerId)?.lastName || 'Unassigned';
    
    const contextLayers = (project.additionalDescriptions || [])
        .filter(d => d != null && d.trim().length > 0)
        .map((d, i) => `Hidden Context ${i+1}: ${d}`)
        .join('\n');

    const externalDeps = (project.externalDependencies || [])
        .map(d => `- Dependency: ${d.label} (Status: ${d.status})`)
        .join('\n');

    const tasksData = project.tasks.map(t => {
        const assignee = users.find(u => u.id === t.assigneeId)?.lastName || 'Unassigned';
        const checklistInfo = t.checklist ? `(Checklist: ${t.checklist.filter(c => c.done).length}/${t.checklist.length} done)` : '';
        const comments = t.checklist?.map(c => c.comment ? `  - Note on "${c.text}": ${c.comment}` : '').join('');
        
        return `
        Task: ${t.title} [Status: ${t.status}, Priority: ${t.priority}]
        - Description: ${t.description}
        - ETA: ${t.eta || 'N/A'}
        - Owner: ${assignee}
        - ${checklistInfo}
        ${comments}
        `;
    }).join('\n');

    return `
    PROJECT: ${project.name}
    STATUS: ${project.status}
    DEADLINE: ${project.deadline}
    MANAGER: ${managerName}
    
    DESCRIPTION:
    ${project.description}

    ADDITIONAL CONTEXT (Private):
    ${contextLayers}

    EXTERNAL DEPENDENCIES:
    ${externalDeps}

    TASKS & ROADMAP DATA:
    ${tasksData}
    `;
}

const prepareMeetingData = (meeting: Meeting, teamName: string, attendeesNames: string[], users: User[]): string => {
  const resolveName = (idOrName: string) => {
      const u = users.find(user => user.id === idOrName);
      return u ? `${u.firstName} ${u.lastName}` : idOrName;
  };

  const actionItemsText = meeting.actionItems.map(ai => {
     const ownerName = resolveName(ai.ownerId);
     return `- ${ai.description} (Owner: ${ownerName || 'N/A'}, Due: ${ai.dueDate})`;
  }).join('\n');

  const decisionsText = meeting.decisions && meeting.decisions.length > 0
    ? meeting.decisions.map(d => `- ${d.text}`).join('\n')
    : "No key decisions recorded.";

  const resolvedAttendees = meeting.attendees.map(resolveName);

  return `
    Title: ${meeting.title}
    Date: ${meeting.date}
    Team: ${teamName}
    Attendees: ${resolvedAttendees.join(', ')}
    
    Raw Notes (Minutes):
    ${meeting.minutes}

    KEY DECISIONS (Validated):
    ${decisionsText}
    
    Action Items (Defined):
    ${actionItemsText}
  `;
};

const prepareWeeklyReportData = (report: WeeklyReport, user: User | null): string => {
    return `
      Employee: ${user?.firstName} ${user?.lastName}
      Week of: ${report.weekOf}
      STATUS INDICATORS (RAG): Team=${report.teamHealth || 'N/A'}, Project=${report.projectHealth || 'N/A'}
      New This Week: ${report.newThisWeek || 'None'}
      Main Successes: ${report.mainSuccess}
      Blocking Issues: ${report.mainIssue}
      Incidents: ${report.incident}
      Organization/HR: ${report.orgaPoint}
      Other: ${report.otherSection || ''}
    `;
};

const prepareManagementData = (teams: Team[], reports: WeeklyReport[], users: User[]): string => {
    const teamsData = teams.map(t => {
        const projectNames = t.projects.map(p => p.name).join(', ');
        return `Team: ${t.name} (Projects: ${projectNames})`;
    }).join('\n');

    const sortedReports = [...reports].sort((a,b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());
    const recentReports = sortedReports.slice(0, 10).map(r => {
        const u = users.find(user => user.id === r.userId);
        return `
        - ${u?.firstName} ${u?.lastName} (Week of ${r.weekOf}):
          Status RAG: Team=${r.teamHealth}, Projects=${r.projectHealth}
          New: ${r.newThisWeek || 'None'}
          Success: ${r.mainSuccess}
          Issues: ${r.mainIssue}
        `;
    }).join('\n');

    return `
    TEAM CONTEXT:
    ${teamsData}

    RECENT WEEKLY REPORTS:
    ${recentReports}
    `;
}

const prepareWorkingGroupData = (group: WorkingGroup, teams: Team[], users: User[], onlyLastSession: boolean): string => {
    // 1. Find Linked Project Info
    let projectContext = "";
    if (group.projectId) {
        for (const t of teams) {
            const p = t.projects.find(proj => proj.id === group.projectId);
            if (p) {
                projectContext = `
                LINKED PROJECT CONTEXT:
                Name: ${p.name}
                Status: ${p.status}
                Description: ${p.description}
                Deadline: ${p.deadline}
                Context Layers: ${(p.additionalDescriptions || []).join(' ')}
                `;
                break;
            }
        }
    }

    // 2. Prepare Session Data
    // Ensure we sort sessions chronologically for the Full Report to detect flow
    const sortedSessions = [...group.sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const sessionsToProcess = onlyLastSession && group.sessions.length > 0 
        ? [group.sessions[0]] // The first one in the original array (usually newest)
        : sortedSessions;

    const sessionsText = sessionsToProcess.map(s => {
        const actions = s.actionItems.map(a => {
            const owner = users.find(u => u.id === a.ownerId)?.firstName || 'Unassigned';
            return `- [${a.status}] ${a.description} (Owner: ${owner}, ETA: ${a.eta || 'None'})`;
        }).join('\n');

        const checklist = s.checklist ? s.checklist.map(c => {
            return `- [${c.done ? 'DONE' : 'TODO'}] ${c.text} ${c.isUrgent ? '(URGENT)' : ''} ${c.comment ? `(Note: ${c.comment})` : ''}`;
        }).join('\n') : 'No checklist.';

        const decisions = s.decisions && s.decisions.length > 0 
            ? s.decisions.map(d => `- ${d.text}`).join('\n') 
            : 'No decisions recorded.';

        return `
        SESSION DATE: ${s.date}
        NOTES: ${s.notes}
        
        KEY DECISIONS:
        ${decisions}

        ACTIONS:
        ${actions}
        
        CHECKLIST:
        ${checklist}
        `;
    }).join('\n----------------------------------\n');

    return `
    WORKING GROUP: ${group.title}
    ${projectContext}

    SESSIONS HISTORY (Chronological):
    ${sessionsText}
    `;
}

// --- Helper to inject data into template ---
const fillTemplate = (template: string, replacements: Record<string, string>) => {
    let result = template;
    for (const key in replacements) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
    }
    return result;
}

// --- FONCTIONS INTERNES D'AIDE ---

// Construit le contexte de conversation à partir de l'historique des messages
const buildChatContext = (history: ChatMessage[]): string => {
    return history.map(msg => {
        const attachmentInfo = msg.attachments && msg.attachments.length > 0 
            ? ` [Attachments: ${msg.attachments.map(a => `${a.name} (${a.type})`).join(', ')}]` 
            : '';
        return `${msg.role.toUpperCase()}: ${msg.content}${attachmentInfo}`;
    }).join('\n');
};

// Appel au modèle local Ollama
const callOllama = async (prompt: string, config: LLMConfig, images: string[] = []): Promise<string> => {
    // Appel local 100% - pas de données envoyées à l'extérieur
    const url = `${config.baseUrl || 'http://localhost:11434'}/api/generate`;
    const body: any = {
        model: config.model || 'llama3',
        prompt: prompt,
        stream: false
    };

    if (images && images.length > 0) {
        body.images = images;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
};

// Appel via endpoint HTTP local compatible OpenAI (LocalAI, LM Studio, etc.)
const callLocalHttp = async (prompt: string, config: LLMConfig): Promise<string> => {
    // Format compatible OpenAI - STRICTEMENT LOCAL
    const url = config.baseUrl || 'http://localhost:8000/v1/chat/completions';
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: config.model || 'local-model', 
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`Local HTTP API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content || JSON.stringify(data);
};

// Appel via webhook N8N pour l'automatisation
const callN8n = async (prompt: string, config: LLMConfig): Promise<string> => {
    const url = config.baseUrl;
    if (!url) throw new Error("N8N Webhook URL is missing");

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (config.apiKey) {
        headers['Authorization'] = config.apiKey; 
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            prompt: prompt,
            model: config.model,
            timestamp: new Date().toISOString()
        })
    });

    if (!response.ok) {
        throw new Error(`N8N Webhook Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (typeof data === 'string') return data;
    return data.output || data.text || data.response || data.content || JSON.stringify(data);
};

// --- API PUBLIQUE ---
// Fonctions exportées pour la génération de rapports et l'interaction avec l'IA

// Teste la connexion au fournisseur LLM configuré
export const testConnection = async (config: LLMConfig): Promise<boolean> => {
    try {
        const pingPrompt = "Hello, are you online? Respond with 'Yes'.";
        let res = "";
        if (config.provider === 'ollama') {
            res = await callOllama(pingPrompt, config);
        } else if (config.provider === 'local_http') {
            res = await callLocalHttp(pingPrompt, config);
        } else if (config.provider === 'n8n') {
            res = await callN8n(pingPrompt, config);
        }
        return !!res;
    } catch (e) {
        console.error("Connection Test Failed", e);
        throw e;
    }
};

// Génère un rapport d'équipe via l'IA
export const generateTeamReport = async (team: Team, manager: User | undefined, config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
  // Prépare les données de l'équipe et injecte dans le prompt
  const data = prepareTeamData(team, manager);
  const template = customPrompts?.['team_report'] || DEFAULT_PROMPTS.team_report;
  const prompt = fillTemplate(template, { DATA: data });
  return runPrompt(prompt, config, [], language);
};

// Génère une feuille de route de projet avec phases et jalons
export const generateProjectRoadmap = async (project: Project, users: User[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    // Extrait les données détaillées du projet
    const data = prepareProjectDetailData(project, users);
    const template = customPrompts?.['project_roadmap'] || DEFAULT_PROMPTS.project_roadmap;
    const prompt = fillTemplate(template, { DATA: data });
    return runPrompt(prompt, config, [], language);
}

export const generateMeetingSummary = async (meeting: Meeting, team: Team | undefined, users: User[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const teamName = team ? team.name : 'General';
    const data = prepareMeetingData(meeting, teamName, meeting.attendees, users);

    const template = customPrompts?.['meeting_summary'] || DEFAULT_PROMPTS.meeting_summary;
    const prompt = fillTemplate(template, {
        DATA: data,
        TITLE: meeting.title
    });

    return runPrompt(prompt, config, [], language);
};

export const generateWeeklyReportSummary = async (report: WeeklyReport, user: User | null, config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const data = prepareWeeklyReportData(report, user);
    const template = customPrompts?.['weekly_email'] || DEFAULT_PROMPTS.weekly_email;
    const prompt = fillTemplate(template, {
        DATA: data,
        NAME: `${user?.firstName} ${user?.lastName}`,
        WEEK: report.weekOf
    });
    return runPrompt(prompt, config, [], language);
}

export const generateConsolidatedReport = async (selectedReports: WeeklyReport[], users: User[], teams: Team[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<Record<string, string>> => {
    // 1. Prepare Data
    const reportsText = selectedReports.map(r => {
        const u = users.find(user => user.id === r.userId);
        
        const userTeams = teams.filter(t => 
            t.managerId === u?.id || 
            t.projects.some(p => p.members.some(m => m.userId === u?.id))
        );
        const teamNames = userTeams.map(t => t.name).join(', ') || 'No Team';

        return `
        REPORT FROM: ${u?.firstName} ${u?.lastName}
        TEAM(S): ${teamNames}
        TEAM HEALTH: ${r.teamHealth}, PROJECT HEALTH: ${r.projectHealth}
        NEW ITEMS: ${r.newThisWeek || 'None'}
        SUCCESS: ${r.mainSuccess}
        ISSUES: ${r.mainIssue}
        INCIDENTS: ${r.incident}
        ORGA: ${r.orgaPoint}
        OTHER: ${r.otherSection}
        ----------------------------------------------
        `;
    }).join('\n');

    const template = customPrompts?.['weekly_autofill'] || DEFAULT_PROMPTS.weekly_autofill;
    const prompt = fillTemplate(template, { DATA: reportsText });

    const rawResponse = await runPrompt(prompt, config, [], language);
    
    try {
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return parsed;
    } catch (e) {
        console.error("Failed to parse JSON from AI", rawResponse);
        return {
            newThisWeek: "",
            mainSuccess: "",
            mainIssue: "",
            incident: "",
            orgaPoint: "",
            otherSection: rawResponse 
        };
    }
}

export const generateManagerSynthesis = async (reportData: WeeklyReport, config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const data = `
    NEW ITEMS:
    ${reportData.newThisWeek}

    SUCCESSES:
    ${reportData.mainSuccess}
    
    ISSUES/BLOCKERS:
    ${reportData.mainIssue}
    
    INCIDENTS:
    ${reportData.incident}
    
    ORGANIZATION:
    ${reportData.orgaPoint}
    
    OTHER:
    ${reportData.otherSection}
    `;

    const template = customPrompts?.['manager_synthesis'] || DEFAULT_PROMPTS.manager_synthesis;
    const prompt = fillTemplate(template, { DATA: data });

    return runPrompt(prompt, config, [], language);
};

export const generateManagementInsight = async (teams: Team[], reports: WeeklyReport[], users: User[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const data = prepareManagementData(teams, reports, users);
    const template = customPrompts?.['management_insight'] || DEFAULT_PROMPTS.management_insight;
    const prompt = fillTemplate(template, { DATA: data });
    return runPrompt(prompt, config, [], language);
}

export const generateRiskAssessment = async (teams: Team[], reports: WeeklyReport[], users: User[], config: LLMConfig, language?: 'fr' | 'en', customPrompts?: Record<string, string>): Promise<string> => {
    const projectContext = teams.flatMap(t => t.projects.map(p => {
        const context = (p.additionalDescriptions || []).join(' ');
        const blockedTasks = p.tasks.filter(task => task.status === TaskStatus.BLOCKED).map(t => t.title).join(', ');
        return `
        Project: ${p.name} (Status: ${p.status}, Deadline: ${p.deadline})
        Context: ${context.substring(0, 500)}...
        Blocked Tasks: ${blockedTasks || 'None'}
        `;
    })).join('\n');

    const reportsByUser: {[key: string]: WeeklyReport[]} = {};
    reports.forEach(r => {
        if (!reportsByUser[r.userId]) reportsByUser[r.userId] = [];
        reportsByUser[r.userId].push(r);
    });

    const userReportsContext = Object.keys(reportsByUser).map(userId => {
        const u = users.find(user => user.id === userId);
        const last3 = reportsByUser[userId].sort((a,b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime()).slice(0, 3);

        return `
        User: ${u?.firstName} ${u?.lastName}
        Last Reports:
        ${last3.map(r => `- ${r.weekOf}: Team=${r.teamHealth}, Proj=${r.projectHealth}. Issues: ${r.mainIssue}. Incident: ${r.incident}`).join('\n')}
        `;
    }).join('\n');

    const combinedData = `--- PROJECTS STATUS & CONTEXT ---\n${projectContext}\n\n--- USER REPORTS (LAST 3 WEEKS) ---\n${userReportsContext}`;
    const template = customPrompts?.['risk_assessment'] || DEFAULT_PROMPTS.risk_assessment;
    const prompt = fillTemplate(template, { DATA: combinedData });
    return runPrompt(prompt, config, [], language);
}

export const generateWorkingGroupFullReport = async (group: WorkingGroup, teams: Team[], users: User[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const data = prepareWorkingGroupData(group, teams, users, false);
    const template = customPrompts?.['working_group_full'] || DEFAULT_PROMPTS.working_group_full;
    const prompt = fillTemplate(template, { DATA: data });
    return runPrompt(prompt, config, [], language);
};

export const generateWorkingGroupSessionReport = async (group: WorkingGroup, teams: Team[], users: User[], config: LLMConfig, customPrompts?: Record<string, string>, language?: 'fr' | 'en'): Promise<string> => {
    const data = prepareWorkingGroupData(group, teams, users, true);
    const latestDate = group.sessions.length > 0 ? group.sessions[0].date : 'Unknown Date';
    const template = customPrompts?.['working_group_session'] || DEFAULT_PROMPTS.working_group_session;
    const prompt = fillTemplate(template, { DATA: data, DATE: latestDate });
    return runPrompt(prompt, config, [], language);
};

export const sendChatMessage = async (history: ChatMessage[], newPrompt: string, config: LLMConfig, images: string[] = []): Promise<string> => {
    const context = buildChatContext(history);
    
    const fullPrompt = `
    You are DOINg Assistant, an AI integrated into a project management tool.
    
    CRITICAL: You MUST answer strictly in ENGLISH.
    
    Here is the recent conversation history:
    ${context}
    
    New User Request:
    ${newPrompt}
    
    Answer in a helpful, professional, and concise manner in ENGLISH.
    Use **Bold** for emphasis. If mentioning risks, use words like "Warning" or "Alert" inside bold tags.
    `;
    
    return runPrompt(fullPrompt, config, images);
};

export const generateProjectCard = async (projects: Project[], users: User[], config: LLMConfig, language?: 'fr' | 'en', customPrompts?: Record<string, string>): Promise<string> => {
    const projectData = projects.map(p => {
        const tasks = p.tasks.map(t => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: users.find(u => u.id === t.assigneeId)?.firstName || 'Unassigned',
            eta: t.eta,
            isImportant: t.isImportant,
            actions: (t.actions || []).map(a => `${a.text} (${a.status})`),
            blockers: t.status === 'Blocked' ? t.description : undefined
        }));
        return {
            name: p.name,
            status: p.status,
            deadline: p.deadline,
            description: p.description,
            additionalDescriptions: p.additionalDescriptions,
            externalDependencies: (p.externalDependencies || []).map(d => `${d.label}: ${d.status}`),
            tasks
        };
    });

    const template = customPrompts?.['project_card'] || DEFAULT_PROMPTS.project_card;
    const prompt = fillTemplate(template, { DATA: JSON.stringify(projectData, null, 2) });
    return runPrompt(prompt, config, [], language);
};

export const generateDocumentSynthesis = async (contentOrDescription: string, config: LLMConfig, language?: 'fr' | 'en', customPrompts?: Record<string, string>): Promise<string> => {
    const template = customPrompts?.['document_synthesis'] || DEFAULT_PROMPTS.document_synthesis;
    const prompt = fillTemplate(template, { DATA: contentOrDescription });
    return runPrompt(prompt, config, [], language);
}

// Nettoie la sortie du modèle LLM des balises inutiles
const cleanLLMOutput = (text: string): string => {
    // Supprime les blocs <think>...</think> (utilisés par certains modèles)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Supprime les balises HTML résiduelles
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    return cleaned.trim();
};

// Exécute un prompt auprès du fournisseur LLM configuré avec gestion des langues
const runPrompt = async (prompt: string, config: LLMConfig, images: string[] = [], language?: 'fr' | 'en'): Promise<string> => {
    try {
        // Ajoute les instructions de langue si spécifiées
        let finalPrompt = prompt;
        if (language === 'fr') {
            finalPrompt += '\n\nINSTRUCTION DE SORTIE IMPORTANTE: Vous DEVEZ écrire votre réponse ENTIÈRE en FRANÇAIS. Toute la sortie doit être en français.';
        } else if (language === 'en') {
            finalPrompt += '\n\nIMPORTANT OUTPUT INSTRUCTION: You MUST write your entire response in ENGLISH. All output must be in English.';
        }

        // Appelle le fournisseur LLM approprié selon la configuration
        let result = "";
        switch (config.provider) {
          case 'ollama':
            // Appel au modèle Ollama local
            result = await callOllama(finalPrompt, config, images);
            break;
          case 'local_http':
            // Appel au serveur HTTP local (LM Studio, LocalAI)
            result = await callLocalHttp(finalPrompt, config);
            break;
          case 'n8n':
            // Appel via webhook N8N
            result = await callN8n(finalPrompt, config);
            break;
          default:
            return `Fournisseur ${config.provider} non supporté. Utilisez uniquement l'IA locale.`;
        }
        return cleanLLMOutput(result);
      } catch (error: any) {
        return `Generation Error (${config.provider}): ${error.message}`;
      }
}

export const extractProjectFromText = async (text: string, config: LLMConfig): Promise<{
    project: {
        name: string;
        description: string;
        status: string;
        deadline: string;
        owner: string;
        architect: string;
    };
    tasks: {
        title: string;
        description: string;
        priority: string;
        eta: string;
        assignee: string;
    }[];
}> => {
    const prompt = `
You are a Project Extraction Assistant. Analyze the following text (which may come from a JIRA ticket, an email, a presentation, or any project description) and extract structured project and task information.

TEXT TO ANALYZE:
${text}

CRITICAL RULES:
1. Extract ONLY information that is explicitly present in the text. Do NOT invent or hallucinate any data.
2. If a field cannot be determined from the text, leave it as an empty string "".
3. For tasks, extract any actionable items, deliverables, milestones, or work items mentioned.
4. For priority, use only: "Low", "Medium", "High", or "Urgent". If not determinable, use "".
5. For status, use only: "Planning", "Active", "Paused", or "Done". If not determinable, use "Planning".
6. Dates should be in YYYY-MM-DD format if found. Otherwise "".

RETURN ONLY A VALID JSON OBJECT. NO MARKDOWN. NO CODE BLOCKS. NO EXPLANATION.

Required JSON structure:
{
  "project": {
    "name": "Project name extracted from text",
    "description": "Project description or summary",
    "status": "Planning",
    "deadline": "",
    "owner": "",
    "architect": ""
  },
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "priority": "",
      "eta": "",
      "assignee": ""
    }
  ]
}
`;

    const rawResponse = await runPrompt(prompt, config);

    try {
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
            project: {
                name: parsed.project?.name || '',
                description: parsed.project?.description || '',
                status: parsed.project?.status || 'Planning',
                deadline: parsed.project?.deadline || '',
                owner: parsed.project?.owner || '',
                architect: parsed.project?.architect || '',
            },
            tasks: (parsed.tasks || []).map((t: any) => ({
                title: t.title || '',
                description: t.description || '',
                priority: t.priority || '',
                eta: t.eta || '',
                assignee: t.assignee || '',
            }))
        };
    } catch (e) {
        console.error("Failed to parse project extraction JSON", rawResponse);
        return {
            project: { name: '', description: rawResponse, status: 'Planning', deadline: '', owner: '', architect: '' },
            tasks: []
        };
    }
};

export const extractMeetingFromText = async (text: string, config: LLMConfig): Promise<{
    title: string;
    date: string;
    attendees: string[];
    minutes: string;
    decisions: string[];
    actionItems: { description: string; owner: string; dueDate: string }[];
}> => {
    const today = new Date().toISOString().split('T')[0];
    const prompt = `
You are a Meeting Extraction Assistant. Analyze the following text (which may come from an email, a presentation, meeting notes, or any description) and extract structured meeting information.

TEXT TO ANALYZE:
${text}

CRITICAL RULES:
1. Extract ONLY information that is explicitly present in the text. Do NOT invent or hallucinate any data.
2. If a field cannot be determined from the text, leave it as an empty string "" or empty array [].
3. For attendees, extract names or email addresses of people mentioned.
4. For decisions, extract clear decisions or conclusions reached.
5. For action items, extract tasks with their owner (if mentioned) and due date (if mentioned).
6. Dates should be in YYYY-MM-DD format if found. Otherwise "".
7. Today's date is ${today} - use this as a reference for relative dates.

RETURN ONLY A VALID JSON OBJECT. NO MARKDOWN. NO CODE BLOCKS. NO EXPLANATION.

Required JSON structure:
{
  "title": "Meeting title extracted from text",
  "date": "",
  "attendees": ["Name 1", "Name 2"],
  "minutes": "A concise summary of the discussion content",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    { "description": "Action description", "owner": "", "dueDate": "" }
  ]
}
`;

    const rawResponse = await runPrompt(prompt, config);

    try {
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
            title: parsed.title || '',
            date: parsed.date || today,
            attendees: Array.isArray(parsed.attendees) ? parsed.attendees.map((a: any) => String(a)) : [],
            minutes: parsed.minutes || '',
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((d: any) => String(d)) : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map((a: any) => ({
                description: a.description || '',
                owner: a.owner || '',
                dueDate: a.dueDate || '',
            })) : [],
        };
    } catch (e) {
        console.error("Failed to parse meeting extraction JSON", rawResponse);
        return {
            title: '',
            date: today,
            attendees: [],
            minutes: rawResponse,
            decisions: [],
            actionItems: [],
        };
    }
};

export const ragQuery = async (
    question: string,
    context: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    config: LLMConfig
): Promise<string> => {
    const historyText = history.length > 0
        ? history.map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`).join('\n')
        : '';

    const prompt = `
You are a RAG (Retrieval-Augmented Generation) assistant integrated into a project management tool called DOINg.
You have been provided with relevant data extracted from the application database.

RELEVANT DATA FROM DATABASE:
${context}

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}
USER QUESTION: ${question}

CRITICAL RULES:
1. Answer ONLY based on the data provided above. Do NOT invent, assume, or hallucinate any information.
2. If the data does not contain enough information to answer, say so clearly.
3. Format your answer in clear, well-structured Markdown.
4. Use **Bold** for key entities (names, project names, dates, statuses).
5. Use bullet points for lists of items.
6. Be precise, factual, and concise.
7. If multiple data sources are relevant, synthesize them coherently.
`;

    return runPrompt(prompt, config);
};

export const extractTodoFromText = async (text: string, config: LLMConfig): Promise<{
    title: string;
    description: string;
    source: string;
    requester: string;
    tags: string[];
    links: string[];
    priorityLevel: string;
    eisenhowerQuadrant: number | null;
    energyRequired: string;
    estimatedDurationMin: number | null;
    startDate: string;
    dueDate: string;
    isRecurring: boolean;
    recurrenceRule: string;
    actionItems: { description: string; owner: string; dueDate: string }[];
}> => {
    const today = new Date().toISOString().split('T')[0];
    const prompt = `
You are a Smart To-Do Extraction Assistant. Analyze the following text (which may come from an email, a presentation, meeting notes, or any description) and extract structured to-do task information.

TEXT TO ANALYZE:
${text}

CRITICAL RULES:
1. Extract ONLY information that is explicitly present in the text. Do NOT invent or hallucinate any data.
2. If a field cannot be determined from the text, leave it as an empty string "", null, or empty array [].
3. For priorityLevel, use only: "low", "medium", "high", or "urgent". If not determinable, use "".
4. For eisenhowerQuadrant: 1=Urgent+Important(Do Now), 2=Not Urgent+Important(Schedule), 3=Urgent+Not Important(Delegate), 4=Not Urgent+Not Important(Eliminate). Use null if not determinable.
5. For energyRequired, use only: "low", "medium", or "high". If not determinable, use "".
6. Dates should be in YYYY-MM-DD format if found. Otherwise "".
7. For estimatedDurationMin, extract numeric minutes if a duration is mentioned (e.g., "2 hours" = 120). Use null if not found.
8. For actionItems, extract any sub-tasks, deliverables, or actions assigned to specific people.
9. For tags, extract relevant keywords, topics, or categories from the text.
10. For source, infer the type of document: "Email", "Meeting", "Presentation", "Message", "Note", "Other".
11. Today's date is ${today}.

RETURN ONLY A VALID JSON OBJECT. NO MARKDOWN. NO CODE BLOCKS. NO EXPLANATION.

Required JSON structure:
{
  "title": "Main task title extracted from text",
  "description": "A concise summary of the task or subject",
  "source": "",
  "requester": "",
  "tags": ["tag1", "tag2"],
  "links": ["https://..."],
  "priorityLevel": "",
  "eisenhowerQuadrant": null,
  "energyRequired": "",
  "estimatedDurationMin": null,
  "startDate": "",
  "dueDate": "",
  "isRecurring": false,
  "recurrenceRule": "",
  "actionItems": [
    { "description": "Sub-task description", "owner": "", "dueDate": "" }
  ]
}
`;

    const rawResponse = await runPrompt(prompt, config);

    try {
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
            title: parsed.title || '',
            description: parsed.description || '',
            source: parsed.source || '',
            requester: parsed.requester || '',
            tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)) : [],
            links: Array.isArray(parsed.links) ? parsed.links.map((l: any) => String(l)) : [],
            priorityLevel: parsed.priorityLevel || '',
            eisenhowerQuadrant: parsed.eisenhowerQuadrant != null ? Number(parsed.eisenhowerQuadrant) : null,
            energyRequired: parsed.energyRequired || '',
            estimatedDurationMin: parsed.estimatedDurationMin != null ? Number(parsed.estimatedDurationMin) : null,
            startDate: parsed.startDate || '',
            dueDate: parsed.dueDate || '',
            isRecurring: parsed.isRecurring === true,
            recurrenceRule: parsed.recurrenceRule || '',
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map((a: any) => ({
                description: a.description || '',
                owner: a.owner || '',
                dueDate: a.dueDate || '',
            })) : [],
        };
    } catch (e) {
        console.error("Failed to parse todo extraction JSON", rawResponse);
        return {
            title: '',
            description: rawResponse,
            source: '',
            requester: '',
            tags: [],
            links: [],
            priorityLevel: '',
            eisenhowerQuadrant: null,
            energyRequired: '',
            estimatedDurationMin: null,
            startDate: '',
            dueDate: '',
            isRecurring: false,
            recurrenceRule: '',
            actionItems: [],
        };
    }
};

export const generateTodoSynthesis = async (todos: SmartTodo[], config: LLMConfig, language?: 'fr' | 'en'): Promise<string> => {
    const activeTodos = todos.filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.isArchived);

    const todoText = activeTodos.map(t => {
        const overdue = t.dueDate && t.dueDate < new Date().toISOString().split('T')[0];
        return `- [${t.priorityLevel.toUpperCase()}] "${t.title}"
    Status: ${t.status} | Due: ${t.dueDate || 'No date'}${overdue ? ' ⚠️ OVERDUE' : ''} | Eisenhower: Q${t.eisenhowerQuadrant || 'N/A'}
    Description: ${t.description || 'N/A'}
    Source: ${t.source || 'N/A'} | Requester: ${t.requester || 'N/A'} | Sponsor: ${t.sponsor || 'N/A'}
    Tags: ${t.tags.join(', ') || 'None'}`;
    }).join('\n\n');

    const prompt = `You are a personal productivity coach analyzing a person's active task list.

ACTIVE TASKS (${activeTodos.length} total):
${todoText || 'No active tasks.'}

TASK:
Generate a clear, actionable synthesis report with the following sections:

### 🎯 Priority Recommendations
List the top 3-5 tasks that should be tackled first, with a brief explanation of why (urgency, impact, deadline).

### ⚠️ Risk Highlights
Identify tasks that present risks: overdue items, blocked tasks, high-priority items with no due date, or concerning patterns. Use **Bold** with "Alert" or "Warning" for critical items.

### ⚡ Quick Wins
List tasks that can be completed quickly to build momentum and reduce backlog size.

### 📊 Backlog Summary
2-3 sentences summarizing the overall state of the task list. Mention total active tasks, any urgent/blocked items, and overall health.

Rules:
- Be direct, factual, and actionable.
- Do NOT invent information not present in the data.
- If there are no tasks or very few, say so clearly.
- Format in clean Markdown.
`;

    return runPrompt(prompt, config, [], language);
};

export const fetchOllamaModels = async (baseUrl: string): Promise<string[]> => {
  try {
    const url = baseUrl || 'http://localhost:11434';
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error("Error fetching tags");
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (e) {
    console.error("Error fetching Ollama models", e);
    return [];
  }
};
