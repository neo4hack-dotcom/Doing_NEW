
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
  systemMessage?: SystemMessage; // New: Global Announcement
  currentUser: User | null;
  theme: 'light' | 'dark';
  llmConfig: LLMConfig;
  prompts?: Record<string, string>;
  lastUpdated?: number; 
}
