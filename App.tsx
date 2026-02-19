
import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
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
import WorkingGroupModule from './components/WorkingGroup';

import { loadState, saveState, subscribeToStoreUpdates, updateAppState, fetchFromServer } from './services/storage';
import { AppState, User, Team, UserRole, Meeting, LLMConfig, WeeklyReport as WeeklyReportType, WorkingGroup, SystemMessage } from './types';
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

// Recursive function to get all subordinate IDs (direct and indirect)
const getSubordinateIds = (rootId: string, allUsers: User[]): string[] => {
    const directs = allUsers.filter(u => u.managerId === rootId);
    let ids = directs.map(u => u.id);
    directs.forEach(d => {
        ids = [...ids, ...getSubordinateIds(d.id, allUsers)];
    });
    return ids;
};

// Filter the AppState based on the Current User's hierarchy role
const getFilteredState = (state: AppState): AppState => {
    // 1. If Admin, see everything
    if (!state.currentUser || state.currentUser.role === UserRole.ADMIN) {
        // Ensure defaults even for admin to prevent crashes
        return {
            ...state,
            workingGroups: state.workingGroups || [],
            systemMessage: state.systemMessage || { active: false, content: '', level: 'info' }
        };
    }

    const myId = state.currentUser.id;
    // 2. Get list of all people under me + myself
    const mySubordinates = getSubordinateIds(myId, state.users);
    const accessibleUserIds = [myId, ...mySubordinates];

    // --- FILTER USERS ---
    // I can see myself and anyone below me
    const filteredUsers = state.users.filter(u => accessibleUserIds.includes(u.id));

    // --- FILTER REPORTS ---
    // I can see reports from myself or anyone below me
    const filteredReports = state.weeklyReports.filter(r => accessibleUserIds.includes(r.userId));

    // --- FILTER WORKING GROUPS ---
    const filteredGroups = (state.workingGroups || []).filter(g => 
        g.memberIds.includes(myId) || // I am member
        state.teams.some(t => // Or linked to a project I manage/member
            t.projects.some(p => 
                p.id === g.projectId && (
                    p.managerId === myId || 
                    p.members.some(m => m.userId === myId) ||
                    t.managerId === myId
                )
            )
        )
    );

    // --- FILTER MEETINGS ---
    // I can see meetings where I (or a subordinate) am an attendee OR an action owner
    const filteredMeetings = state.meetings.filter(m => {
        // Is creator/attendee in my scope?
        const hasAttendee = m.attendees.some(attId => accessibleUserIds.includes(attId));
        // Is action owner in my scope?
        const hasActionOwner = m.actionItems.some(ai => accessibleUserIds.includes(ai.ownerId));
        return hasAttendee || hasActionOwner;
    });

    // --- FILTER TEAMS & PROJECTS (Complex) ---
    const filteredTeams = state.teams.map(team => {
        // Filter projects first
        const visibleProjects = team.projects.filter(p => {
            const isManager = accessibleUserIds.includes(p.managerId || '');
            const isMember = p.members.some(m => accessibleUserIds.includes(m.userId));
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
        workingGroups: filteredGroups
        // System message is always passed through
    };
};


const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [viewState, setViewState] = useState<AppState | null>(null); // The filtered state for UI
  const [reportNotification, setReportNotification] = useState(false);
  
  // Sync Status
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [showSyncToast, setShowSyncToast] = useState(false);

  // AI Sidebar
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  // --- INITIAL LOAD & POLLING ---
  useEffect(() => {
    // 1. Load Local first (Instant UI)
    const localData = loadState();
    setAppState(localData);
    applyTheme(localData.theme);

    // 2. Fetch Server Data Immediately (Central Truth)
    const initServerSync = async () => {
        const serverData = await fetchFromServer();
        if (serverData) {
            // Merge logic: Take server data but keep local session (User & Theme)
            if ((serverData.lastUpdated || 0) > (localData.lastUpdated || 0)) {
                console.log("📥 Initial Load: Server data is newer. Updating content.");
                const mergedState = {
                    ...serverData,
                    currentUser: localData.currentUser, // KEEP LOCAL SESSION
                    theme: localData.theme // KEEP LOCAL THEME
                };
                setAppState(mergedState);
                localStorage.setItem('teamsync_data_v15', JSON.stringify(mergedState));
            }
            setIsOnline(true);
        } else {
            setIsOnline(false);
        }
    };
    initServerSync();

    // 3. Polling Interval
    const intervalId = setInterval(async () => {
        const serverData = await fetchFromServer();
        if (serverData) {
            setIsOnline(true);
            setLastSyncTime(new Date());
            
            setAppState(currentState => {
                if (!currentState) return serverData;
                
                if ((serverData.lastUpdated || 0) > (currentState.lastUpdated || 0)) {
                    console.log("🔄 Auto-Sync: New data received from server.");
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

    return () => {
        unsubscribe();
        clearInterval(intervalId);
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

  // Check reports logic (Use ViewState to only notify about relevant reports)
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

  const toggleTheme = () => {
      const newState = updateAppState(current => ({
          ...current,
          theme: current.theme === 'light' ? 'dark' : 'light'
      }));
      setAppState(newState);
      applyTheme(newState.theme);
  };

  const handleLogin = (user: User) => {
      fetchFromServer().then(serverData => {
          setAppState(currentState => {
              const baseData = serverData || currentState;
              if (!baseData) return null;

              const newState = {
                  ...baseData,
                  currentUser: user,
                  lastUpdated: Date.now()
              };
              localStorage.setItem('teamsync_data_v15', JSON.stringify(newState));
              return newState;
          });
      });
      setActiveTab('dashboard');
  }

  const handleLogout = () => {
      updateAppState(current => ({ ...current, currentUser: null }));
      window.location.reload(); 
  }

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
  
  const handleUpdateTeam = (updatedTeamFromUI: Team) => {
      const newState = updateAppState(curr => {
          const originalTeam = curr.teams.find(t => t.id === updatedTeamFromUI.id);
          let finalTeam: Team;
          if (!originalTeam) {
              finalTeam = updatedTeamFromUI;
              return { ...curr, teams: [...curr.teams, finalTeam] };
          } else {
              const visibleProjectIds = updatedTeamFromUI.projects.map(p => p.id);
              const hiddenProjects = originalTeam.projects.filter(p => !visibleProjectIds.includes(p.id));
              finalTeam = {
                  ...updatedTeamFromUI,
                  projects: [...updatedTeamFromUI.projects, ...hiddenProjects]
              };
              return {
                  ...curr,
                  teams: curr.teams.map(t => t.id === finalTeam.id ? finalTeam : t)
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
      if (idx >= 0) newReports[idx] = r; else newReports.push(r);
      return {...curr, weeklyReports: newReports};
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
      // Ensure workingGroups exists before map/find
      const groups = curr.workingGroups || [];
      const idx = groups.findIndex(grp => grp.id === g.id);
      const newGroups = [...groups];
      if (idx >= 0) newGroups[idx] = g; else newGroups.push(g);
      return {...curr, workingGroups: newGroups};
  });
  const handleDeleteGroup = createHandler((curr, id: string) => ({...curr, workingGroups: (curr.workingGroups || []).filter(g => g.id !== id)}));

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

  if (!appState || !viewState) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">Loading Smart System...</div>;

  if (!appState.currentUser) {
      return <Login users={appState.users} onLogin={handleLogin} />;
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
                {/* Connection Status Indicator */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${isOnline ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                    {isOnline ? 'LIVE SYNC' : 'OFFLINE'}
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <button 
                    onClick={() => setIsAiSidebarOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        {appState.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
                    </button>
                    <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative">
                        <Bell className={`w-5 h-5 ${reportNotification ? 'text-red-500' : ''}`} />
                        {reportNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>}
                    </button>
                </div>
            </div>
        </header>

        {/* Content - PASS VIEWSTATE (Filtered) to components */}
        <div className="p-8">
            {activeTab === 'dashboard' && <KPIDashboard teams={viewState.teams} systemMessage={viewState.systemMessage} />}
            {activeTab === 'management' && <ManagementDashboard teams={viewState.teams} users={viewState.users} reports={viewState.weeklyReports} meetings={viewState.meetings} workingGroups={viewState.workingGroups || []} llmConfig={appState.llmConfig} onUpdateReport={handleUpdateReport} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'projects' && <ProjectTracker teams={viewState.teams} users={viewState.users} currentUser={appState.currentUser} llmConfig={appState.llmConfig} prompts={appState.prompts} onUpdateTeam={handleUpdateTeam} onDeleteProject={handleDeleteProject} onTransferProject={handleTransferProject} allTeams={appState.teams} allUsers={appState.users} />}
            {activeTab === 'book-of-work' && <BookOfWork teams={viewState.teams} users={viewState.users} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'working-groups' && <WorkingGroupModule groups={viewState.workingGroups || []} users={viewState.users} teams={viewState.teams} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onUpdateGroup={handleUpdateGroup} onDeleteGroup={handleDeleteGroup} />}
            {activeTab === 'weekly-report' && <WeeklyReport reports={viewState.weeklyReports} users={viewState.users} teams={viewState.teams} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onSaveReport={handleUpdateReport} onDeleteReport={handleDeleteReport} />}
            {activeTab === 'meetings' && <MeetingManager meetings={viewState.meetings} teams={viewState.teams} users={viewState.users} llmConfig={appState.llmConfig} onUpdateMeeting={handleUpdateMeeting} onDeleteMeeting={handleDeleteMeeting} />}
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
