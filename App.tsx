
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode, Component } from 'react';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import ProjectTracker from './components/ProjectTracker';
import KPIDashboard from './components/KPIDashboard';
import MeetingManager from './components/MeetingManager';
import SettingsPanel from './components/SettingsPanel';
import BookOfWork from './components/BookOfWork';
import WeeklyReport from './components/WeeklyReport';
import ManagementDashboard from './components/ManagementDashboard';
import Login from './components/Login';
import AIChatSidebar from './components/AIChatSidebar';
import PRJBotSidebar from './components/PRJBotSidebar';
import RAGChatSidebar from './components/RAGChatSidebar';
import NotificationPanel from './components/NotificationPanel';
import WorkingGroupModule from './components/WorkingGroup';
import SmartTodoManager from './components/SmartTodoManager';

import { loadState, saveState, subscribeToStoreUpdates, updateAppState, fetchFromServer, generateId, sanitizeAppState } from './services/storage';
import { AppState, User, Team, UserRole, Meeting, LLMConfig, WeeklyReport as WeeklyReportType, WorkingGroup, SystemMessage, AppNotification, SmartTodo } from './types';
import { Bell, Sun, Moon, Bot, RefreshCw, Cloud, CloudOff } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// --- Error Boundary ---
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => window.location.reload();
  handleReset = () => {
      if(window.confirm("Reset local data?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-100 dark:border-red-900/30 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">App Error</h1>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.toString()}</p>
            <button onClick={this.handleReload} className="bg-indigo-600 text-white px-4 py-2 rounded">Reload</button>
            <button onClick={this.handleReset} className="ml-2 text-red-600 hover:underline text-sm font-medium">Reset Data</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- ACCESS CONTROL UTILS ---

const getSubordinateIds = (rootId: string, allUsers: User[]): string[] => {
    const directs = allUsers.filter(u => u.managerId === rootId);
    let ids = directs.map(u => u.id);
    directs.forEach(d => {
        ids = [...ids, ...getSubordinateIds(d.id, allUsers)];
    });
    return ids;
};

const getFilteredState = (state: AppState): AppState => {
    // SmartTodos are always private — each user sees only their own
    const myTodos = (state.smartTodos || []).filter(t => t.userId === state.currentUser?.id);

    if (!state.currentUser || state.currentUser.role === UserRole.ADMIN) {
        return {
            ...state,
            smartTodos: myTodos,
            workingGroups: state.workingGroups || [],
            notifications: state.notifications || [],
            dismissedAlerts: state.dismissedAlerts || {},
            systemMessage: state.systemMessage || { active: false, content: '', level: 'info' }
        };
    }

    const myId = state.currentUser.id;
    const mySubordinates = getSubordinateIds(myId, state.users);
    const accessibleUserIds = [myId, ...mySubordinates];

    const filteredUsers = (state.users || []).filter(u => accessibleUserIds.includes(u.id));
    const filteredReports = (state.weeklyReports || []).filter(r => accessibleUserIds.includes(r.userId));

    const filteredGroups = (state.workingGroups || []).filter(g =>
        (g.memberIds || []).includes(myId) ||
        state.teams.some(t =>
            (t.projects || []).some(p =>
                p.id === g.projectId && (
                    p.managerId === myId ||
                    (p.members || []).some(m => m.userId === myId) ||
                    t.managerId === myId
                )
            )
        )
    );

    const filteredMeetings = (state.meetings || []).filter(m => {
        const hasAttendee = (m.attendees || []).some(attId => accessibleUserIds.includes(attId));
        const hasActionOwner = (m.actionItems || []).some(ai => accessibleUserIds.includes(ai.ownerId));
        return hasAttendee || hasActionOwner;
    });

    const filteredTeams = (state.teams || []).map(team => {
        const visibleProjects = (team.projects || []).filter(p => {
            const isManager = accessibleUserIds.includes(p.managerId || '');
            const isMember = (p.members || []).some(m => accessibleUserIds.includes(m.userId));
            const isSharedWith = (p.sharedWith || []).includes(myId);
            return isManager || isMember || isSharedWith;
        });

        const iManageTeam = accessibleUserIds.includes(team.managerId);

        if (iManageTeam) {
            return team;
        } else if (visibleProjects.length > 0) {
            return { ...team, projects: visibleProjects };
        }

        return null; // Hide team completely
    }).filter(t => t !== null) as Team[];

    return {
        ...state,
        users: filteredUsers,
        teams: filteredTeams,
        weeklyReports: filteredReports,
        meetings: filteredMeetings,
        workingGroups: filteredGroups,
        smartTodos: myTodos,
        notifications: state.notifications || [],
        dismissedAlerts: state.dismissedAlerts || {}
    };
};

// --- NOTIFICATION HELPERS ---

const createNotification = (
  type: AppNotification['type'],
  message: string,
  details?: string,
  targetRole: 'admin' | 'user' = 'admin',
  targetUserId?: string,
  triggeredBy?: string,
  relatedId?: string
): AppNotification => ({
  id: generateId(),
  type,
  message,
  details,
  relatedId,
  triggeredBy,
  targetRole,
  targetUserId,
  createdAt: new Date().toISOString(),
  seenBy: []
});

// Compute dynamic notifications (stale projects, overdue reports)
const computeDynamicNotifications = (state: AppState): AppNotification[] => {
  const notifications: AppNotification[] = [];
  const currentUser = state.currentUser;
  if (!currentUser || currentUser.role === UserRole.ADMIN) return notifications;

  const userId = currentUser.id;
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
  const today = now.toISOString().split('T')[0];
  const dismissedAlerts = state.dismissedAlerts || {};

  // 1. Stale project notifications (no audit update in 10 days)
  (state.teams || []).forEach(team => {
    (team.projects || []).forEach(project => {
      if (project.isArchived || project.status === 'Done') return;

      // Check if user follows this project (is member or manager)
      const isFollowing = (project.members || []).some(m => m.userId === userId) ||
                          project.managerId === userId ||
                          team.managerId === userId;
      if (!isFollowing) return;

      // Check last audit entry
      const auditLog = project.auditLog || [];
      const lastEntry = auditLog.length > 0
        ? auditLog.reduce((latest, entry) =>
            new Date(entry.date) > new Date(latest.date) ? entry : latest, auditLog[0])
        : null;

      const lastUpdateDate = lastEntry ? new Date(lastEntry.date) : null;
      const isStale = !lastUpdateDate || lastUpdateDate < tenDaysAgo;

      if (isStale) {
        const dismissKey = `stale_project_${project.id}_${userId}`;
        const dismissedDate = dismissedAlerts[dismissKey];

        // If dismissed today, skip; otherwise show again
        if (dismissedDate === today) return;

        const daysSince = lastUpdateDate
          ? Math.floor((now.getTime() - lastUpdateDate.getTime()) / 86400000)
          : null;

        notifications.push({
          id: `stale_${project.id}`,
          type: 'stale_project',
          message: `Project "${project.name}" has no updates${daysSince ? ` for ${daysSince} days` : ''}.`,
          details: lastEntry ? `Last activity: ${lastEntry.action} by ${lastEntry.userName}` : 'No activity recorded',
          relatedId: project.id,
          targetRole: 'user',
          targetUserId: userId,
          createdAt: now.toISOString(),
          seenBy: []
        });
      }
    });
  });

  // 2. Weekly report overdue notifications (no report in 8+ days)
  const userReports = (state.weeklyReports || []).filter(r => r.userId === userId);
  if (userReports.length === 0) {
    const dismissKey = `report_overdue_${userId}`;
    const dismissedDate = dismissedAlerts[dismissKey];
    if (dismissedDate !== today) {
      notifications.push({
        id: `report_overdue_${userId}`,
        type: 'report_overdue',
        message: 'You have never submitted a weekly report.',
        details: 'Please submit your weekly report to keep your team informed.',
        targetRole: 'user',
        targetUserId: userId,
        createdAt: now.toISOString(),
        seenBy: []
      });
    }
  } else {
    const sorted = [...userReports].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const lastReport = sorted[0];
    const lastReportDate = new Date(lastReport.updatedAt);

    if (lastReportDate < eightDaysAgo) {
      const daysSince = Math.floor((now.getTime() - lastReportDate.getTime()) / 86400000);
      const dismissKey = `report_overdue_${userId}`;
      const dismissedDate = dismissedAlerts[dismissKey];
      if (dismissedDate !== today) {
        notifications.push({
          id: `report_overdue_${userId}`,
          type: 'report_overdue',
          message: `Your last weekly report was ${daysSince} days ago.`,
          details: 'Please submit a new weekly report.',
          targetRole: 'user',
          targetUserId: userId,
          createdAt: now.toISOString(),
          seenBy: []
        });
      }
    }
  }

  return notifications;
};


const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [viewState, setViewState] = useState<AppState | null>(null);
  const [reportNotification, setReportNotification] = useState(false);

  // Sync Status
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // AI Sidebar
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  // PRJ Bot Sidebar
  const [isPrjBotOpen, setIsPrjBotOpen] = useState(false);

  // RAG Chat Sidebar
  const [isRagOpen, setIsRagOpen] = useState(false);

  // Notification Panel
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  // --- INITIAL LOAD & POLLING ---
  useEffect(() => {
    const localData = loadState();
    setAppState(localData);
    applyTheme(localData.theme);

    const initServerSync = async () => {
        try {
            const serverData = await fetchFromServer();
            if (serverData) {
                // Always prefer server data on startup to avoid desynchronization
                const mergedState = {
                    ...serverData,
                    currentUser: localData.currentUser,
                    theme: localData.theme,
                    llmConfig: localData.llmConfig || serverData.llmConfig
                };
                setAppState(mergedState);
                localStorage.setItem('teamsync_data_v15', JSON.stringify(mergedState));
                setIsOnline(true);
            } else {
                setIsOnline(false);
            }
        } finally {
            setIsInitialLoading(false);
        }
    };
    initServerSync();

    const intervalId = setInterval(async () => {
        const serverData = await fetchFromServer();
        if (serverData) {
            setIsOnline(true);
            setLastSyncTime(new Date());

            setAppState(currentState => {
                if (!currentState) return serverData;

                if ((serverData.lastUpdated || 0) > (currentState.lastUpdated || 0)) {
                    setShowSyncToast(true);
                    setTimeout(() => setShowSyncToast(false), 4000);

                    const mergedState = {
                        ...serverData,
                        currentUser: currentState.currentUser,
                        theme: currentState.theme,
                        llmConfig: currentState.llmConfig
                    };

                    localStorage.setItem('teamsync_data_v15', JSON.stringify(mergedState));
                    return mergedState;
                }
                return currentState;
            });
        } else {
            setIsOnline(false);
        }
    }, 10000);

    const unsubscribe = subscribeToStoreUpdates(() => {
        const freshState = loadState();
        setAppState(freshState);
    });

    // Conflict handler: when server rejects our save due to newer data
    const handleConflict = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.serverData) {
            const serverData = sanitizeAppState(detail.serverData);
            setAppState(currentState => {
                if (!currentState) return serverData;
                const mergedState = {
                    ...serverData,
                    currentUser: currentState.currentUser,
                    theme: currentState.theme,
                    llmConfig: currentState.llmConfig
                };
                localStorage.setItem('teamsync_data_v15', JSON.stringify(mergedState));
                return mergedState;
            });
            setShowSyncToast(true);
            setTimeout(() => setShowSyncToast(false), 4000);
        }
    };
    window.addEventListener('teamsync_conflict', handleConflict);

    return () => {
        unsubscribe();
        clearInterval(intervalId);
        window.removeEventListener('teamsync_conflict', handleConflict);
    };
  }, []);

  // Update View State whenever App State changes
  useEffect(() => {
      if (appState) {
          setViewState(getFilteredState(appState));
      }
  }, [appState]);

  const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  // Check reports logic
  useEffect(() => {
      if (viewState && viewState.currentUser) {
          const userReports = viewState.weeklyReports.filter(r => r.userId === viewState.currentUser?.id);
          if (userReports.length === 0) {
              setReportNotification(true);
          } else {
              const sorted = userReports.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
              const daysDiff = (new Date().getTime() - new Date(sorted[0].updatedAt).getTime()) / (1000 * 3600 * 24);
              setReportNotification(daysDiff > 6);
          }
      }
  }, [viewState?.weeklyReports, viewState?.currentUser]);

  // Compute dynamic notifications
  const dynamicNotifications = useMemo(() => {
    if (!appState) return [];
    return computeDynamicNotifications(appState);
  }, [appState?.teams, appState?.weeklyReports, appState?.currentUser, appState?.dismissedAlerts]);

  // Admin check at component level (also used in JSX render)
  const isAdmin = appState?.currentUser?.role === UserRole.ADMIN ?? false;

  // Count total unseen notifications for the bell badge
  const totalUnseenCount = useMemo(() => {
    if (!appState?.currentUser) return 0;
    const userId = appState.currentUser.id;

    const storedUnseen = (appState.notifications || []).filter(n => {
      if ((n.seenBy || []).includes(userId)) return false;
      if (n.targetRole === 'admin' && isAdmin) return true;
      if (n.targetRole === 'user' && n.targetUserId === userId) return true;
      return false;
    }).length;

    return storedUnseen + dynamicNotifications.length;
  }, [appState?.notifications, appState?.currentUser, dynamicNotifications]);

  const toggleTheme = () => {
      const newState = updateAppState(current => ({
          ...current,
          theme: current.theme === 'light' ? 'dark' : 'light'
      }));
      setAppState(newState);
      applyTheme(newState.theme);
  };

  const handleLogin = async (user: User) => {
      setIsInitialLoading(true);
      try {
          const serverData = await fetchFromServer();
          setAppState(currentState => {
              const baseData = serverData || currentState;
              if (!baseData) return null;

              const newState = {
                  ...baseData,
                  currentUser: user,
                  theme: currentState?.theme || 'light',
                  llmConfig: currentState?.llmConfig || baseData.llmConfig,
                  lastUpdated: Date.now()
              };
              localStorage.setItem('teamsync_data_v15', JSON.stringify(newState));
              return newState;
          });
      } finally {
          setIsInitialLoading(false);
      }
      setActiveTab('dashboard');
  }

  const handleLogout = () => {
      updateAppState(current => ({ ...current, currentUser: null }));
      window.location.reload();
  }

  // --- NOTIFICATION ACTIONS ---
  const addNotification = (notification: AppNotification) => {
    const newState = updateAppState(curr => ({
      ...curr,
      notifications: [...(curr.notifications || []), notification].slice(-100) // Keep last 100
    }));
    setAppState(newState);
  };

  const handleMarkNotificationSeen = (notificationId: string) => {
    if (!appState?.currentUser) return;
    const userId = appState.currentUser.id;

    // Check if it's a dynamic notification (stale/overdue)
    if (notificationId.startsWith('stale_') || notificationId.startsWith('report_overdue_')) {
      let dismissKey = '';
      if (notificationId.startsWith('stale_')) {
        const projectId = notificationId.replace('stale_', '');
        dismissKey = `stale_project_${projectId}_${userId}`;
      } else {
        dismissKey = `report_overdue_${userId}`;
      }

      const today = new Date().toISOString().split('T')[0];
      const newState = updateAppState(curr => ({
        ...curr,
        dismissedAlerts: { ...(curr.dismissedAlerts || {}), [dismissKey]: today }
      }));
      setAppState(newState);
      return;
    }

    // Regular stored notification
    const newState = updateAppState(curr => ({
      ...curr,
      notifications: (curr.notifications || []).map(n =>
        n.id === notificationId ? { ...n, seenBy: [...(n.seenBy || []), userId] } : n
      )
    }));
    setAppState(newState);
  };

  const handleMarkAllNotificationsSeen = () => {
    if (!appState?.currentUser) return;
    const userId = appState.currentUser.id;
    const today = new Date().toISOString().split('T')[0];

    // Mark all stored notifications as seen
    const newDismissed = { ...(appState.dismissedAlerts || {}) };
    dynamicNotifications.forEach(n => {
      if (n.id.startsWith('stale_')) {
        const projectId = n.id.replace('stale_', '');
        newDismissed[`stale_project_${projectId}_${userId}`] = today;
      } else if (n.id.startsWith('report_overdue_')) {
        newDismissed[`report_overdue_${userId}`] = today;
      }
    });

    const newState = updateAppState(curr => ({
      ...curr,
      notifications: (curr.notifications || []).map(n => {
        const isRelevant = (n.targetRole === 'admin' && appState.currentUser?.role === UserRole.ADMIN) ||
                           (n.targetRole === 'user' && n.targetUserId === userId);
        if (isRelevant && !(n.seenBy || []).includes(userId)) {
          return { ...n, seenBy: [...(n.seenBy || []), userId] };
        }
        return n;
      }),
      dismissedAlerts: newDismissed
    }));
    setAppState(newState);
  };

  // --- HANDLERS ---
  const createHandler = <T,>(updater: (current: AppState, payload: T) => AppState) => {
      return (payload: T) => {
          const newState = updateAppState(curr => updater(curr, payload));
          setAppState(newState);
      };
  };

  const handleUpdateUser = createHandler((curr, u: User) => ({...curr, users: curr.users.map(us => us.id === u.id ? u : us)}));
  const handleAddUser = createHandler((curr, u: User) => ({...curr, users: [...curr.users, u]}));
  const handleDeleteUser = createHandler((curr, id: string) => ({...curr, users: curr.users.filter(u => u.id !== id)}));

  // Enhanced handleUpdateTeam that generates notifications
  const handleUpdateTeam = (updatedTeamFromUI: Team) => {
      const newState = updateAppState(curr => {
          const originalTeam = curr.teams.find(t => t.id === updatedTeamFromUI.id);
          let finalTeam: Team;
          const newNotifications: AppNotification[] = [];
          const currentUserName = curr.currentUser
            ? `${curr.currentUser.firstName} ${curr.currentUser.lastName}`
            : 'Unknown';

          if (!originalTeam) {
              finalTeam = updatedTeamFromUI;

              // New team with projects → generate project_created notifications
              finalTeam.projects.forEach(p => {
                newNotifications.push(createNotification(
                  'project_created',
                  `${currentUserName} created project "${p.name}"`,
                  `Team: ${finalTeam.name}`,
                  'admin',
                  undefined,
                  curr.currentUser?.id,
                  p.id
                ));
              });

              return {
                ...curr,
                teams: [...curr.teams, finalTeam],
                notifications: [...(curr.notifications || []), ...newNotifications].slice(-100)
              };
          } else {
              const visibleProjectIds = updatedTeamFromUI.projects.map(p => p.id);
              const hiddenProjects = originalTeam.projects.filter(p => !visibleProjectIds.includes(p.id));
              finalTeam = {
                  ...updatedTeamFromUI,
                  projects: [...updatedTeamFromUI.projects, ...hiddenProjects]
              };

              // Detect new projects
              const originalProjectIds = originalTeam.projects.map(p => p.id);
              updatedTeamFromUI.projects.forEach(p => {
                if (!originalProjectIds.includes(p.id)) {
                  newNotifications.push(createNotification(
                    'project_created',
                    `${currentUserName} created project "${p.name}"`,
                    `Team: ${finalTeam.name}`,
                    'admin',
                    undefined,
                    curr.currentUser?.id,
                    p.id
                  ));
                }
              });

              // Detect updated projects (compare tasks count, status, etc.)
              updatedTeamFromUI.projects.forEach(p => {
                const orig = originalTeam.projects.find(op => op.id === p.id);
                if (!orig) return;

                // New tasks
                const origTaskIds = orig.tasks.map(t => t.id);
                p.tasks.forEach(t => {
                  if (!origTaskIds.includes(t.id)) {
                    newNotifications.push(createNotification(
                      'task_created',
                      `${currentUserName} created task "${t.title}"`,
                      `Project: ${p.name}`,
                      'admin',
                      undefined,
                      curr.currentUser?.id,
                      t.id
                    ));
                  }
                });

                // Task updates (status changes)
                p.tasks.forEach(t => {
                  const origTask = orig.tasks.find(ot => ot.id === t.id);
                  if (origTask && origTask.status !== t.status) {
                    newNotifications.push(createNotification(
                      'task_updated',
                      `${currentUserName} updated task "${t.title}" to ${t.status}`,
                      `Project: ${p.name}`,
                      'admin',
                      undefined,
                      curr.currentUser?.id,
                      t.id
                    ));
                  }
                });

                // Project status change
                if (orig.status !== p.status) {
                  newNotifications.push(createNotification(
                    'project_updated',
                    `${currentUserName} changed "${p.name}" status to ${p.status}`,
                    `Team: ${finalTeam.name}`,
                    'admin',
                    undefined,
                    curr.currentUser?.id,
                    p.id
                  ));
                }
              });

              return {
                  ...curr,
                  teams: curr.teams.map(t => t.id === finalTeam.id ? finalTeam : t),
                  notifications: [...(curr.notifications || []), ...newNotifications].slice(-100)
              };
          }
      });
      setAppState(newState);
  };

  const handleAddTeam = createHandler((curr, t: Team) => ({...curr, teams: [...curr.teams, t]}));
  const handleDeleteTeam = createHandler((curr, id: string) => ({...curr, teams: curr.teams.filter(t => t.id !== id)}));

  // Direct project deletion bypassing team merge logic
  const handleDeleteProject = (teamId: string, projectId: string) => {
      const newState = updateAppState(curr => ({
          ...curr,
          teams: curr.teams.map(t =>
              t.id === teamId
                  ? { ...t, projects: t.projects.filter(p => p.id !== projectId) }
                  : t
          )
      }));
      setAppState(newState);
  };

  // Transfer a project from one team to another
  const handleTransferProject = (fromTeamId: string, projectId: string, toTeamId: string) => {
      const newState = updateAppState(curr => {
          const fromTeam = curr.teams.find(t => t.id === fromTeamId);
          if (!fromTeam) return curr;
          const project = fromTeam.projects.find(p => p.id === projectId);
          if (!project) return curr;

          return {
              ...curr,
              teams: curr.teams.map(t => {
                  if (t.id === fromTeamId) {
                      return { ...t, projects: t.projects.filter(p => p.id !== projectId) };
                  }
                  if (t.id === toTeamId) {
                      return { ...t, projects: [...t.projects, project] };
                  }
                  return t;
              })
          };
      });
      setAppState(newState);
  };

  const handleUpdateReport = createHandler((curr, r: WeeklyReportType) => {
      const idx = curr.weeklyReports.findIndex(rep => rep.id === r.id);
      const newReports = [...curr.weeklyReports];
      const isNew = idx < 0;
      if (idx >= 0) newReports[idx] = r; else newReports.push(r);

      const currentUserName = curr.currentUser
        ? `${curr.currentUser.firstName} ${curr.currentUser.lastName}`
        : 'Unknown';

      const notif = createNotification(
        isNew ? 'report_created' : 'report_updated',
        `${currentUserName} ${isNew ? 'submitted' : 'updated'} a weekly report`,
        `Week of: ${r.weekOf}`,
        'admin',
        undefined,
        curr.currentUser?.id,
        r.id
      );

      return {
        ...curr,
        weeklyReports: newReports,
        notifications: [...(curr.notifications || []), notif].slice(-100)
      };
  });

  const handleDeleteReport = createHandler((curr, id: string) => ({...curr, weeklyReports: curr.weeklyReports.filter(r => r.id !== id)}));

  const handleUpdateMeeting = createHandler((curr, m: Meeting) => {
      const idx = curr.meetings.findIndex(mt => mt.id === m.id);
      const newMeetings = [...curr.meetings];
      if (idx >= 0) newMeetings[idx] = m; else newMeetings.push(m);
      return {...curr, meetings: newMeetings};
  });
  const handleDeleteMeeting = createHandler((curr, id: string) => ({...curr, meetings: curr.meetings.filter(m => m.id !== id)}));

  const handleUpdateGroup = createHandler((curr, g: WorkingGroup) => {
      const groups = curr.workingGroups || [];
      const idx = groups.findIndex(grp => grp.id === g.id);
      const newGroups = [...groups];
      if (idx >= 0) newGroups[idx] = g; else newGroups.push(g);
      return {...curr, workingGroups: newGroups};
  });
  const handleDeleteGroup = createHandler((curr, id: string) => ({...curr, workingGroups: (curr.workingGroups || []).filter(g => g.id !== id)}));

  const handleSaveTodo = createHandler((curr, todo: SmartTodo) => {
      const todos = curr.smartTodos || [];
      const idx = todos.findIndex(t => t.id === todo.id);
      const newTodos = [...todos];
      if (idx >= 0) newTodos[idx] = todo; else newTodos.push(todo);
      return { ...curr, smartTodos: newTodos };
  });
  const handleDeleteTodo = createHandler((curr, id: string) => ({...curr, smartTodos: (curr.smartTodos || []).filter(t => t.id !== id)}));

  const handleUpdateLLMConfig = (config: LLMConfig, prompts?: Record<string, string>) => {
      const newState = updateAppState(curr => ({...curr, llmConfig: config, prompts: prompts || curr.prompts}));
      setAppState(newState);
  };

  const handleUpdateUserPassword = (userId: string, newPass: string) => {
      const newState = updateAppState(curr => ({
          ...curr,
          users: curr.users.map(u => u.id === userId ? { ...u, password: newPass } : u)
      }));
      setAppState(newState);
  };

  const handleUpdateSystemMessage = (msg: SystemMessage) => {
      const newState = updateAppState(curr => ({ ...curr, systemMessage: msg }));
      setAppState(newState);
  }

  const handleImportState = (newState: AppState) => {
      setAppState(newState);
      saveState(newState);
      window.location.reload();
  }

  // --- RENDER ---

  if (!appState || !viewState) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="text-center"><RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400 font-medium">Loading Smart System...</p></div></div>;

  if (!appState.currentUser) {
      if (isInitialLoading) {
          return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="text-center"><RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400 font-medium">Syncing with server...</p><p className="text-xs text-gray-400 mt-1">Ensuring latest data before login</p></div></div>;
      }
      return <Login users={appState.users} onLogin={handleLogin} />;
  }

  if (isInitialLoading) {
      return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="text-center"><RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400 font-medium">Syncing data...</p></div></div>;
  }

  const getPageTitle = () => {
      return activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ');
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen font-sans transition-colors duration-200">

      {/* Smart Sync Toast */}
      {showSyncToast && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <div className="flex flex-col">
                  <span className="text-sm font-bold">Data Updated</span>
                  <span className="text-[10px] opacity-80">Synced from server changes</span>
              </div>
          </div>
      )}

      <AIChatSidebar
        isOpen={isAiSidebarOpen}
        onClose={() => setIsAiSidebarOpen(false)}
        llmConfig={appState.llmConfig}
        currentUser={appState.currentUser}
      />

      <PRJBotSidebar
        isOpen={isPrjBotOpen}
        onClose={() => setIsPrjBotOpen(false)}
        llmConfig={appState.llmConfig}
        currentUser={appState.currentUser}
        teams={viewState.teams}
        users={viewState.users}
        onUpdateTeam={handleUpdateTeam}
      />

      <RAGChatSidebar
        isOpen={isRagOpen}
        onClose={() => setIsRagOpen(false)}
        llmConfig={appState.llmConfig}
        teams={viewState.teams}
        meetings={viewState.meetings}
        weeklyReports={viewState.weeklyReports}
        workingGroups={viewState.workingGroups || []}
        users={viewState.users}
      />

      <Sidebar
        currentUser={appState.currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white capitalize">
                    {getPageTitle()}
                </h2>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${isOnline ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                    {isOnline ? 'LIVE SYNC' : 'OFFLINE'}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* AI Assistant Button */}
                <button
                    onClick={() => setIsAiSidebarOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </button>

                {/* PRJ Bot Button */}
                <button
                    onClick={() => setIsPrjBotOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <Bot className="w-4 h-4" />
                    PRJ Bot
                </button>

                {/* RAG Button - Admin only */}
                {isAdmin && (
                    <button
                        onClick={() => setIsRagOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                    >
                        <Bot className="w-4 h-4" />
                        RAG
                    </button>
                )}

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        {appState.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
                    </button>

                    {/* Notification Bell */}
                    <div className="relative">
                      <button
                        onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)}
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                      >
                          <Bell className={`w-5 h-5 ${totalUnseenCount > 0 || reportNotification ? 'text-red-500' : ''}`} />
                          {totalUnseenCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-gray-900 px-1">
                              {totalUnseenCount > 99 ? '99+' : totalUnseenCount}
                            </span>
                          )}
                          {totalUnseenCount === 0 && reportNotification && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                          )}
                      </button>

                      {isNotifPanelOpen && (
                        <NotificationPanel
                          isOpen={isNotifPanelOpen}
                          onClose={() => setIsNotifPanelOpen(false)}
                          notifications={appState.notifications || []}
                          dynamicNotifications={dynamicNotifications}
                          currentUser={appState.currentUser}
                          onMarkSeen={handleMarkNotificationSeen}
                          onMarkAllSeen={handleMarkAllNotificationsSeen}
                        />
                      )}
                    </div>
                </div>
            </div>
        </header>

        {/* Content */}
        <div className="p-8">
            {activeTab === 'dashboard' && <KPIDashboard teams={viewState.teams} systemMessage={viewState.systemMessage} />}
            {activeTab === 'management' && <ManagementDashboard teams={viewState.teams} users={viewState.users} reports={viewState.weeklyReports} meetings={viewState.meetings} workingGroups={viewState.workingGroups || []} llmConfig={appState.llmConfig} onUpdateReport={handleUpdateReport} onUpdateTeam={handleUpdateTeam} notifications={appState.notifications || []} currentUserId={appState.currentUser?.id || ''} onMarkNotificationSeen={handleMarkNotificationSeen} />}
            {activeTab === 'projects' && <ProjectTracker teams={viewState.teams} users={viewState.users} currentUser={appState.currentUser} llmConfig={appState.llmConfig} prompts={appState.prompts} onUpdateTeam={handleUpdateTeam} onDeleteProject={handleDeleteProject} onTransferProject={handleTransferProject} allTeams={appState.teams} allUsers={appState.users} />}
            {activeTab === 'book-of-work' && <BookOfWork teams={viewState.teams} users={viewState.users} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'working-groups' && <WorkingGroupModule groups={viewState.workingGroups || []} users={viewState.users} teams={viewState.teams} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onUpdateGroup={handleUpdateGroup} onDeleteGroup={handleDeleteGroup} />}
            {activeTab === 'weekly-report' && <WeeklyReport reports={viewState.weeklyReports} users={viewState.users} teams={viewState.teams} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onSaveReport={handleUpdateReport} onDeleteReport={handleDeleteReport} />}
            {activeTab === 'meetings' && <MeetingManager meetings={viewState.meetings} teams={viewState.teams} users={viewState.users} llmConfig={appState.llmConfig} onUpdateMeeting={handleUpdateMeeting} onDeleteMeeting={handleDeleteMeeting} />}
            {activeTab === 'smart-todo' && appState.currentUser && <SmartTodoManager todos={viewState.smartTodos || []} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onSaveTodo={handleSaveTodo} onDeleteTodo={handleDeleteTodo} users={appState.users} onAddNotification={addNotification} />}
            {activeTab === 'admin-users' && <AdminPanel users={appState.users} teams={appState.teams} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} />}
            {activeTab === 'settings' && <SettingsPanel config={appState.llmConfig} appState={appState} onSave={handleUpdateLLMConfig} onImport={handleImportState} onUpdateUserPassword={handleUpdateUserPassword} onUpdateSystemMessage={handleUpdateSystemMessage} />}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
};

export default App;
