
// --- ÉNUMÉRATIONS D'UTILISATEUR ---
export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee'
}

// --- ÉTATS DES TÂCHES ---
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

// --- PRIORITÉS DES TÂCHES ---
export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}

// --- ÉTATS DES PROJETS ---
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

// --- CONFIGURATION DU MODÈLE LLM ---
export type LLMProvider = 'ollama' | 'local_http' | 'n8n';

// Interface de configuration pour les fournisseurs LLM locaux
export interface LLMConfig {
  provider: LLMProvider;
  baseUrl?: string; // URL du serveur (ex: http://localhost:11434)
  apiKey?: string; // Clé optionnelle pour authentification
  model: string; // Nom du modèle à utiliser
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { name: string, type: string, data?: string }[]; 
  timestamp: Date;
}

// --- STRUCTURE D'UTILISATEUR ---
export interface User {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  functionTitle: string; // Titre du poste
  role: UserRole;
  managerId?: string | null; // Référence au manager de cet utilisateur
  avatarUrl?: string;
  password?: string; // Champ de mot de passe simple (pour démo)
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

// --- STRUCTURE D'UNE TÂCHE ---
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string; // ID de l'utilisateur assigné
  eta: string; // Date estimée de fin
  cost?: number; // Coût estimé
  dependencies?: string[]; // IDs des tâches dépendantes
  externalDependencies?: ExternalDependency[]; // Dépendances externes (Red/Amber/Green)
  actions?: TaskAction[]; // Actions liées à la tâche
  weight: number; // Poids/complexité
  isImportant: boolean; // Flag pour les tâches critiques
  checklist?: ChecklistItem[]; // Sous-tâches ou éléments à vérifier
  order?: number; // Ordre d'affichage
  docUrls?: string[]; // Liens de documentation
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

// --- STRUCTURE D'UN PROJET ---
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  managerId?: string; // ID du gestionnaire du projet
  owner?: string; // Propriétaire du projet
  architect?: string; // Architecte technique
  deadline: string; // Date limite
  cost?: number; // Budget
  members: ProjectMember[]; // Membres assignés au projet
  tasks: Task[]; // Toutes les tâches du projet
  isImportant: boolean; // Flag de priorité
  isFavorite?: boolean;
  isArchived?: boolean; // Projet archivé?
  completedAt?: string; // Date d'achèvement
  docUrls?: string[]; // Liens de documentation
  dependencies?: string[]; // Dépendances avec d'autres projets
  externalDependencies?: ExternalDependency[]; // Dépendances externes
  additionalDescriptions?: string[]; // Contextes supplémentaires pour l'IA
  auditLog?: AuditEntry[]; // Historique des modifications
  sharedWith?: string[]; // IDs d'utilisateurs avec accès au-delà de l'équipe
  createdByBot?: boolean; // Créé par l'IA?
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

// --- TYPES DE GROUPE DE TRAVAIL ---

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

// --- TYPES DE TÂCHE INTELLIGENTE (SMART TODO) ---
// Système de gestion personnelle des tâches avec matrice Eisenhower

export type TodoStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TodoPriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type EnergyLevel = 'low' | 'medium' | 'high';

export interface TodoAttachment {
  name: string;
  url: string;
}

// Structure d'une tâche personnelle intelligente
export interface SmartTodo {
  id: string;
  userId: string; // Privé par utilisateur - visible uniquement au propriétaire
  createdAt: string;
  updatedAt: string;
  source: string; // "Email", "Meeting", "Manual", "Bot", etc.
  requester: string;
  sponsor?: string; // Sponsor ou commanditaire de la tâche
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdByBot?: boolean; // Visual indicator icon — read-only
  isArchived?: boolean; // Tâche archivée (exclue des KPIs)
  managerAssigned?: boolean; // Tâche assignée par un manager/admin
  assignedByUserId?: string; // ID de l'admin ayant assigné la tâche
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

// --- TYPES DE NOTIFICATION ---
// Événements système qui génèrent des notifications
export type NotificationType =
  | 'project_created' | 'project_updated'
  | 'task_created' | 'task_updated'
  | 'report_created' | 'report_updated'
  | 'stale_project' | 'report_overdue'
  | 'todo_assigned';

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

// --- ONE OFF QUERIES ---
export type OneOffQueryStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface OneOffQuery {
  id: string;
  teamId: string; // Team this query belongs to
  requester: string; // Free text name of requester
  requesterId?: string | null; // Optional: linked user ID
  sponsor: string; // Sponsor / commanditaire
  receivedAt: string; // ISO date — date de réception
  etaRequested: string | null; // ETA demandé par le requester (ISO date)
  description: string; // Detailed description
  dataSource: string; // Data source
  eisenhowerQuadrant: 1 | 2 | 3 | 4 | null;
  tags: string[];
  status: OneOffQueryStatus;
  assignedToUserId?: string | null; // Reference to a known user
  assignedToFreeText?: string; // Free text if not a known user
  cost?: number | null; // Estimated or actual cost
  selected?: boolean; // UI selection for batch AI email
  createdAt: string;
  updatedAt: string;
}

// --- CONFIGURATION SYSTÈME ---
// Message système affiché globalement dans l'application
export interface SystemMessage {
    active: boolean;
    content: string;
    level: 'info' | 'warning' | 'alert';
}

// --- ÉTAT GLOBAL DE L'APPLICATION ---
// Structure principale contenant toutes les données de l'app
export interface AppState {
  users: User[]; // Tous les utilisateurs
  teams: Team[]; // Toutes les équipes et leurs projets
  meetings: Meeting[]; // Réunions enregistrées
  weeklyReports: WeeklyReport[]; // Rapports hebdomadaires
  workingGroups: WorkingGroup[]; // Groupes de travail avec sessions
  smartTodos: SmartTodo[]; // Tâches personnelles intelligentes
  oneOffQueries: OneOffQuery[]; // Demandes ponctuelles (One off queries)
  notifications: AppNotification[]; // Notifications système
  dismissedAlerts: { [key: string]: string }; // Alertes rejetées (clé -> date ISO), stocké localement par utilisateur
  systemMessage?: SystemMessage; // Message système global
  currentUser: User | null; // Utilisateur actuellement connecté (local seulement)
  theme: 'light' | 'dark'; // Thème de l'interface (local seulement)
  llmConfig: LLMConfig; // Configuration du modèle LLM
  prompts?: Record<string, string>; // Prompts personnalisés
  lastUpdated?: number; // Timestamp de la dernière synchronisation
}
