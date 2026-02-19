
import React, { useState, useEffect } from 'react';
import { Team, Project, Task, TaskStatus, TaskPriority, ProjectStatus, User, UserRole, LLMConfig, ChecklistItem, ExternalDependency, TaskAction, TaskActionStatus } from '../types';
import { generateTeamReport, generateProjectRoadmap, generateProjectCard } from '../services/llmService';
import FormattedText from './FormattedText';
import LanguagePickerModal from './LanguagePickerModal';
import {
    CheckCircle2, Clock, AlertCircle, PlayCircle, PauseCircle, Plus,
    ChevronDown, Bot, Calendar, Users as UsersIcon, MoreHorizontal,
    Flag, UserCircle2, Pencil, AlertTriangle, X, Save, Trash2, Scale, ListTodo, ArrowUpAz, Download, Copy, Eye, EyeOff, Sparkles, Briefcase, Link2, CheckSquare, Square, UserPlus, MessageCircle, Map, Crown, PenTool, LayoutList, BrainCircuit, Archive, RotateCcw, Coins, Star, ArrowUp, ArrowDown, ArrowRightLeft, Share2
} from 'lucide-react';

interface ProjectTrackerProps {
  teams: Team[];
  users: User[];
  currentUser: User | null;
  llmConfig: LLMConfig;
  prompts?: Record<string, string>;
  onUpdateTeam: (team: Team) => void;
  onDeleteProject?: (teamId: string, projectId: string) => void;
  onTransferProject?: (fromTeamId: string, projectId: string, toTeamId: string) => void;
  allTeams?: Team[];
  allUsers?: User[];
}

