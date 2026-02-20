
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, AppNotification, WorkingGroup, SmartTodo } from '../types';

const STORAGE_KEY = 'teamsync_data_v15';
const VERSION_KEY = 'teamsync_app_version';

// CHANGEZ CETTE VALEUR pour forcer une purge chez tous les utilisateurs
// Exemple : passez de '1.0.0' à '1.0.1' lors d'une mise à jour de structure.
const CURRENT_APP_VERSION = '1.0.2';

// L'URL relative permet de fonctionner quel que soit le nom de domaine ou l'IP du serveur
const API_URL = '/api/data';

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

/**
 * Sanitize data loaded from db.json or localStorage to ensure backward compatibility.
 * Old data may be missing fields added in recent versions (notifications, workingGroups, etc.)
 * and nested arrays (seenBy, memberIds, attendees, actionItems, etc.) may be undefined.
 */
export const sanitizeAppState = (data: any): AppState => {
    if (!data) return getDefaultState();

    // Top-level arrays and objects
    const state: AppState = {
        users: Array.isArray(data.users) ? data.users : [],
        teams: Array.isArray(data.teams) ? data.teams : [],
        meetings: Array.isArray(data.meetings) ? data.meetings : [],
        weeklyReports: Array.isArray(data.weeklyReports) ? data.weeklyReports : [],
        workingGroups: Array.isArray(data.workingGroups) ? data.workingGroups : [],
        smartTodos: Array.isArray(data.smartTodos) ? data.smartTodos : [],
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        dismissedAlerts: data.dismissedAlerts && typeof data.dismissedAlerts === 'object' ? data.dismissedAlerts : {},
        systemMessage: data.systemMessage || { active: false, content: '', level: 'info' },
        currentUser: data.currentUser || null,
        theme: data.theme || 'light',
        llmConfig: data.llmConfig || DEFAULT_LLM_CONFIG,
        prompts: data.prompts || {},
        lastUpdated: data.lastUpdated || 0,
    };

    // Sanitize nested notification objects (seenBy may be missing in old data)
    state.notifications = state.notifications.map((n: any): AppNotification => ({
        ...n,
        seenBy: Array.isArray(n.seenBy) ? n.seenBy : [],
        createdAt: n.createdAt || new Date().toISOString(),
        targetRole: n.targetRole || 'admin',
    }));

    // Sanitize meetings (attendees, actionItems may be missing)
    state.meetings = state.meetings.map((m: any): Meeting => ({
        ...m,
        attendees: Array.isArray(m.attendees) ? m.attendees : [],
        actionItems: Array.isArray(m.actionItems) ? m.actionItems : [],
        decisions: Array.isArray(m.decisions) ? m.decisions : [],
    }));

    // Sanitize working groups (memberIds, sessions may be missing)
    state.workingGroups = state.workingGroups.map((g: any): WorkingGroup => ({
        ...g,
        memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
        sessions: Array.isArray(g.sessions) ? g.sessions : [],
        archived: g.archived ?? false,
    }));

    // Sanitize teams and their projects
    state.teams = state.teams.map((team: any) => ({
        ...team,
        projects: Array.isArray(team.projects) ? team.projects.map((p: any) => ({
            ...p,
            members: Array.isArray(p.members) ? p.members : [],
            tasks: Array.isArray(p.tasks) ? p.tasks : [],
            sharedWith: Array.isArray(p.sharedWith) ? p.sharedWith : [],
            dependencies: Array.isArray(p.dependencies) ? p.dependencies : [],
            externalDependencies: Array.isArray(p.externalDependencies) ? p.externalDependencies : [],
            auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
            additionalDescriptions: Array.isArray(p.additionalDescriptions) ? p.additionalDescriptions : [],
            docUrls: Array.isArray(p.docUrls) ? p.docUrls : [],
        })) : [],
    }));

    return state;
};

