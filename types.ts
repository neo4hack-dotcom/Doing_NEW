
export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee'
}

export enum TaskStatus {
  TODO = 'To Do',
  ONGOING = 'In Progress',
  BLOCKED = 'Blocked',
  DONE = 'Done'
}

export type TaskActionStatus = 'To Do' | 'Ongoing' | 'Blocked' | 'Done';

export interface TaskAction {
  id: string;
  text: string;
  status: TaskActionStatus;
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}

export enum ProjectStatus {
  PLANNING = 'Planning',
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  DONE = 'Done'
}

export enum ProjectRole {
  OWNER = 'Owner',
  LEAD = 'Lead',
  CONTRIBUTOR = 'Contributor'
}

export enum ActionItemStatus {
  TO_START = 'To Start',
  ONGOING = 'Ongoing',
  BLOCKED = 'Blocked',
  DONE = 'Done'
}

export type LLMProvider = 'ollama' | 'local_http' | 'n8n';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl?: string; 
  apiKey?: string; 
  model: string; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { name: string, type: string, data?: string }[]; 
  timestamp: Date;
}

export interface User {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  functionTitle: string;
  role: UserRole;
  managerId?: string | null;
  avatarUrl?: string;
  password?: string; 
  location?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  comment?: string;
}

export interface ExternalDependency {
  id: string;
  label: string; 
  status: 'Red' | 'Amber' | 'Green';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string; 
  eta: string; 
  cost?: number; 
  dependencies?: string[]; 
  externalDependencies?: ExternalDependency[];
  actions?: TaskAction[]; 
  weight: number; 
  isImportant: boolean; 
  checklist?: ChecklistItem[]; 
  order?: number; 
  docUrls?: string[];
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

export interface AuditEntry {
    id: string;
    date: string;
    userName: string;
    action: string;
    details?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  managerId?: string; 
  owner?: string; 
  architect?: string; 
  deadline: string; 
  cost?: number; 
  members: ProjectMember[];
  tasks: Task[];
  isImportant: boolean; 
  isFavorite?: boolean;
  isArchived?: boolean; 
  completedAt?: string;
  docUrls?: string[]; 
  dependencies?: string[]; 
  externalDependencies?: ExternalDependency[]; 
  additionalDescriptions?: string[];
  auditLog?: AuditEntry[];
  sharedWith?: string[]; // User IDs who can see this project regardless of team membership
  createdByBot?: boolean;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  projects: Project[];
}

export interface Meeting {
  id: string;
  teamId: string;
  projectId?: string;
  date: string;
  title: string;
  attendees: string[];
  minutes: string;
  decisions?: { id: string, text: string }[];
  actionItems: ActionItem[];
  createdByBot?: boolean;
}

export interface ActionItem {
  id: string;
  description: string;
  ownerId: string;
  dueDate: string;
  status: ActionItemStatus;
  eta?: string;
  category?: string; 
  priority?: TaskPriority; 
}

export type HealthStatus = 'Green' | 'Amber' | 'Red'; 

export interface WeeklyReport {
  id: string;
  userId: string;
  weekOf: string;
  newThisWeek?: string; 
  mainSuccess: string;
  mainIssue: string;
  incident: string;
  orgaPoint: string;
  otherSection?: string; 
  teamHealth?: HealthStatus; 
  projectHealth?: HealthStatus; 
  updatedAt: string;
  managerCheck?: boolean;
  managerAnnotation?: string;
  isArchived?: boolean;
}

// --- WORKING GROUP TYPES ---

export interface WorkingGroupChecklistItem {
    id: string;
    text: string;
    isUrgent: boolean;
    comment: string;
    done: boolean;
}

export interface WorkingGroupSession {
  id: string;
  date: string;
  notes: string;
  decisions?: { id: string, text: string }[]; 
  actionItems: ActionItem[];
  checklist?: WorkingGroupChecklistItem[]; 
}

export interface WorkingGroup {
  id: string;
  title: string;
  projectId?: string; 
  memberIds: string[]; 
  sessions: WorkingGroupSession[];
  archived: boolean;
}

// --- SMART TODO TYPES ---

export type TodoStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TodoPriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type EnergyLevel = 'low' | 'medium' | 'high';

export interface TodoAttachment {
  name: string;
  url: string;
}

export interface SmartTodo {
  id: string;
  userId: string; // Private per-user — only visible to the owner
  createdAt: string;
  updatedAt: string;
  source: string; // "Email", "Meeting", "Manual", "Bot", etc.
  requester: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdByBot?: boolean; // Visual indicator icon — read-only
  title: string;
  description: string;
  tags: string[];
  attachments: TodoAttachment[];
  links: string[];
  status: TodoStatus;
  priorityLevel: TodoPriorityLevel;
  eisenhowerQuadrant: 1 | 2 | 3 | 4 | null; // Q1=Do Now, Q2=Schedule, Q3=Delegate, Q4=Eliminate
  energyRequired: EnergyLevel;
  estimatedDurationMin: number | null;
  actualTimeSpentMin: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

// --- NOTIFICATION TYPES ---
export type NotificationType =
  | 'project_created' | 'project_updated'
  | 'task_created' | 'task_updated'
  | 'report_created' | 'report_updated'
  | 'stale_project' | 'report_overdue';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  relatedId?: string;
  triggeredBy?: string;
  targetRole: 'admin' | 'user';
  targetUserId?: string;
  createdAt: string;
  seenBy: string[];
}

// --- SYSTEM CONFIG ---
export interface SystemMessage {
    active: boolean;
    content: string;
    level: 'info' | 'warning' | 'alert';
}

export interface AppState {
  users: User[];
  teams: Team[];
  meetings: Meeting[];
  weeklyReports: WeeklyReport[];
  workingGroups: WorkingGroup[];
  smartTodos: SmartTodo[];
  notifications: AppNotification[];
  dismissedAlerts: { [key: string]: string }; // key -> ISO date of dismissal, per-user stored locally
  systemMessage?: SystemMessage;
  currentUser: User | null;
  theme: 'light' | 'dark';
  llmConfig: LLMConfig;
  prompts?: Record<string, string>;
  lastUpdated?: number;
}