const ProjectTracker: React.FC<ProjectTrackerProps> = ({ teams, users, currentUser, llmConfig, prompts, onUpdateTeam, onDeleteProject, onTransferProject, allTeams, allUsers }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Selection State for AI Report
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // View Mode: Live vs Archived
  const [showArchived, setShowArchived] = useState(false);

  // Modals state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<{ projectId: string, task: Task } | null>(null);
  const [showAuditModal, setShowAuditModal] = useState<string | null>(null); // Project ID for Audit
  
  // Transfer Modal State
  const [transferProject, setTransferProject] = useState<{ projectId: string, projectName: string } | null>(null);
  const [transferTargetTeamId, setTransferTargetTeamId] = useState<string>('');

  // New Checklist Item State
  const [newChecklistItem, setNewChecklistItem] = useState('');
  
  // Checklist Item Commenting
  const [checklistCommentId, setChecklistCommentId] = useState<string | null>(null); // Track which item is being commented on

  // New Action State
  const [newActionText, setNewActionText] = useState('');

  // New Dependency State
  const [newDepLabel, setNewDepLabel] = useState('');
  const [newDepStatus, setNewDepStatus] = useState<'Green' | 'Amber' | 'Red'>('Green');
  
  // New Project URL State
  const [newProjectUrl, setNewProjectUrl] = useState('');
  const [newTaskUrl, setNewTaskUrl] = useState('');

  // View Context State
  const [showContextForProject, setShowContextForProject] = useState<string | null>(null);

  // AI Roadmap State
  const [aiRoadmap, setAiRoadmap] = useState<string | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);

  // AI Project Card State
  const [aiProjectCard, setAiProjectCard] = useState<string | null>(null);
  const [loadingProjectCard, setLoadingProjectCard] = useState(false);
  const [showProjectCardModal, setShowProjectCardModal] = useState(false);

  // Language Picker State
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [pendingLlmAction, setPendingLlmAction] = useState<((lang: 'fr' | 'en') => void) | null>(null);

  const currentTeam = teams.find(t => t.id === selectedTeamId);
  const teamManager = users.find(u => u.id === currentTeam?.managerId);

  // Reset selection when team changes
  useEffect(() => {
      setSelectedProjectIds([]);
      setAiReport(null);
  }, [selectedTeamId]);

  // Handle Escape Key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setEditingProject(null);
            setEditingTask(null);
            setShowRoadmapModal(false);
            setShowProjectCardModal(false);
            setShowAuditModal(null);
            setTransferProject(null);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Helper Functions ---

  const addAuditEntry = (project: Project, action: string, details?: string) => {
      const newEntry = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          userName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown',
          action,
          details
      };
      const currentLog = project.auditLog || [];
      // Keep last 20
      return [newEntry, ...currentLog].slice(0, 20);
  };

  const getStatusColor = (status: TaskStatus | ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DONE:
      case TaskStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
      case ProjectStatus.ACTIVE:
      case TaskStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case TaskStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
      case ProjectStatus.PAUSED: return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      case ProjectStatus.PLANNING: return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    }
  };

  const getActionStatusColor = (status: TaskActionStatus) => {
      switch(status) {
          case 'Done': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
          case 'Blocked': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
          case 'Ongoing': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
          case 'To Do': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
      }
  };

  const getPriorityColor = (priority: TaskPriority) => {
      switch(priority) {
          case TaskPriority.URGENT: return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
          case TaskPriority.HIGH: return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
          case TaskPriority.MEDIUM: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
          case TaskPriority.LOW: return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
      }
  };

  const getRagColor = (status: 'Red' | 'Amber' | 'Green') => {
      switch(status) {
          case 'Red': return 'bg-red-500 text-white';
          case 'Amber': return 'bg-amber-500 text-white';
          case 'Green': return 'bg-emerald-500 text-white';
          default: return 'bg-slate-400';
      }
  };

  const toggleProjectExpansion = (projectId: string) => {
      setExpandedProjectIds(prev => 
          prev.includes(projectId) 
              ? prev.filter(id => id !== projectId) 
              : [...prev, projectId]
      );
  };

  const collapseAllProjects = () => {
      setExpandedProjectIds([]);
  };

  const toggleProjectSelection = (projectId: string) => {
      setSelectedProjectIds(prev => 
          prev.includes(projectId) 
              ? prev.filter(id => id !== projectId) 
              : [...prev, projectId]
      );
  };

  const toggleSelectAll = () => {
      if (!currentTeam) return;
      const visibleProjects = currentTeam.projects.filter(p => !!p.isArchived === showArchived);
      
      if (selectedProjectIds.length === visibleProjects.length) {
          setSelectedProjectIds([]);
      } else {
          setSelectedProjectIds(visibleProjects.map(p => p.id));
      }
  };

  // Language picker trigger helper
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

  const handleGenerateReport = () => {
    if (!currentTeam) return;
    askLanguageThen(async (lang) => {
        setLoadingAi(true);
        setAiReport(null);

        const visibleProjects = currentTeam.projects.filter(p => !!p.isArchived === showArchived);
        const projectsToAnalyze = selectedProjectIds.length > 0
            ? visibleProjects.filter(p => selectedProjectIds.includes(p.id))
            : visibleProjects;

        const scopedTeam = {
            ...currentTeam,
            projects: projectsToAnalyze
        };

        const report = await generateTeamReport(scopedTeam, teamManager, llmConfig, prompts, lang);
        setAiReport(report);
        setLoadingAi(false);
    });
  };

  const handleGenerateRoadmap = (project: Project) => {
      askLanguageThen(async (lang) => {
          setLoadingRoadmap(true);
          setShowRoadmapModal(true);
          setAiRoadmap(null);
          const roadmap = await generateProjectRoadmap(project, users, llmConfig, prompts, lang);
          setAiRoadmap(roadmap);
          setLoadingRoadmap(false);
      });
  };

  const handleGenerateProjectCard = () => {
      if (!currentTeam) return;
      askLanguageThen(async (lang) => {
          setLoadingProjectCard(true);
          setShowProjectCardModal(true);
          setAiProjectCard(null);

          const visibleProjects = currentTeam.projects.filter(p => !!p.isArchived === showArchived);
          const projectsToAnalyze = selectedProjectIds.length > 0
              ? visibleProjects.filter(p => selectedProjectIds.includes(p.id))
              : visibleProjects;

          const card = await generateProjectCard(projectsToAnalyze, users, llmConfig, lang);
          setAiProjectCard(card);
          setLoadingProjectCard(false);
      });
  };

  const cleanTextForClipboard = (text: string) => {
      return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/__(.*?)__/g, '$1') // Remove underline
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/###\s?(.*)/g, '\n$1\n') // Headers to new lines
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
          .replace(/^-\s/gm, '• ') // Replace dashes with bullets
          .replace(/^\*\s/gm, '• ') // Replace asterisks with bullets
          .trim();
  };

  const copyToClipboard = (text: string | null) => {
    if (!text) return;
    const plainText = cleanTextForClipboard(text);
    navigator.clipboard.writeText(plainText);
    alert("Copied to clipboard (Plain Text)!");
  };

  const exportToDoc = (text: string | null, filename: string) => {
      if (!text) return;
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = filename; 
      document.body.appendChild(element);
      element.click();
  };

  const updateTeamData = (fn: (t: Team) => void) => {
      if(!currentTeam) return;
      const updatedTeam = { ...currentTeam };
      fn(updatedTeam);
      onUpdateTeam(updatedTeam);
  }

  const handleCreateProject = () => {
      // Default new project structure
      const newProject: Project = {
          id: Date.now().toString(),
          name: '',
          description: '',
          status: ProjectStatus.PLANNING,
          managerId: currentUser?.id,
          owner: '',
          architect: '',
          deadline: new Date().toISOString().split('T')[0],
          members: [],
          tasks: [],
          isImportant: false,
          isArchived: false,
          docUrls: [],
          dependencies: [],
          externalDependencies: [],
          additionalDescriptions: [],
          cost: 0,
          auditLog: []
      };
      setEditingProject(newProject);
  };

  // --- Archive & Restore Logic ---
  const handleArchiveProject = (projectId: string) => {
      if(window.confirm("Are you sure you want to mark this project as COMPLETED and ARCHIVE it?")) {
          if(window.confirm("Double confirmation: This project will be hidden from Dashboard KPIs and Management Reports. Continue?")) {
              updateTeamData(team => {
                  const project = team.projects.find(p => p.id === projectId);
                  if (project) {
                      project.isArchived = true;
                      project.status = ProjectStatus.DONE; // Auto-set status to Done
                      project.completedAt = new Date().toISOString().split('T')[0]; // Set completion date
                      project.auditLog = addAuditEntry(project, 'Archived', 'Project marked as completed and archived');
                  }
              });
              setExpandedProjectIds(prev => prev.filter(id => id !== projectId));
              setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
          }
      }
  };

  const handleRestoreProject = (projectId: string) => {
      if(window.confirm("Restore this project to LIVE view? It will affect KPIs again.")) {
          updateTeamData(team => {
              const project = team.projects.find(p => p.id === projectId);
              if (project) {
                  project.isArchived = false;
                  project.completedAt = undefined;
                  // Reset status from Done to Active since Done is not available for live projects
                  if (project.status === ProjectStatus.DONE) {
                      project.status = ProjectStatus.ACTIVE;
                  }
                  project.auditLog = addAuditEntry(project, 'Restored', 'Project restored from archive (status reset to Active)');
              }
          });
          setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
      }
  }

  const handleToggleFavorite = (projectId: string) => {
      updateTeamData(team => {
          const project = team.projects.find(p => p.id === projectId);
          if (project) {
              project.isFavorite = !project.isFavorite;
          }
      });
  };

  const handleDeleteProject = (projectId: string) => {
      if (!currentTeam) return;
      const project = currentTeam.projects.find(p => p.id === projectId);
      const projectName = project?.name || 'this project';
      if (!window.confirm(`Are you sure you want to permanently delete "${projectName}"? This action cannot be undone.`)) return;
      if (!window.confirm(`FINAL CONFIRMATION: All tasks and data for "${projectName}" will be permanently lost. Continue?`)) return;

      if (onDeleteProject) {
          onDeleteProject(currentTeam.id, projectId);
      } else {
          updateTeamData(team => {
              team.projects = team.projects.filter(p => p.id !== projectId);
          });
      }
      setExpandedProjectIds(prev => prev.filter(id => id !== projectId));
      setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
  };

  // Transfer project handler
  const handleTransferProjectConfirm = () => {
      if (!transferProject || !transferTargetTeamId || !currentTeam || !onTransferProject) return;
      const targetTeam = (allTeams || teams).find(t => t.id === transferTargetTeamId);
      if (!targetTeam) return;
      if (!window.confirm(`Transfer "${transferProject.projectName}" to team "${targetTeam.name}"?`)) return;

      onTransferProject(currentTeam.id, transferProject.projectId, transferTargetTeamId);
      setTransferProject(null);
      setTransferTargetTeamId('');
      setExpandedProjectIds(prev => prev.filter(id => id !== transferProject.projectId));
      setSelectedProjectIds(prev => prev.filter(id => id !== transferProject.projectId));
  };

  const handleAddTask = (projectId: string) => {
      const newTask: Task = {
          id: Date.now().toString(),
          title: '',
          description: '',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assigneeId: '',
          eta: '',
          weight: 1,
          cost: 0,
          isImportant: false,
          checklist: [],
          actions: [],
          externalDependencies: [],
          order: 1
      };
      setEditingTask({ projectId, task: newTask });
  };

  const handleDeleteTask = (projectId: string, taskId: string) => {
      if(!window.confirm("Delete this task?")) return;
      updateTeamData(team => {
          const project = team.projects.find(p => p.id === projectId);
          if(project) {
              project.tasks = project.tasks.filter(t => t.id !== taskId);
              project.auditLog = addAuditEntry(project, 'Delete Task', `Deleted task ID: ${taskId}`);
          }
      });
  };

  const handleTaskUpdate = (projectId: string, taskId: string, field: keyof Task, value: any) => {
    updateTeamData(team => {
        const project = team.projects.find(p => p.id === projectId);
        if(project) {
            const task = project.tasks.find(t => t.id === taskId);
            if(task) {
                (task as any)[field] = value;
                project.auditLog = addAuditEntry(project, 'Update Task', `Updated task "${task.title}" field ${String(field)}`);
            }
        }
    });
  };

  const handleProjectUpdate = (projectId: string, field: keyof Project, value: any) => {
    updateTeamData(team => {
        const project = team.projects.find(p => p.id === projectId);
        if(project) {
            (project as any)[field] = value;
            project.auditLog = addAuditEntry(project, 'Update Project', `Updated project field ${String(field)}`);
        }
    });
  };

  const handleSaveProject = () => {
      if (!editingProject) return;
      updateTeamData(team => {
          const idx = team.projects.findIndex(p => p.id === editingProject.id);
          if (idx !== -1) {
              const oldProject = team.projects[idx];
              team.projects[idx] = {
                  ...editingProject,
                  auditLog: addAuditEntry(oldProject, 'Edit Project', 'Project details updated via modal')
              };
          } else {
              // New Project
              team.projects.push({
                  ...editingProject,
                  auditLog: addAuditEntry(editingProject, 'Create Project', 'Project created')
              });
          }
      });
      setEditingProject(null);
  };

  const handleSaveTask = () => {
      if (!editingTask) return;
      updateTeamData(team => {
        const project = team.projects.find(p => p.id === editingTask.projectId);
        if(project) {
            const idx = project.tasks.findIndex(t => t.id === editingTask.task.id);
            if(idx !== -1) {
                project.tasks[idx] = editingTask.task;
                project.auditLog = addAuditEntry(project, 'Edit Task', `Task "${editingTask.task.title}" updated via modal`);
            } else {
                project.tasks.push(editingTask.task);
                project.auditLog = addAuditEntry(project, 'Create Task', `Task "${editingTask.task.title}" created`);
            }
        }
      });
      setEditingTask(null);
  };

  // --- Action Items Handlers (TaskActions) ---
  const handleAddAction = () => {
      if (!editingTask || !newActionText.trim()) return;
      const newAction: TaskAction = {
          id: Date.now().toString(),
          text: newActionText,
          status: 'To Do'
      };
      setEditingTask({
          ...editingTask,
          task: { ...editingTask.task, actions: [...(editingTask.task.actions || []), newAction] }
      });
      setNewActionText('');
  };

  const handleUpdateActionStatus = (actionId: string, newStatus: TaskActionStatus) => {
      if (!editingTask) return;
      const updatedActions = (editingTask.task.actions || []).map(a => 
          a.id === actionId ? { ...a, status: newStatus } : a
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, actions: updatedActions } });
  };

  const handleDeleteAction = (actionId: string) => {
      if (!editingTask) return;
      const updatedActions = (editingTask.task.actions || []).filter(a => a.id !== actionId);
      setEditingTask({ ...editingTask, task: { ...editingTask.task, actions: updatedActions } });
  };

  const handleUpdateActionText = (actionId: string, newText: string) => {
      if (!editingTask) return;
      const updatedActions = (editingTask.task.actions || []).map(a => 
          a.id === actionId ? { ...a, text: newText } : a
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, actions: updatedActions } });
  };

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
      if (!editingTask) return;
      const actions = [...(editingTask.task.actions || [])];
      if (direction === 'up') {
          if (index === 0) return;
          [actions[index], actions[index - 1]] = [actions[index - 1], actions[index]];
      } else {
          if (index === actions.length - 1) return;
          [actions[index], actions[index + 1]] = [actions[index + 1], actions[index]];
      }
      setEditingTask({ ...editingTask, task: { ...editingTask.task, actions } });
  };

  // Checklist Handlers
  const handleAddChecklistItem = () => {
      if (!editingTask || !newChecklistItem.trim()) return;
      const newItem: ChecklistItem = {
          id: Date.now().toString(),
          text: newChecklistItem,
          done: false,
          comment: ''
      };
      setEditingTask({
          ...editingTask,
          task: { ...editingTask.task, checklist: [...(editingTask.task.checklist || []), newItem] }
      });
      setNewChecklistItem('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
      if (!editingTask) return;
      const updatedList = (editingTask.task.checklist || []).map(item => 
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, checklist: updatedList } });
  };

  const handleDeleteChecklistItem = (itemId: string) => {
      if (!editingTask) return;
      const updatedList = (editingTask.task.checklist || []).filter(item => item.id !== itemId);
      setEditingTask({ ...editingTask, task: { ...editingTask.task, checklist: updatedList } });
  };

  const handleUpdateChecklistComment = (itemId: string, comment: string) => {
      if (!editingTask) return;
      const updatedList = (editingTask.task.checklist || []).map(item => 
        item.id === itemId ? { ...item, comment } : item
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, checklist: updatedList } });
  };

  const addProjectUrl = () => {
      if (!editingProject || !newProjectUrl.trim()) return;
      if ((editingProject.docUrls || []).length >= 3) return;
      setEditingProject({
          ...editingProject,
          docUrls: [...(editingProject.docUrls || []), newProjectUrl.trim()]
      });
      setNewProjectUrl('');
  };

  const removeProjectUrl = (index: number) => {
      if (!editingProject) return;
      setEditingProject({
          ...editingProject,
          docUrls: (editingProject.docUrls || []).filter((_, i) => i !== index)
      });
  };

  const addTaskUrl = () => {
      if (!editingTask || !newTaskUrl.trim()) return;
      if ((editingTask.task.docUrls || []).length >= 3) return;
      setEditingTask({
          ...editingTask,
          task: { ...editingTask.task, docUrls: [...(editingTask.task.docUrls || []), newTaskUrl.trim()] }
      });
      setNewTaskUrl('');
  };

  const removeTaskUrl = (index: number) => {
      if (!editingTask) return;
      setEditingTask({
          ...editingTask,
          task: { ...editingTask.task, docUrls: (editingTask.task.docUrls || []).filter((_, i) => i !== index) }
      });
  };

  // --- External Dependency Handlers ---
  const addExternalDependency = (type: 'project' | 'task') => {
      if (!newDepLabel.trim()) return;
      const newDep: ExternalDependency = {
          id: Date.now().toString(),
          label: newDepLabel,
          status: newDepStatus
      };

      if (type === 'project' && editingProject) {
          setEditingProject({
              ...editingProject,
              externalDependencies: [...(editingProject.externalDependencies || []), newDep]
          });
      } else if (type === 'task' && editingTask) {
          setEditingTask({
              ...editingTask,
              task: {
                  ...editingTask.task,
                  externalDependencies: [...(editingTask.task.externalDependencies || []), newDep]
              }
          });
      }
      setNewDepLabel('');
      setNewDepStatus('Green');
  };

  const removeExternalDependency = (id: string, type: 'project' | 'task') => {
      if (type === 'project' && editingProject) {
          setEditingProject({
              ...editingProject,
              externalDependencies: (editingProject.externalDependencies || []).filter(d => d.id !== id)
          });
      } else if (type === 'task' && editingTask) {
          setEditingTask({
              ...editingTask,
              task: {
                  ...editingTask.task,
                  externalDependencies: (editingTask.task.externalDependencies || []).filter(d => d.id !== id)
              }
          });
      }
  };

  const updateExternalDependencyStatus = (id: string, status: 'Red'|'Amber'|'Green', type: 'project'|'task') => {
      if (type === 'project' && editingProject) {
          const updated = (editingProject.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d);
          setEditingProject({ ...editingProject, externalDependencies: updated });
      } else if (type === 'task' && editingTask) {
          const updated = (editingTask.task.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d);
          setEditingTask({ ...editingTask, task: { ...editingTask.task, externalDependencies: updated } });
      }
  };

  // Context Descriptions Handler
  const updateAdditionalDescription = (index: number, value: string) => {
      if (!editingProject) return;
      const newDescriptions = [...(editingProject.additionalDescriptions || ['', '', ''])];
      newDescriptions[index] = value;
      // Fixed: Access editingProject.additionalDescriptions directly as editingProject is the Project object
      setEditingProject({ ...editingProject, additionalDescriptions: newDescriptions });
  };

  const calculateWeightedProgress = (tasks: Task[]) => {
      if (tasks.length === 0) return 0;
      const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
      const doneWeight = tasks.filter(t => t.status === TaskStatus.DONE).reduce((sum, t) => sum + (t.weight || 1), 0);
      return totalWeight > 0 ? (doneWeight / totalWeight) * 100 : 0;
  };

  const getProjectHealth = (project: Project) => {
      if (project.status === ProjectStatus.DONE) {
          return { label: 'Completed', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' };
      }
      
      const blocked = project.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
      const today = new Date();
      const deadline = new Date(project.deadline);
      const isOverdue = today > deadline;
      
      if (isOverdue || blocked > 2) return { label: 'Off Track', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' };
      if (blocked > 0 || (deadline.getTime() - today.getTime()) < 604800000) return { label: 'At Risk', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' };
      return { label: 'On Track', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' };
  };

  if (!currentTeam) return <div className="p-8 text-center text-slate-500">Please select a team.</div>;

  // Helper for Task Modal: Determine if assignee is a known user or custom string
  const isKnownUser = (id?: string) => users.some(u => u.id === id);
  const isCustomAssignee = editingTask?.task.assigneeId && !isKnownUser(editingTask.task.assigneeId);

  // --- FILTERING FOR VIEW ---
  const displayedProjects = currentTeam.projects
      .filter(p => !!p.isArchived === showArchived)
      .sort((a, b) => {
          // Favorites first
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return 0;
      });

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">

      {/* Language Picker Modal */}
      <LanguagePickerModal
          isOpen={showLanguagePicker}
          onClose={() => { setShowLanguagePicker(false); setPendingLlmAction(null); }}
          onSelect={handleLanguageSelected}
      />


      {/* Datalist for User suggestions (used in Project Owner/Architect inputs) */}
      <datalist id="user-list-suggestions">
          {users.map(u => (
              <option key={u.id} value={`${u.firstName} ${u.lastName}`} />
          ))}
      </datalist>

      {/* ... (AI Roadmap Modal - No changes) ... */}
      {showRoadmapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                          <Map className="w-5 h-5 text-white" />
                          Project Booklet / Roadmap
                      </h3>
                      <button onClick={() => setShowRoadmapModal(false)} className="text-white hover:text-indigo-200">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                      {loadingRoadmap ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                              <Sparkles className="w-10 h-10 animate-pulse mb-4 text-indigo-500" />
                              <p className="font-medium">Generating roadmap & project booklet...</p>
                              <p className="text-xs mt-2 text-slate-400">Analyzing tasks, deadlines and context layers</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <FormattedText text={aiRoadmap || "No content generated."} />
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                      <button 
                        onClick={() => setShowRoadmapModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                          Close
                      </button>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => exportToDoc(aiRoadmap, "Project_Booklet.doc")}
                            disabled={loadingRoadmap}
                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Download className="w-4 h-4" />
                              Export (.doc)
                          </button>
                          <button 
                            onClick={() => copyToClipboard(aiRoadmap)}
                            disabled={loadingRoadmap}
                            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Copy className="w-4 h-4" />
                              Copy
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AI Audit Modal */}
      {showAuditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                      <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                          <Clock className="w-5 h-5 text-slate-500" />
                          Audit Trail
                      </h3>
                      <button onClick={() => setShowAuditModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                      {(() => {
                          const project = currentTeam?.projects.find(p => p.id === showAuditModal);
                          const logs = project?.auditLog || [];
                          if (logs.length === 0) return <p className="text-center text-slate-400 italic py-4">No history recorded.</p>;
                          
                          return logs.map((log, idx) => (
                              <div key={idx} className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-bold text-slate-700 dark:text-slate-300">{log.action}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.date).toLocaleString()}</span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{log.details}</p>
                                  <div className="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
                                      <UserCircle2 className="w-3 h-3" /> {log.userName}
                                  </div>
                              </div>
                          ));
                      })()}
                  </div>
              </div>
          </div>
      )}

      {/* ... (Project Edit Modal - Same as before) ... */}
      {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                      <h3 className="text-lg font-bold dark:text-white">{editingProject.id && editingProject.name ? 'Edit Project' : 'Create New Project'}</h3>
                      <button onClick={() => setEditingProject(null)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                          <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                      </div>
                      
                      {/* Project Docs Links */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> Project Documents (Max 3)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingProject.docUrls || []).map((url, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <span className="flex-1 text-xs text-indigo-600 dark:text-indigo-400 truncate">{url}</span>
                                      <button onClick={() => removeProjectUrl(i)} className="text-slate-400 hover:text-red-500">
                                          <X className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          {(editingProject.docUrls || []).length < 3 && (
                              <div className="flex gap-2">
                                  <input 
                                      type="url" 
                                      value={newProjectUrl}
                                      onChange={e => setNewProjectUrl(e.target.value)}
                                      placeholder="https://..."
                                      className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs"
                                  />
                                  <button onClick={addProjectUrl} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold">Add</button>
                              </div>
                          )}
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                          <textarea value={editingProject.description} onChange={e => setEditingProject({...editingProject, description: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" rows={3} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={editingProject.status} onChange={e => setEditingProject({...editingProject, status: e.target.value as ProjectStatus})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deadline</label>
                            <input type="date" value={editingProject.deadline} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost (MD)</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={editingProject.cost || 0} 
                                onChange={e => setEditingProject({...editingProject, cost: parseFloat(e.target.value) || 0})} 
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                            />
                          </div>
                      </div>

                      {/* Owner & Architect Fields */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                  <Crown className="w-3 h-3 text-amber-500" /> Project Owner
                              </label>
                              <input 
                                  list="user-list-suggestions" 
                                  type="text"
                                  value={editingProject.owner || ''} 
                                  onChange={e => setEditingProject({...editingProject, owner: e.target.value})}
                                  className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder-slate-400"
                                  placeholder="Select or type name..."
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                  <PenTool className="w-3 h-3 text-indigo-500" /> Architect
                              </label>
                              <input 
                                  list="user-list-suggestions" 
                                  type="text"
                                  value={editingProject.architect || ''} 
                                  onChange={e => setEditingProject({...editingProject, architect: e.target.value})}
                                  className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white placeholder-slate-400"
                                  placeholder="Select or type name..."
                              />
                          </div>
                      </div>

                      {/* Project Dependencies */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingProject.externalDependencies || []).map(dep => (
                                  <div key={dep.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <select 
                                        value={dep.status} 
                                        onChange={(e) => updateExternalDependencyStatus(dep.id, e.target.value as any, 'project')}
                                        className={`w-4 h-4 rounded-full appearance-none cursor-pointer ${getRagColor(dep.status)} border-none focus:ring-0`}
                                      >
                                          <option value="Green">Green</option>
                                          <option value="Amber">Amber</option>
                                          <option value="Red">Red</option>
                                      </select>
                                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{dep.label}</span>
                                      <button onClick={() => removeExternalDependency(dep.id, 'project')} className="text-slate-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newDepLabel}
                                onChange={e => setNewDepLabel(e.target.value)}
                                placeholder="Dependency Name (e.g. API Team)"
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              />
                              <select 
                                value={newDepStatus}
                                onChange={e => setNewDepStatus(e.target.value as any)}
                                className="p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              >
                                  <option value="Green">Green</option>
                                  <option value="Amber">Amber</option>
                                  <option value="Red">Red</option>
                              </select>
                              <button onClick={() => addExternalDependency('project')} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                          </div>
                      </div>

                      {/* AI Context Fields (REVISED) */}
                      <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                              <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                              <div>
                                  <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">LLM Context Injection</h4>
                                  <p className="text-xs text-indigo-600 dark:text-indigo-400 opacity-80">
                                      Data entered here is invisible to the team but used by the AI to generate accurate reports.
                                  </p>
                              </div>
                          </div>

                          <div className="space-y-4">
                              {[
                                  { label: "1. Strategic Context", placeholder: "e.g. This project is critical for the Q4 IPO..." },
                                  { label: "2. Technical Constraints", placeholder: "e.g. Must use Legacy API, heavily relying on AWS..." },
                                  { label: "3. Team & Risks", placeholder: "e.g. Team is junior, external dependency on Vendor X is risky..." }
                              ].map((layer, i) => (
                                  <div key={i}>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">{layer.label}</label>
                                      <textarea
                                          value={(editingProject.additionalDescriptions && editingProject.additionalDescriptions[i]) || ''}
                                          onChange={e => updateAdditionalDescription(i, e.target.value)}
                                          maxLength={2000}
                                          rows={2}
                                          className="w-full p-3 text-sm border border-indigo-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-slate-800 dark:text-slate-200"
                                          placeholder={layer.placeholder}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Visibility Sharing (Admin Only) */}
                      {currentUser?.role === UserRole.ADMIN && (
                          <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800 space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                  <Share2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                  <div>
                                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Project Visibility</h4>
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400 opacity-80">
                                          Grant access to users who are not members of this team. They will see this project and its tasks.
                                      </p>
                                  </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                  {(editingProject.sharedWith || []).map(userId => {
                                      const sharedUser = (allUsers || users).find(u => u.id === userId);
                                      if (!sharedUser) return null;
                                      return (
                                          <span key={userId} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300">
                                              <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-[8px] font-bold">
                                                  {sharedUser.firstName[0]}
                                              </div>
                                              {sharedUser.firstName} {sharedUser.lastName}
                                              <button
                                                  onClick={() => setEditingProject({
                                                      ...editingProject,
                                                      sharedWith: (editingProject.sharedWith || []).filter(id => id !== userId)
                                                  })}
                                                  className="text-slate-400 hover:text-red-500 ml-1"
                                              >
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </span>
                                      );
                                  })}
                              </div>
                              <select
                                  value=""
                                  onChange={e => {
                                      if (!e.target.value) return;
                                      const current = editingProject.sharedWith || [];
                                      if (!current.includes(e.target.value)) {
                                          setEditingProject({
                                              ...editingProject,
                                              sharedWith: [...current, e.target.value]
                                          });
                                      }
                                  }}
                                  className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              >
                                  <option value="">Add a person...</option>
                                  {(allUsers || users)
                                      .filter(u => !(editingProject.sharedWith || []).includes(u.id))
                                      .map(u => (
                                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                                      ))
                                  }
                              </select>
                          </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                          <input type="checkbox" id="projImp" checked={editingProject.isImportant} onChange={e => setEditingProject({...editingProject, isImportant: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                          <label htmlFor="projImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                      </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                      <button onClick={handleSaveProject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Save Changes</button>
                  </div>
              </div>
          </div>
      )}

      {/* Task Edit Modal */}
      {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="text-lg font-bold dark:text-white">Edit Task</h3>
                      <button onClick={() => setEditingTask(null)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                              <input type="text" value={editingTask.task.title} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, title: e.target.value}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                          <div className="w-20">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order</label>
                              <input type="number" value={editingTask.task.order || 0} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, order: parseInt(e.target.value)}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                      </div>

                      <div className="">
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
                            <span className="text-[10px] text-slate-400 font-mono">{(editingTask.task.description || '').length}/3000</span>
                          </div>
                          <textarea 
                              value={editingTask.task.description || ''} 
                              onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, description: e.target.value}})} 
                              maxLength={3000}
                              rows={4}
                              placeholder="Add detailed task description..."
                              className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm resize-y" 
                          />
                      </div>
                      
                      {/* Task Docs Links */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> Task Documents (Max 3)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingTask.task.docUrls || []).map((url, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <span className="flex-1 text-xs text-indigo-600 dark:text-indigo-400 truncate">{url}</span>
                                      <button onClick={() => removeTaskUrl(i)} className="text-slate-400 hover:text-red-500">
                                          <X className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          {(editingTask.task.docUrls || []).length < 3 && (
                              <div className="flex gap-2">
                                  <input 
                                      type="url" 
                                      value={newTaskUrl}
                                      onChange={e => setNewTaskUrl(e.target.value)}
                                      placeholder="https://..."
                                      className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs"
                                  />
                                  <button onClick={addTaskUrl} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold">Add</button>
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={editingTask.task.status} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, status: e.target.value as TaskStatus}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                            <select value={editingTask.task.priority} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, priority: e.target.value as TaskPriority}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(TaskPriority).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Weight (Impact)</label>
                            <input type="number" min="1" max="10" value={editingTask.task.weight || 1} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, weight: parseInt(e.target.value) || 1}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ETA (Deadline)</label>
                            <input 
                                type="date"
                                value={editingTask.task.eta || ''}
                                onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, eta: e.target.value}})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                          </div>
                      </div>
                      
                      <div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                                <div className="space-y-2">
                                    <select 
                                        value={isCustomAssignee ? 'CUSTOM_ASSIGNEE' : (editingTask.task.assigneeId || '')} 
                                        onChange={e => {
                                            if (e.target.value === 'CUSTOM_ASSIGNEE') {
                                                setEditingTask({...editingTask, task: {...editingTask.task, assigneeId: 'External Contact'}});
                                            } else {
                                                setEditingTask({...editingTask, task: {...editingTask.task, assigneeId: e.target.value}});
                                            }
                                        }} 
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                        <option value="CUSTOM_ASSIGNEE">-- Other / External --</option>
                                    </select>
                                    {isCustomAssignee && (
                                        <input 
                                            type="text"
                                            value={editingTask.task.assigneeId}
                                            onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, assigneeId: e.target.value}})}
                                            placeholder="Enter external name..."
                                            className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm bg-indigo-50 dark:bg-indigo-900/20"
                                            autoFocus
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="w-24">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost (MD)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={editingTask.task.cost || 0} 
                                    onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, cost: parseFloat(e.target.value) || 0}})} 
                                    className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                />
                            </div>
                        </div>
                      </div>

                      {/* Task Dependencies (External) */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingTask.task.externalDependencies || []).map(dep => (
                                  <div key={dep.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <select 
                                        value={dep.status} 
                                        onChange={(e) => updateExternalDependencyStatus(dep.id, e.target.value as any, 'task')}
                                        className={`w-4 h-4 rounded-full appearance-none cursor-pointer ${getRagColor(dep.status)} border-none focus:ring-0`}
                                      >
                                          <option value="Green">Green</option>
                                          <option value="Amber">Amber</option>
                                          <option value="Red">Red</option>
                                      </select>
                                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{dep.label}</span>
                                      <button onClick={() => removeExternalDependency(dep.id, 'task')} className="text-slate-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newDepLabel}
                                onChange={e => setNewDepLabel(e.target.value)}
                                placeholder="Dependency Name (e.g. Legal Check)"
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              />
                              <select 
                                value={newDepStatus}
                                onChange={e => setNewDepStatus(e.target.value as any)}
                                className="p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              >
                                  <option value="Green">Green</option>
                                  <option value="Amber">Amber</option>
                                  <option value="Red">Red</option>
                              </select>
                              <button onClick={() => addExternalDependency('task')} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                          </div>
                      </div>

                      {/* --- TASK ACTIONS SECTION (NEW) --- */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <LayoutList className="w-4 h-4" /> Task Actions / Sub-steps
                          </label>
                          <div className="space-y-2 mb-3">
                              {(editingTask.task.actions || []).map((action, index) => (
                                  <div key={action.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700 group">
                                      <div className="flex flex-col gap-0.5">
                                          <button 
                                              onClick={() => handleMoveAction(index, 'up')}
                                              disabled={index === 0}
                                              className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                          >
                                              <ArrowUp className="w-3 h-3" />
                                          </button>
                                          <button 
                                              onClick={() => handleMoveAction(index, 'down')}
                                              disabled={index === (editingTask.task.actions?.length || 0) - 1}
                                              className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                          >
                                              <ArrowDown className="w-3 h-3" />
                                          </button>
                                      </div>
                                      <select 
                                          value={action.status} 
                                          onChange={(e) => handleUpdateActionStatus(action.id, e.target.value as any)}
                                          className={`text-[10px] uppercase font-bold px-2 py-1 rounded cursor-pointer border focus:outline-none ${getActionStatusColor(action.status)}`}
                                      >
                                          <option value="To Do">To Do</option>
                                          <option value="Ongoing">Ongoing</option>
                                          <option value="Blocked">Blocked</option>
                                          <option value="Done">Done</option>
                                      </select>
                                      <input 
                                          type="text"
                                          value={action.text}
                                          onChange={(e) => handleUpdateActionText(action.id, e.target.value)}
                                          className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none focus:ring-0 px-2 py-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                      />
                                      <button onClick={() => handleDeleteAction(action.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newActionText}
                                  onChange={e => setNewActionText(e.target.value)}
                                  placeholder="Add an action step..."
                                  className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                  onKeyDown={e => e.key === 'Enter' && handleAddAction()}
                              />
                              <button onClick={handleAddAction} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">Add</button>
                          </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                          <input type="checkbox" id="taskImp" checked={editingTask.task.isImportant} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, isImportant: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                          <label htmlFor="taskImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                      </div>

                      {/* Checklist Section */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <ListTodo className="w-4 h-4" /> Checklist
                          </label>
                          <div className="space-y-3 mb-2">
                              {(editingTask.task.checklist || []).map(item => (
                                  <div key={item.id} className="group">
                                      <div className="flex items-center gap-2">
                                          <input 
                                            type="checkbox" 
                                            checked={item.done} 
                                            onChange={() => handleToggleChecklistItem(item.id)}
                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" 
                                          />
                                          <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                              {item.text}
                                          </span>
                                          <button 
                                            onClick={() => setChecklistCommentId(checklistCommentId === item.id ? null : item.id)}
                                            className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${item.comment ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
                                            title="Add/Edit Comment"
                                          >
                                              <MessageCircle className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                      {(checklistCommentId === item.id || item.comment) && (
                                          <div className="ml-6 mt-1 flex items-center gap-2">
                                              <input 
                                                type="text"
                                                value={item.comment || ''}
                                                onChange={(e) => handleUpdateChecklistComment(item.id, e.target.value)}
                                                placeholder="Add a note..."
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                                              />
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newChecklistItem}
                                onChange={e => setNewChecklistItem(e.target.value)}
                                placeholder="New item..."
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                              />
                              <button onClick={handleAddChecklistItem} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">Add</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-between pt-4">
                      <button onClick={() => handleDeleteTask(editingTask.projectId, editingTask.task.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium flex items-center transition-colors">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </button>
                      <button onClick={handleSaveTask} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Save Task</button>
                  </div>
              </div>
          </div>
      )}

      {/* Transfer Project Modal */}
      {transferProject && (currentUser?.role === UserRole.ADMIN || currentTeam?.managerId === currentUser?.id) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                      <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                          <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                          Transfer Project
                      </h3>
                      <button onClick={() => { setTransferProject(null); setTransferTargetTeamId(''); }}>
                          <X className="w-5 h-5 text-slate-400" />
                      </button>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                          <p className="text-xs text-slate-500 uppercase font-bold mb-1">Project</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{transferProject.projectName}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                          <p className="text-xs text-slate-500 uppercase font-bold mb-1">From Team</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{currentTeam?.name}</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Destination Team</label>
                          <select
                              value={transferTargetTeamId}
                              onChange={e => setTransferTargetTeamId(e.target.value)}
                              className="w-full p-2.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                          >
                              <option value="">Select a team...</option>
                              {(allTeams || teams).filter(t => {
                                  if (t.id === selectedTeamId) return false;
                                  // Admins can transfer to any team; managers only to their own teams
                                  if (currentUser?.role === UserRole.ADMIN) return true;
                                  return t.managerId === currentUser?.id;
                              }).map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                          </select>
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                      <button
                          onClick={() => { setTransferProject(null); setTransferTargetTeamId(''); }}
                          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={handleTransferProjectConfirm}
                          disabled={!transferTargetTeamId}
                          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                          <ArrowRightLeft className="w-4 h-4" />
                          Transfer
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="relative">
             <select 
                value={selectedTeamId} 
                onChange={(e) => { setSelectedTeamId(e.target.value); setAiReport(null); }}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-2xl font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 block w-full py-2 pl-4 pr-10 shadow-sm transition-all cursor-pointer"
             >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <ChevronDown className="w-5 h-5" />
             </div>
           </div>
           
           <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
           
           <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                   {teamManager?.firstName[0]}{teamManager?.lastName[0]}
               </div>
               <div className="hidden md:block">
                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide">Lead</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{teamManager ? `${teamManager.firstName} ${teamManager.lastName}` : 'Unassigned'}</p>
               </div>
           </div>
        </div>

        <div className="flex gap-2">
            {!showArchived && (
                <button 
                    onClick={handleCreateProject}
                    className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all font-medium text-sm"
                >
                    <Briefcase className="w-4 h-4 mr-2" /> New Project
                </button>
            )}

            <button
                onClick={handleGenerateReport}
                disabled={loadingAi}
                className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
                {loadingAi ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"/> : <Bot className="w-4 h-4 mr-2" />}
                {loadingAi ? 'Analyzing...' : (selectedProjectIds.length > 0 ? `AI Report (${selectedProjectIds.length})` : `AI Report (All)`)}
            </button>

            <button
                onClick={handleGenerateProjectCard}
                disabled={loadingProjectCard}
                className="flex items-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
                {loadingProjectCard ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"/> : <BrainCircuit className="w-4 h-4 mr-2" />}
                {loadingProjectCard ? 'Generating...' : (selectedProjectIds.length > 0 ? `AI Project Card (${selectedProjectIds.length})` : `AI Project Card`)}
            </button>
        </div>
      </div>

      {/* AI Report */}
      {aiReport && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-500/30 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-4">
            <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 pointer-events-none">
                <Bot className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 flex items-center">
                    <Bot className="w-5 h-5 mr-2" />
                    Executive Summary {selectedProjectIds.length > 0 ? `(Selected Projects)` : ''}
                </h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => exportToDoc(aiReport, "Team_Report_AI.doc")}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                        title="Export to Doc"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => copyToClipboard(aiReport)}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                        title="Copy to Clipboard"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => setAiReport(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <ChevronDown className="w-5 h-5 rotate-180" />
                    </button>
                </div>
            </div>
            
            {/* UTILISATION DE FORMATTED TEXT ICI */}
            <FormattedText text={aiReport} />
        </div>
      )}

      {/* AI Project Card Modal */}
      {showProjectCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                          <BrainCircuit className="w-6 h-6" />
                          AI Project Card {selectedProjectIds.length > 0 ? `(${selectedProjectIds.length} Projects)` : '(All Projects)'}
                      </h3>
                      <button onClick={() => setShowProjectCardModal(false)} className="text-white hover:text-indigo-200">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                      {loadingProjectCard ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                              <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                              <p className="font-medium">Generating Project Card...</p>
                              <p className="text-xs text-slate-400 mt-1">Analyzing projects, tasks, and dependencies</p>
                          </div>
                      ) : aiProjectCard ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <FormattedText text={aiProjectCard} />
                          </div>
                      ) : null}
                  </div>
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                      <button
                          onClick={() => exportToDoc(aiProjectCard, "Project_Card_AI.doc")}
                          disabled={loadingProjectCard || !aiProjectCard}
                          className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                          <Download className="w-4 h-4" /> Export Doc
                      </button>
                      <button
                          onClick={() => copyToClipboard(aiProjectCard)}
                          disabled={loadingProjectCard || !aiProjectCard}
                          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                          <Copy className="w-4 h-4" /> Copy
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Selection Header */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 p-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
              <button 
                onClick={toggleSelectAll}
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2"
              >
                  {selectedProjectIds.length > 0 && selectedProjectIds.length === displayedProjects.length ? (
                      <CheckSquare className="w-4 h-4" />
                  ) : (
                      <Square className="w-4 h-4" />
                  )}
                  {selectedProjectIds.length > 0 ? 'Deselect All' : `Select All ${showArchived ? 'Archived' : 'Live'} Projects`}
              </button>
              {selectedProjectIds.length > 0 && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                      {selectedProjectIds.length} selected
                  </span>
              )}
          </div>
          
          <div className="flex items-center gap-4">
              <button 
                  onClick={collapseAllProjects}
                  className="flex items-center px-3 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold"
              >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Collapse All
              </button>
              <span className="text-[10px] text-slate-400 hidden md:inline">Select projects to scope AI Report generation.</span>
              {/* View Toggle (Live / Archive) */}
              <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                  <button 
                      onClick={() => setShowArchived(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!showArchived ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                      Live Projects
                  </button>
                  <button 
                      onClick={() => setShowArchived(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${showArchived ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                      <Archive className="w-3 h-3" />
                      Archived
                  </button>
              </div>
          </div>
      </div>

      {/* Projects Grid */}
      <div className="space-y-6">
        {displayedProjects.map(project => {
            const health = getProjectHealth(project);
            const isExpanded = expandedProjectIds.includes(project.id);
            const progress = calculateWeightedProgress(project.tasks);
            const projectManager = users.find(u => u.id === project.managerId);
            const sortedTasks = [...project.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
            const hasContext = project.additionalDescriptions && project.additionalDescriptions.some(d => d.trim().length > 0);
            const isContextVisible = showContextForProject === project.id;
            const isSelected = selectedProjectIds.includes(project.id);
            const isFavorite = project.isFavorite;

            return (
              <div key={project.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${isFavorite ? 'border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-500/30' : (isExpanded ? 'border-indigo-200 dark:border-indigo-500/30 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')}`}>
                
                {/* Project Card Header */}
                <div className={`p-6 ${isFavorite ? 'bg-amber-50/30 dark:bg-amber-900/10' : (isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : '')}`}>
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                        {/* Checkbox for Selection */}
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleProjectSelection(project.id)}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(project.id); }}
                                className={`p-1 rounded-full transition-colors ${isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400'}`}
                                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                                <Star className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
                            </button>
                        </div>

                        <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => toggleProjectExpansion(project.id)}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                {project.isImportant && (
                                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" fill="currentColor" fillOpacity={0.2} />
                                )}
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                                    {project.name}
                                    {project.createdByBot && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-200 dark:border-emerald-800" title="Created by PRJ Bot">
                                            <Bot className="w-3 h-3" />
                                            BOT
                                        </span>
                                    )}
                                </h3>
                                
                                {/* Quick Status Change Project (Disabled if Archived) */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={project.status}
                                        onChange={(e) => handleProjectUpdate(project.id, 'status', e.target.value)}
                                        disabled={project.isArchived}
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer appearance-none ${getStatusColor(project.status)} disabled:opacity-70 disabled:cursor-not-allowed`}
                                    >
                                        {Object.values(ProjectStatus)
                                            .filter(s => project.isArchived ? true : s !== ProjectStatus.DONE)
                                            .map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${health.color}`}>
                                    {health.label}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{project.description}</p>
                            
                            {/* Display Project Dependencies RAG & Roles */}
                            <div className="flex flex-wrap gap-2 mt-2 items-center">
                                {project.owner && (
                                    <span className="flex items-center text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800" title="Product Owner">
                                        <Crown className="w-3 h-3 mr-1" /> {project.owner}
                                    </span>
                                )}
                                {project.architect && (
                                    <span className="flex items-center text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800" title="Architect">
                                        <PenTool className="w-3 h-3 mr-1" /> {project.architect}
                                    </span>
                                )}

                                {project.externalDependencies && project.externalDependencies.length > 0 && (
                                    <>
                                        <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        {project.externalDependencies.map(dep => (
                                            <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                <span className={`w-2 h-2 rounded-full mr-1.5 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{dep.label}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                
                                {/* Doc Links Display */}
                                {(project.docUrls || []).length > 0 && (
                                    <>
                                        <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        {project.docUrls!.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                                                <Link2 className="w-3 h-3" /> Doc {i+1}
                                            </a>
                                        ))}
                                    </>
                                )}

                                {/* Shared With indicator */}
                                {(project.sharedWith || []).length > 0 && (
                                    <>
                                        <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <span className="flex items-center text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                                            <Share2 className="w-3 h-3 mr-1" /> Shared ({project.sharedWith!.length})
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Meta Stats & Actions */}
                        <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                             <div className="flex flex-col items-end min-w-[100px]">
                                <span className="text-xs uppercase font-semibold text-slate-400 mb-1">
                                    {project.status === ProjectStatus.DONE ? 'Completed' : 'Timeline'}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                    {project.status === ProjectStatus.DONE && project.completedAt ? (
                                        <input 
                                            type="date" 
                                            value={project.completedAt}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleProjectUpdate(project.id, 'completedAt', e.target.value)}
                                            className="bg-transparent border-none p-0 text-sm focus:ring-0 cursor-pointer text-slate-600 dark:text-slate-400"
                                        />
                                    ) : (
                                        project.deadline
                                    )}
                                </span>
                             </div>
                             
                             <div className="flex flex-col items-end w-32">
                                 <div className="flex justify-between w-full mb-1">
                                    <span className="text-xs font-semibold">Weighted Progress</span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                                 </div>
                                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                     <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                 </div>
                             </div>

                             <button 
                                onClick={(e) => { e.stopPropagation(); setShowAuditModal(project.id); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Audit History"
                             >
                                 <Clock className="w-4 h-4" />
                             </button>

                             <button 
                                onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                 <Pencil className="w-4 h-4" />
                             </button>

                             {/* Transfer Project Button (Admin or Team Manager) */}
                             {isExpanded && (currentUser?.role === UserRole.ADMIN || currentTeam?.managerId === currentUser?.id) && onTransferProject && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTransferProject({ projectId: project.id, projectName: project.name });
                                        setTransferTargetTeamId('');
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Transfer to Another Team"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                </button>
                             )}

                             {/* Project Delete Button */}
                             {isExpanded && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Delete Project Permanently"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                             )}

                             {/* Archive / Restore Button */}
                             {isExpanded && (
                                 <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (project.isArchived) {
                                            handleRestoreProject(project.id);
                                        } else {
                                            handleArchiveProject(project.id);
                                        }
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${project.isArchived 
                                        ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    title={project.isArchived ? "Restore to Live" : "Archive (Complete)"}
                                 >
                                     {project.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                 </button>
                             )}

                             <div 
                                onClick={() => toggleProjectExpansion(project.id)}
                                className="cursor-pointer"
                             >
                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                             </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 p-6">
                        
                        {/* Hidden Context Button & Section */}
                        {hasContext && (
                            <div className="mb-6">
                                <button 
                                    onClick={() => setShowContextForProject(isContextVisible ? null : project.id)}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:underline mb-2"
                                >
                                    {isContextVisible ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                    {isContextVisible ? 'Hide AI Context' : 'Show AI Context'}
                                </button>
                                
                                {isContextVisible && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                                        {project.additionalDescriptions?.map((desc, i) => (
                                            desc.trim() && (
                                                <div key={i} className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                    <span className="text-[10px] uppercase font-bold text-indigo-400 mb-1 block">Context Layer {i+1}</span>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{desc}</p>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tasks Header */}
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                                Tasks ({project.tasks.length})
                                <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 font-normal normal-case flex items-center">
                                    <ArrowUpAz className="w-3 h-3 mr-1" /> Sorted by Order
                                </span>
                            </h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleGenerateRoadmap(project)}
                                    className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-md transition-colors"
                                    disabled={loadingRoadmap}
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Booklet
                                </button>
                                
                                {!project.isArchived && (
                                    <button 
                                        onClick={() => handleAddTask(project.id)}
                                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md transition-colors"
                                    >
                                        <Plus className="w-4 h-4 mr-1" /> Add Task
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Task List Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-3 w-16 text-center">#</th>
                                        <th className="px-6 py-3">Task Name</th>
                                        <th className="px-6 py-3 w-32">Status (Click)</th>
                                        <th className="px-6 py-3 w-32">Priority</th>
                                        <th className="px-6 py-3 w-20">Cost (MD)</th>
                                        <th className="px-6 py-3 w-24">Weight</th>
                                        <th className="px-6 py-3 w-40">Assignee</th>
                                        <th className="px-6 py-3 w-20 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {sortedTasks.map(task => {
                                        const checklistDone = task.checklist ? task.checklist.filter(i => i.done).length : 0;
                                        const checklistTotal = task.checklist ? task.checklist.length : 0;
                                        const actionsDone = task.actions ? task.actions.filter(a => a.status === 'Done').length : 0;
                                        const actionsTotal = task.actions ? task.actions.length : 0;
                                        const blockedActions = task.actions ? task.actions.filter(a => a.status === 'Blocked').length : 0;
                                        
                                        const assigneeUser = users.find(u => u.id === task.assigneeId);
                                        const isExternalAssignee = task.assigneeId && !assigneeUser;

                                        // Red Alert Logic for ETA
                                        const isOverdue = task.eta && new Date(task.eta).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== TaskStatus.DONE;

                                        return (
                                        <tr key={task.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${task.isImportant ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-6 py-4 text-center font-mono text-slate-400 text-xs">
                                                {task.order}
                                            </td>
                                            <td className="px-6 py-4 relative">
                                                {task.isImportant && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                                <div className="flex items-center gap-2">
                                                    {task.isImportant && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                    <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{task.description}</div>
                                                
                                                {/* Actions Progress Bar if actions exist */}
                                                {actionsTotal > 0 && (
                                                    <div className="mt-2 flex items-center gap-2 w-full max-w-[200px]">
                                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                            {task.actions?.map((action, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`h-full flex-1 ${
                                                                        action.status === 'Done' ? 'bg-emerald-500' :
                                                                        action.status === 'Blocked' ? 'bg-red-500' :
                                                                        action.status === 'Ongoing' ? 'bg-blue-500' :
                                                                        'bg-transparent' // To Do remains bg color
                                                                    }`}
                                                                    style={{ borderRight: idx !== actionsTotal - 1 ? '1px solid white' : 'none' }}
                                                                ></div>
                                                            ))}
                                                        </div>
                                                        <span className={`text-[10px] font-bold ${blockedActions > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {actionsDone}/{actionsTotal}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Task Dependencies Display */}
                                                {task.externalDependencies && task.externalDependencies.length > 0 && (
                                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                                        {task.externalDependencies.map(dep => (
                                                            <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                                                <span className="text-slate-600 dark:text-slate-300">{dep.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {task.eta && (
                                                        <div className={`flex items-center text-xs ${isOverdue ? 'text-red-600 font-bold bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                                                            {isOverdue && <AlertCircle className="w-3 h-3 mr-1" />}
                                                            <Calendar className="w-3 h-3 mr-1" /> {task.eta}
                                                        </div>
                                                    )}
                                                    {checklistTotal > 0 && (
                                                        <div className="flex items-center text-xs text-slate-400" title={`${checklistDone}/${checklistTotal} items completed`}>
                                                            <ListTodo className="w-3 h-3 mr-1" /> {checklistDone}/{checklistTotal}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Quick Status Change */}
                                                <select 
                                                    value={task.status}
                                                    onChange={(e) => handleTaskUpdate(project.id, task.id, 'status', e.target.value)}
                                                    className={`text-xs font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full appearance-none ${getStatusColor(task.status).replace('border', 'ring')}`}
                                                >
                                                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                     <Flag className="w-3 h-3 mr-1" />
                                                     {task.priority}
                                                 </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-600 dark:text-slate-400 text-xs font-mono">
                                                    {task.cost ? <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" />{task.cost}</span> : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs font-mono font-bold">
                                                    <Scale className="w-3 h-3 mr-1.5" />
                                                    {task.weight || 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {assigneeUser ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                {assigneeUser.firstName[0]}
                                                            </div>
                                                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                                {assigneeUser.firstName}
                                                            </span>
                                                        </>
                                                    ) : isExternalAssignee ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                                <UserPlus className="w-3 h-3" />
                                                            </div>
                                                            <span className="text-indigo-600 dark:text-indigo-300 truncate max-w-[100px] text-xs font-medium">
                                                                {task.assigneeId}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 italic flex items-center"><UserCircle2 className="w-4 h-4 mr-1"/> Unassigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => setEditingTask({ projectId: project.id, task: task })}
                                                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteTask(project.id, task.id)}
                                                        className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                    {project.tasks.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No tasks created yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
              </div>
            );
        })}

        {displayedProjects.length === 0 && (
             <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                 <p className="text-lg font-medium">{showArchived ? "No archived projects" : "No active projects"}</p>
                 <p className="text-sm">
                     {showArchived ? "Archived projects will appear here." : "Get started by creating a new project for this team."}
                 </p>
                 {!showArchived && (
                     <button 
                        onClick={handleCreateProject}
                        className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                     >
                         Create Project
                     </button>
                 )}
             </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTracker;
