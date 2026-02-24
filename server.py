
import os
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='dist')
CORS(app)  # Autoriser les requêtes Cross-Origin (nécessaire pour le développement)

PORT = 3001
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_CONFIG_FILE = os.path.join(BASE_DIR, 'server-config.json')
DEFAULT_DB_FILE = os.path.join(BASE_DIR, 'db.json')

# --- FONCTIONS UTILITAIRES ---

def get_db_path():
    """Récupère le chemin de la base de données depuis la config ou utilise le chemin par défaut."""
    try:
        if os.path.exists(SERVER_CONFIG_FILE):
            with open(SERVER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                if config.get('dbPath'):
                    return config['dbPath']
    except Exception as e:
        print(f"Error reading config: {e}")
    return DEFAULT_DB_FILE

# Variable globale pour le chemin de la base de données
DB_FILE = get_db_path()

def init_db_if_needed():
    """Initialise le fichier db.json avec la structure par défaut s'il n'existe pas."""
    directory = os.path.dirname(DB_FILE)
    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"[Init] Created directory: {directory}")
        except Exception as e:
            print(f"[Error] Could not create directory {directory}: {e}")

    if not os.path.exists(DB_FILE):
        # Données initiales avec l'utilisateur administrateur système
        initial_data = {
            "users": [{
                "id": "u1", "uid": "Admin", "firstName": "System", "lastName": "Admin",
                "functionTitle": "Administrator", "role": "Admin", "password": "admin"
            }],
            "teams": [],  # Équipes (contiennent les projets)
            "meetings": [],  # Réunions enregistrées
            "weeklyReports": [],  # Rapports hebdomadaires
            "workingGroups": [],  # Groupes de travail
            "notifications": [],  # Notifications système
            "dismissedAlerts": {},  # Alertes rejetées
            "systemMessage": { "active": False, "content": "", "level": "info" },  # Message système global
            "notes": [],
            "lastUpdated": int(time.time() * 1000)  # Timestamp de création
        }
        try:
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, indent=2)
            print(f"[Init] ✅ Base de données créée avec succès : {DB_FILE}")
        except Exception as e:
            print(f"[Error] Impossible de créer db.json : {e}")
    else:
        print(f"[Init] Base de données existante trouvée : {DB_FILE}")

# Initialisation au démarrage du serveur
init_db_if_needed()

# --- ROUTES API PRINCIPALES ---

@app.route('/api/data', methods=['GET'])
def get_data():
    """Endpoint de LECTURE: Récupère toutes les données de db.json."""
    try:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify(data)
        return jsonify({})
    except Exception as e:
        print(f"Erreur lecture fichier: {e}")
        return jsonify({"error": "Erreur lecture données"}), 500

@app.route('/api/data', methods=['POST'])
def save_data():
    """Endpoint d'ÉCRITURE: Sauvegarde les données dans db.json avec gestion des conflits de concurrence."""
    try:
        new_data = request.json
        client_base_version = request.headers.get('X-Base-Version')

        # Charge la version actuelle de la DB
        current_db_data = {}
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                current_db_data = json.load(f)

        # Vérification de Concurrence (Optimistic Locking)
        # Si le client envoie une version de base, on vérifie si la DB n'a pas été modifiée entre temps
        if client_base_version and client_base_version != 'force':
            server_version = str(current_db_data.get('lastUpdated', 0))
            if server_version != str(client_base_version):
                print(f"[Conflit] Version Client: {client_base_version} vs Serveur: {server_version}")
                # Retourne les données serveur pour permettre une fusion
                return jsonify({
                    "error": "Conflict detected",
                    "serverData": current_db_data
                }), 409

        # Mise à jour du timestamp de la dernière modification
        new_data['lastUpdated'] = int(time.time() * 1000)
        
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=2)
            
        print(f"[Sauvegarde] Données mises à jour à {time.strftime('%H:%M:%S')}")
        return jsonify({"success": True, "timestamp": new_data['lastUpdated']})
    except Exception as e:
        print(f"Erreur écriture fichier: {e}")
        return jsonify({"error": "Erreur sauvegarde données"}), 500

# --- ENDPOINTS DE CONFIGURATION ---
# Permettent de modifier le chemin de la base de données

@app.route('/api/config/db-path', methods=['GET'])
def get_db_config_path():
    """Retourne le chemin actuel de la base de données."""
    return jsonify({"path": DB_FILE})

@app.route('/api/config/db-path', methods=['POST'])
def update_db_config_path():
    """Modifie le chemin de la base de données et crée les répertoires nécessaires."""
    global DB_FILE
    new_path = request.json.get('path')
    if not new_path:
        return jsonify({"error": "Path required"}), 400

    try:
        # Sauvegarde la nouvelle configuration
        with open(SERVER_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump({"dbPath": new_path}, f, indent=2)

        DB_FILE = new_path

        # Vérifie que la DB existe au nouvel emplacement
        if not os.path.exists(DB_FILE):
            directory = os.path.dirname(DB_FILE)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)

            # Crée une DB vierge avec l'admin par défaut
            initial_data = {
                "users": [{ "id": "u1", "uid": "Admin", "firstName": "System", "lastName": "Admin", "functionTitle": "Administrator", "role": "Admin", "password": "admin" }],
                "teams": [], "meetings": [], "weeklyReports": [], "workingGroups": [], "notifications": [],
                "dismissedAlerts": {}, "systemMessage": { "active": False, "content": "", "level": "info" },
                "notes": [], "lastUpdated": int(time.time() * 1000)
            }
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, indent=2)
                
        print(f"[Config] Chemin DB mis à jour vers: {DB_FILE}")
        return jsonify({"success": True, "path": DB_FILE})
    except Exception as e:
        print(f"Erreur lors de la mise à jour de la config: {e}")
        return jsonify({"error": "Échec de la mise à jour du chemin DB"}), 500

# --- SERVICE DE L'APPLICATION FRONTEND (REACT) ---
# Sert l'interface React en production et gère le React Router

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Sert les fichiers statiques et retourne index.html pour React Router."""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # Retourne index.html pour que React Router gère le routage côté client
        if os.path.exists(os.path.join(app.static_folder, 'index.html')):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return "Serveur API en cours d'exécution. Frontend non construit (vérifiez le dossier 'dist'). Utilisez npm run dev pour le développement.", 200

if __name__ == '__main__':
    print(f"\n📡 SERVEUR API PYTHON (FLASK) LANCÉ !\n-------------------------------------\nPort API        : {PORT}\nFichier Données : {DB_FILE}\n-------------------------------------\n")
    app.run(port=PORT, debug=True, use_reloader=True)
