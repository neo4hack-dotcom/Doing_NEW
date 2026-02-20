
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, AppNotification, WorkingGroup, SmartTodo } from '../types';

// Clé de stockage local pour les données de l'application
const STORAGE_KEY = 'teamsync_data_v15';
const VERSION_KEY = 'teamsync_app_version';

// MODIFIEZ CETTE VALEUR pour forcer une purge chez tous les utilisateurs
// Exemple: passez de '1.0.0' à '1.0.1' lors d'une mise à jour majeure de la structure de données.
const CURRENT_APP_VERSION = '1.0.2';

// URL relative pour fonctionner indépendamment du domaine ou de l'IP du serveur
const API_URL = '/api/data';

// Configuration par défaut du modèle LLM (Ollama local)
const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

/**
 * Nettoie et valide les données chargées de db.json ou localStorage pour assurer la compatibilité rétroactive.
 * Les anciennes données peuvent manquer de champs ajoutés récemment (notifications, workingGroups, etc.)
 * et les tableaux imbriqués (seenBy, memberIds, attendees, actionItems, etc.) peuvent être indéfinis.
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

// Utilisateur administrateur initial du système
const INITIAL_ADMIN: User = {
    id: 'u1',
    uid: 'Admin',
    firstName: 'Mathieu',
    lastName: 'Admin',
    functionTitle: 'Administrateur Système',
    role: UserRole.ADMIN,
    managerId: null,
    password: '59565956'
};

// --- GÉNÉRATEUR D'ID ROBUSTE ---
// Utilise crypto.randomUUID s'il est disponible, sinon utilise une approche de repli
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- LECTURE LOCALE (CACHE RAPIDE) AVEC PURGE AUTOMATIQUE ---
// Charge l'état depuis localStorage et valide la version pour éviter l'incompatibilité
export const loadState = (): AppState => {
  try {
    // 1. Vérifie l'intégrité de la version
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion !== CURRENT_APP_VERSION) {
        console.warn(`Désaccord de version détecté (Ancien: ${storedVersion}, Nouveau: ${CURRENT_APP_VERSION}). Purge du cache local.`);
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

// Retourne l'état par défaut initial de l'application
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

// --- LECTURE SERVEUR (FICHIER CENTRAL) ---
// Récupère l'état depuis le serveur (db.json)
export const fetchFromServer = async (): Promise<AppState | null> => {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            // Validation basique des données
            if (data && (data.users || data.teams)) {
                return sanitizeAppState(data);
            }
        }
    } catch (e) {
        console.warn("Mode Hors-Ligne: Impossible de joindre le fichier central.");
    }
    return null;
};

// --- ÉCRITURE CENTRALISÉE ---
// Met à jour l'état global et déclenche les sauvegardes locale et serveur
export const updateAppState = (updater: (currentState: AppState) => AppState): AppState => {
    const latestState = loadState();
    const newState = updater(latestState);
    saveState(newState);
    return newState;
};

// Sauvegarde l'état dans localStorage et sur le serveur avec gestion des conflits
export const saveState = (state: AppState) => {
  try {
    const timestamp = Date.now();
    const stateWithTimestamp = { ...state, lastUpdated: timestamp };

    // 1. Sauvegarde Locale (instantanée) - Inclut currentUser pour persister après F5
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
    // Assure que la version est définie
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);

    // 2. Sauvegarde Serveur (asynchrone / fichier central db.json)
    // IMPORTANT: Supprime currentUser et theme avant d'envoyer au serveur
    // pour éviter d'écraser les sessions des autres utilisateurs
    const { currentUser, theme, ...serverPayload } = stateWithTimestamp;

    // Utilise l'en-tête X-Base-Version pour le contrôle de concurrence
    const baseVersion = String(state.lastUpdated || 0);

    // Envoie les données au serveur de manière asynchrone
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Base-Version': baseVersion
        },
        body: JSON.stringify(serverPayload)
    }).then(async (response) => {
        if (response.status === 409) {
            // Conflit détecté: un autre utilisateur a sauvegardé depuis notre dernier chargement
            const conflictData = await response.json();
            console.warn("[Conflit] Le serveur a des données plus récentes. Déclenchement de la fusion...");

            // Dispatch un événement personnalisé pour qu'App.tsx puisse gérer le conflit
            const conflictEvent = new CustomEvent('teamsync_conflict', {
                detail: { serverData: conflictData.serverData }
            });
            window.dispatchEvent(conflictEvent);
        }
    }).catch(err => console.error("Échec sauvegarde serveur:", err));

    // 3. Notification entre onglets (réplication de l'état)
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

// --- ABONNEMENT AUX MISES À JOUR ---
// Permet aux composants de s'abonner aux changements d'état (réplication multi-onglets)
export const subscribeToStoreUpdates = (callback: () => void) => {
    const handler = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
};

// Vide l'état et recharge l'application
export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    // Conserve la version pour éviter un rechargement double
    localStorage.setItem(VERSION_KEY, CURRENT_APP_VERSION);
    window.location.reload();
}
