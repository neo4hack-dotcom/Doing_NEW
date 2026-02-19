
import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, AppState, Team, Meeting, WeeklyReport, WorkingGroup, User } from '../types';
import { ragQuery } from '../services/llmService';
import FormattedText from './FormattedText';
import { X, Send, Bot, Loader2, Database, Trash2 } from 'lucide-react';

interface RAGChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  teams: Team[];
  meetings: Meeting[];
  weeklyReports: WeeklyReport[];
  workingGroups: WorkingGroup[];
  users: User[];
}

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

// --- Simple keyword-based context retrieval ---

const tokenize = (text: string): string[] =>
  text.toLowerCase().split(/\W+/).filter(t => t.length > 2);

const scoreText = (text: string, keywords: string[]): number => {
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
};

const buildContext = (
  question: string,
  teams: Team[],
  meetings: Meeting[],
  weeklyReports: WeeklyReport[],
  workingGroups: WorkingGroup[],
  users: User[]
): string => {
  const keywords = tokenize(question);
  const maxItems = 20; // limit total snippets to avoid too large context

  type ScoredSnippet = { score: number; text: string };
  const snippets: ScoredSnippet[] = [];

  const getDisplayName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  };

  // --- Projects & Tasks ---
  for (const team of teams) {
    for (const project of team.projects) {
      const projectText = `
PROJECT: "${project.name}" | Team: ${team.name} | Status: ${project.status} | Deadline: ${project.deadline || 'N/A'}
Description: ${project.description || ''}
Owner: ${project.owner || 'N/A'} | Architect: ${project.architect || 'N/A'}
Members: ${(project.members || []).map(m => `${getDisplayName(m.userId)} (${m.role})`).join(', ') || 'None'}
Additional Context: ${(project.additionalDescriptions || []).join(' | ') || 'None'}
Tasks:
${(project.tasks || []).map(t =>
  `  - [${t.status}] ${t.title} (Priority: ${t.priority}, ETA: ${t.eta || 'N/A'}, Assignee: ${getDisplayName(t.assigneeId || '')}) ${t.description ? '| ' + t.description.substring(0, 120) : ''}`
).join('\n') || '  None'}
      `.trim();
      snippets.push({ score: scoreText(projectText, keywords), text: projectText });
    }
  }

  // --- Meetings ---
  for (const meeting of meetings) {
    const team = teams.find(t => t.id === meeting.teamId);
    const meetingText = `
MEETING: "${meeting.title}" | Date: ${meeting.date} | Team: ${team?.name || 'N/A'}
Attendees: ${(meeting.attendees || []).map(getDisplayName).join(', ') || 'None'}
Minutes: ${(meeting.minutes || '').substring(0, 300)}
Decisions: ${(meeting.decisions || []).map(d => d.text).join(' | ') || 'None'}
Action Items: ${(meeting.actionItems || []).map(a => `${a.description} (Owner: ${getDisplayName(a.ownerId)}, Due: ${a.dueDate}, Status: ${a.status})`).join(' | ') || 'None'}
    `.trim();
    snippets.push({ score: scoreText(meetingText, keywords), text: meetingText });
  }

  // --- Weekly Reports ---
  for (const report of weeklyReports) {
    const user = users.find(u => u.id === report.userId);
    const reportText = `
WEEKLY REPORT: ${user ? `${user.firstName} ${user.lastName}` : 'Unknown'} | Week of: ${report.weekOf}
Team Health: ${report.teamHealth || 'N/A'} | Project Health: ${report.projectHealth || 'N/A'}
New This Week: ${report.newThisWeek || 'None'}
Success: ${(report.mainSuccess || '').substring(0, 200)}
Issues: ${(report.mainIssue || '').substring(0, 200)}
Incidents: ${(report.incident || '').substring(0, 100)}
Organization: ${(report.orgaPoint || '').substring(0, 100)}
Other: ${(report.otherSection || '').substring(0, 100)}
    `.trim();
    snippets.push({ score: scoreText(reportText, keywords), text: reportText });
  }

  // --- Working Groups ---
  for (const wg of workingGroups) {
    const sessions = (wg.sessions || []).slice(0, 3); // last 3 sessions
    const wgText = `
WORKING GROUP: "${wg.title}"
Members: ${(wg.memberIds || []).map(getDisplayName).join(', ') || 'None'}
Recent Sessions:
${sessions.map(s => `  Session ${s.date}: ${(s.notes || '').substring(0, 200)}
  Decisions: ${(s.decisions || []).map(d => d.text).join(' | ') || 'None'}
  Actions: ${(s.actionItems || []).map(a => `${a.description} (${a.status})`).join(' | ') || 'None'}`).join('\n') || '  None'}
    `.trim();
    snippets.push({ score: scoreText(wgText, keywords), text: wgText });
  }

  // Sort by score descending, take top maxItems
  const topSnippets = snippets
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .filter(s => s.score > 0 || snippets.length <= maxItems); // include low-score if few items

  if (topSnippets.length === 0) {
    // Fallback: return a general summary of all teams
    const summary = teams.map(t =>
      `Team: ${t.name} | Projects: ${t.projects.map(p => p.name).join(', ') || 'None'}`
    ).join('\n');
    return `No closely matching data found for the query. General database overview:\n${summary}`;
  }

  return topSnippets.map(s => s.text).join('\n\n---\n\n');
};

// ---

const RAGChatSidebar: React.FC<RAGChatSidebarProps> = ({
  isOpen, onClose, llmConfig, teams, meetings, weeklyReports, workingGroups, users
}) => {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    const userEntry: ChatEntry = { role: 'user', content: question };
    const newHistory = [...history, userEntry];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // Build context from app data
      const context = buildContext(question, teams, meetings, weeklyReports, workingGroups, users);

      // Build conversation history for the LLM (exclude last user message, it's the current question)
      const llmHistory = history.map(h => ({ role: h.role, content: h.content }));

      const answer = await ragQuery(question, context, llmHistory, llmConfig);
      setHistory(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (e: any) {
      setHistory(prev => [...prev, {
        role: 'assistant',
        content: `**Error**: ${e.message || 'Failed to query the LLM.'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const totalDataItems =
    teams.reduce((n, t) => n + t.projects.length, 0) +
    meetings.length +
    weeklyReports.length +
    workingGroups.length;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}

      <div className={`fixed right-0 top-0 h-full bg-white dark:bg-slate-900 shadow-2xl z-50 transition-all duration-300 transform flex flex-col border-l border-slate-200 dark:border-slate-800 w-[90%] md:w-[55%] lg:w-[46%]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">RAG Search</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ask anything — searches {totalDataItems} items across the database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                title="Clear conversation"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-600 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome message */}
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1">Ask about your data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                  Search across projects, meetings, weekly reports, and working groups. The AI will find and summarize relevant information.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
                {[
                  'What are the blocked tasks across all projects?',
                  'Show me meetings from this month',
                  'What are the latest team health statuses?',
                  'Who owns the most action items?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    className="text-left px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-300 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {history.map((entry, idx) => (
            <div key={idx} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${entry.role === 'user'
                ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-900 dark:text-white shadow-sm'
              }`}>
                {entry.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <FormattedText text={entry.content} />
                  </div>
                ) : (
                  <p>{entry.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Searching database & generating answer...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your projects, meetings, reports... (Enter to send)"
              rows={2}
              className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Shift+Enter for new line · Enter to send · Results based solely on app data
          </p>
        </div>
      </div>
    </>
  );
};

export default RAGChatSidebar;
