
import os
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='dist')
CORS(app)  # Autoriser les requêtes Cross-Origin (utile pour le dev)

PORT = 3001
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_CONFIG_FILE = os.path.join(BASE_DIR, 'server-config.json')
DEFAULT_DB_FILE = os.path.join(BASE_DIR, 'db.json')

# --- Helpers ---

def get_db_path():
    """Récupère le chemin de la DB depuis la config ou utilise le défaut."""
    try:
        if os.path.exists(SERVER_CONFIG_FILE):
            with open(SERVER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                if config.get('dbPath'):
                    return config['dbPath']
    except Exception as e:
        print(f"Error reading config: {e}")
    return DEFAULT_DB_FILE

# Variable globale pour le chemin DB
DB_FILE = get_db_path()

def init_db_if_needed():
    """Initialise le fichier db.json s'il n'existe pas."""
    directory = os.path.dirname(DB_FILE)
    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"[Init] Created directory: {directory}")
        except Exception as e:
            print(f"[Error] Could not create directory {directory}: {e}")

    if not os.path.exists(DB_FILE):
        initial_data = {
            "users": [{
                "id": "u1", "uid": "Admin", "firstName": "System", "lastName": "Admin",
                "functionTitle": "Administrator", "role": "Admin", "password": "admin"
            }],
            "teams": [],
            "meetings": [],
            "weeklyReports": [],
            "workingGroups": [],
            "notifications": [],
            "dismissedAlerts": {},
            "systemMessage": { "active": False, "content": "", "level": "info" },
            "notes": [],
            "lastUpdated": int(time.time() * 1000)
        }
        try:
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, indent=2)
            print(f"[Init] ✅ Base de données créée avec succès : {DB_FILE}")
        except Exception as e:
            print(f"[Error] Impossible de créer db.json : {e}")
    else:
        print(f"[Init] Base de données existante trouvée : {DB_FILE}")

# Initialisation au démarrage
init_db_if_needed()

# --- Routes API ---

@app.route('/api/data', methods=['GET'])
def get_data():
    """Endpoint SMART READ : Lire le fichier JSON."""
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
    """Endpoint SMART WRITE : Écrire dans le fichier JSON avec contrôle de concurrence."""
    try:
        new_data = request.json
        client_base_version = request.headers.get('X-Base-Version')
        
        current_db_data = {}
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                current_db_data = json.load(f)
        
        # Concurrency Check
        # Si le client envoie une version de base, on vérifie si la DB n'a pas avancé entre temps
        if client_base_version and client_base_version != 'force':
            server_version = str(current_db_data.get('lastUpdated', 0))
            if server_version != str(client_base_version):
                print(f"[Conflit] Client Base: {client_base_version} vs Server: {server_version}")
                return jsonify({
                    "error": "Conflict detected",
                    "serverData": current_db_data
                }), 409

        # Mise à jour du timestamp
        new_data['lastUpdated'] = int(time.time() * 1000)
        
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=2)
            
        print(f"[Sauvegarde] Données mises à jour à {time.strftime('%H:%M:%S')}")
        return jsonify({"success": True, "timestamp": new_data['lastUpdated']})
    except Exception as e:
        print(f"Erreur écriture fichier: {e}")
        return jsonify({"error": "Erreur sauvegarde données"}), 500

# --- Settings Endpoints ---

@app.route('/api/config/db-path', methods=['GET'])
def get_db_config_path():
    return jsonify({"path": DB_FILE})

@app.route('/api/config/db-path', methods=['POST'])
def update_db_config_path():
    global DB_FILE
    new_path = request.json.get('path')
    if not new_path:
        return jsonify({"error": "Path required"}), 400
    
    try:
        # Save config
        with open(SERVER_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump({"dbPath": new_path}, f, indent=2)
        
        DB_FILE = new_path
        
        # Ensure DB exists at new location
        if not os.path.exists(DB_FILE):
            directory = os.path.dirname(DB_FILE)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
            
            initial_data = {
                "users": [{ "id": "u1", "uid": "Admin", "firstName": "System", "lastName": "Admin", "functionTitle": "Administrator", "role": "Admin", "password": "admin" }],
                "teams": [], "meetings": [], "weeklyReports": [], "workingGroups": [], "notifications": [],
                "dismissedAlerts": {}, "systemMessage": { "active": False, "content": "", "level": "info" },
                "notes": [], "lastUpdated": int(time.time() * 1000)
            }
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, indent=2)
                
        print(f"[Config] DB Path updated to: {DB_FILE}")
        return jsonify({"success": True, "path": DB_FILE})
    except Exception as e:
        print(f"Error updating config: {e}")
        return jsonify({"error": "Failed to update DB path"}), 500

# --- Serve React Frontend (Production) ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # Return index.html for React Router handling
        if os.path.exists(os.path.join(app.static_folder, 'index.html')):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return "API Server Running. Frontend not built (check 'dist' folder). Use npm run dev for development.", 200

if __name__ == '__main__':
    print(f"\n📡 SERVER API PYTHON (FLASK) LANCÉ !\n-------------------------------------\nPort API        : {PORT}\nFichier Données : {DB_FILE}\n-------------------------------------\n")
    app.run(port=PORT, debug=True, use_reloader=True)