const INITIAL_ADMIN: User = { 
    id: 'u1', 
    uid: 'Admin', 
    firstName: 'Mathieu', 
    lastName: 'Admin', 
    functionTitle: 'System Administrator', 
    role: UserRole.ADMIN, 
    managerId: null, 
    password: '59565956' 
};

// --- Générateur d'ID Robuste ---
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- Lecture Locale (Cache Rapide) avec Purge Automatique ---
export const loadState = (): AppState => {
  try {
    // 1. Check Version Integrity
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    if (storedVersion !== CURRENT_APP_VERSION) {
        console.warn(`Version mismatch detected (Old: ${storedVersion}, New: ${CURRENT_APP_VERSION}). Purging local cache.`);
        localStorage.clear(); // Safe purge of all data
        localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
        // We return default state, forcing a fresh start or server fetch
        return getDefaultState();
    }

    // 2. Load Data if version matches
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return sanitizeAppState(parsed);
    }
  } catch (error) {
    console.error("Local load failed", error);
    // In case of corrupt JSON, we also purge
    localStorage.clear();
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
  }
  
  return getDefaultState();
};

const getDefaultState = (): AppState => {
    return {
        users: [INITIAL_ADMIN],
        teams: [],
        meetings: [],
        weeklyReports: [],
        workingGroups: [],
        smartTodos: [],
        notifications: [],
        dismissedAlerts: {},
        systemMessage: { active: false, content: '', level: 'info' },
        currentUser: null,
        theme: 'light',
        llmConfig: DEFAULT_LLM_CONFIG,
        prompts: {},
        lastUpdated: Date.now()
      };
}

// --- Lecture Serveur (Fichier Central) ---
export const fetchFromServer = async (): Promise<AppState | null> => {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            // Basic validation
            if (data && (data.users || data.teams)) {
                return sanitizeAppState(data);
            }
        }
    } catch (e) {
        console.warn("Mode Hors-Ligne: Impossible de joindre le fichier central.");
    }
    return null;
};

// --- Écriture Centralisée ---
export const updateAppState = (updater: (currentState: AppState) => AppState): AppState => {
    const latestState = loadState();
    const newState = updater(latestState);
    saveState(newState);
    return newState;
};

export const saveState = (state: AppState) => {
  try {
    const timestamp = Date.now();
    const stateWithTimestamp = { ...state, lastUpdated: timestamp };

    // 1. Sauvegarde Locale (Instantané) - Inclut currentUser pour F5
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
    // Ensure version is set
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);

    // 2. Sauvegarde Serveur (Asynchrone / Fichier Central)
    // IMPORTANT: On retire currentUser et theme avant d'envoyer au serveur
    // pour ne pas écraser la session des autres utilisateurs.
    const { currentUser, theme, ...serverPayload } = stateWithTimestamp;

    // Use X-Base-Version header for concurrency control
    const baseVersion = String(state.lastUpdated || 0);

    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Base-Version': baseVersion
        },
        body: JSON.stringify(serverPayload)
    }).then(async (response) => {
        if (response.status === 409) {
            // Conflict detected: another user saved since our last fetch
            const conflictData = await response.json();
            console.warn("[Conflict] Server has newer data. Triggering merge...");

            // Dispatch a custom event so App.tsx can handle the conflict
            const conflictEvent = new CustomEvent('teamsync_conflict', {
                detail: { serverData: conflictData.serverData }
            });
            window.dispatchEvent(conflictEvent);
        }
    }).catch(err => console.error("Échec sauvegarde serveur:", err));

    // 3. Notification inter-onglets
    const event = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(stateWithTimestamp)
    });
    window.dispatchEvent(event);

  } catch (e: any) {
    console.error("Erreur de sauvegarde", e);
    if (e.name === 'QuotaExceededError') {
        alert("⚠️ Mémoire Locale Pleine. Veuillez nettoyer vos données ou exporter vos données.");
    }
  }
};

// --- Abonnement aux mises à jour ---
export const subscribeToStoreUpdates = (callback: () => void) => {
    const handler = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
};

export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    // On garde la version pour éviter un double reload inutile
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
    window.location.reload();
}
