
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport } from '../types';

const STORAGE_KEY = 'teamsync_data_v15';
const VERSION_KEY = 'teamsync_app_version';

// CHANGEZ CETTE VALEUR pour forcer une purge chez tous les utilisateurs
// Exemple : passez de '1.0.0' à '1.0.1' lors d'une mise à jour de structure.
const CURRENT_APP_VERSION = '1.0.1'; 

// L'URL relative permet de fonctionner quel que soit le nom de domaine ou l'IP du serveur
const API_URL = '/api/data'; 

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
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
      // Ensure defaults
      if (!parsed.llmConfig) parsed.llmConfig = DEFAULT_LLM_CONFIG;
      if (!parsed.weeklyReports) parsed.weeklyReports = [];
      if (!parsed.workingGroups) parsed.workingGroups = [];
      if (!parsed.notifications) parsed.notifications = [];
      if (!parsed.dismissedAlerts) parsed.dismissedAlerts = {};
      // Ensure systemMessage exists
      if (!parsed.systemMessage) parsed.systemMessage = { active: false, content: '', level: 'info' };
      return parsed;
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
                return data as AppState;
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

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverPayload)
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
