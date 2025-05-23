# Contexte du Projet Sous-Marin

Ce document décrit la configuration mise en place sur le Raspberry Pi pour contrôler un sous-marin (ROV), ainsi que les étapes pour développer l'API et le site web de contrôle.

## Architecture du Système

Le système se compose des éléments suivants :

1.  **Raspberry Pi:** Le cœur du système. Il exécute :
    *   **mjpg-streamer:** Diffuse le flux vidéo de la caméra.
    *   **API Flask (`api.py`):** Fournit une interface pour contrôler le sous-marin et récupérer des données des capteurs.
    *   **(Anciennement) Nginx:** (Ce rôle a été supprimé dans la configuration actuelle). Auparavant, Nginx servait le site web statique et agissait comme un reverse proxy.

2.  **Caméra:** Connectée au Raspberry Pi (typiquement via le port CSI ou USB), elle fournit le flux vidéo.

3.  **Client (Ordinateur, Téléphone, etc.):** Se connecte au Raspberry Pi via le réseau pour :
    *   Visualiser le flux vidéo.
    *   Interagir avec l'interface web pour contrôler le sous-marin.
    *   Communiquer avec l'API Flask.

## Installation et Configuration (Ce qui a été fait)

Le script Bash que nous avons créé automatise les tâches suivantes :

1.  **Mises à jour et dépendances:**
    *   Met à jour le système (`apt update`, `apt upgrade`).
    *   Installe les paquets nécessaires : `git`, `python3-pip`, `python3-venv`, `build-essential`, `cmake`, `libjpeg-dev`, `libatlas-base-dev`, `v4l-utils`.

2.  **mjpg-streamer:**
    *   Télécharge le code source depuis GitHub.
    *   Compile et installe `mjpg-streamer`.
    *   Configure `mjpg-streamer` pour démarrer automatiquement au boot en tant que service systemd (`mjpg-streamer.service`).
        *   Le stream est accessible via : `http://<adresse_ip_du_pi>:8080/?action=stream`

3.  **API Flask:**
    *   Clone le dépôt GitHub du projet.
    *   Crée un environnement virtuel Python (`.venv`).
    *   Installe les dépendances Python (listées dans `requirements.txt`) dans l'environnement virtuel.
    *   Crée un script de démarrage (`start_api.sh`) qui :
        *   Active l'environnement virtuel.
        *   Lance l'API Flask (`python3 api.py`).
        *   Redirige la sortie (stdout et stderr) vers `/home/mateo/api.log`.
    *   Configure un service systemd (`submarine-api.service`) pour démarrer l'API automatiquement au boot (après `mjpg-streamer` et le réseau).
    *  Supprime le dépôt Github une fois l'installation de l'API terminée

4.  **Vérification:**
    *   Attend 5 secondes pour permettre à l'API de démarrer.
    *   Effectue une requête `curl` vers un endpoint de test de l'API (à configurer dans le script).

5. **Logs:**
    *   Toutes les actions du script d'installation sont enregistrées dans `/home/mateo/submarine_setup.log`.
    *   La sortie de l'API Flask est enregistrée dans `/home/mateo/api.log`.

## Développement de l'API (`api.py`)

Voici les étapes et les bonnes pratiques pour créer ton `api.py` :

1.  **Structure de base (Flask):**

    ```python
    from flask import Flask, jsonify, request

    app = Flask(__name__)

    # Endpoint de test (à modifier/supprimer)
    @app.route('/api/test', methods=['GET'])
    def test_api():
        return jsonify({'message': 'L\'API fonctionne!'}), 200

    # --- Tes autres endpoints ici ---
    # Exemple: endpoint pour allumer un moteur
    @app.route('/api/motor/on', methods=['POST'])
    def turn_motor_on():
        # Récupérer les données de la requête (si nécessaire)
        # data = request.get_json()
        # motor_id = data.get('motor_id')

        # Logique pour allumer le moteur (appel à des fonctions de contrôle, etc.)
        # ...

        return jsonify({'status': 'success', 'message': 'Moteur allumé'}), 200

    # ... autres endpoints ...

    if __name__ == '__main__':
        # IMPORTANT: Utilise '0.0.0.0' pour écouter sur toutes les interfaces, pas seulement localhost.
        app.run(debug=True, host='0.0.0.0', port=5000) # Vérifie que le port correspond à FLASK_PORT dans le script Bash.

    ```

2.  **Endpoints:**
    *   Définis des endpoints clairs et significatifs pour chaque action (e.g., `/api/motor/on`, `/api/lights/off`, `/api/sensor/temperature`, etc.).
    *   Utilise les bonnes méthodes HTTP :
        *   `GET`: Pour récupérer des données.
        *   `POST`: Pour envoyer des commandes ou des données.
        *   `PUT`: Pour mettre à jour des ressources.
        *   `DELETE`: Pour supprimer des ressources (moins courant dans ce contexte).
    *   Retourne des réponses JSON claires (avec `jsonify`) et des codes de statut HTTP appropriés (200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error, etc.).

3.  **Gestion des erreurs:**
    *   Utilise des `try...except` pour gérer les erreurs potentielles (problèmes de communication avec les moteurs, capteurs défectueux, etc.).
    *   Retourne des messages d'erreur clairs à l'utilisateur dans les réponses JSON.

4.  **`requirements.txt`:**
    *   Crée un fichier `requirements.txt` à la racine de ton projet (à côté de `api.py`).
    *   Liste toutes les dépendances Python, par exemple :

        ```
        Flask
        # Autres bibliothèques (par exemple, pour communiquer avec des capteurs)
        ```

5.  **Communication avec le matériel:**
    *   Tu auras besoin de bibliothèques Python pour communiquer avec les moteurs, les capteurs, etc.  Cela dépend du matériel spécifique que tu utilises.  Par exemple :
        *   **GPIO:**  Pour contrôler directement les broches GPIO du Raspberry Pi (pour des LED, des relais simples, etc.).  La bibliothèque `RPi.GPIO` est courante.
        *   **I2C/SPI:** Pour communiquer avec des capteurs et des contrôleurs de moteur plus avancés.  Des bibliothèques comme `smbus2` (pour I2C) ou `spidev` (pour SPI) sont utilisées.
        *   **Bibliothèques spécifiques aux fabricants:**  De nombreux capteurs et contrôleurs ont leurs propres bibliothèques Python (par exemple, des bibliothèques pour des contrôleurs de moteur Adafruit, des capteurs Bosch, etc.).
    *   Importe ces bibliothèques dans `api.py` et utilise leurs fonctions dans tes endpoints.

6. **Sécurité (IMPORTANT):**
    *  **Ne code *jamais* en dur des identifiants ou des mots de passe dans ton code.** Utilise des variables d'environnement ou un fichier de configuration séparé.
    * **Valide les entrées.**  Ne fais jamais confiance aux données envoyées par l'utilisateur. Vérifie que les valeurs reçues sont dans les plages attendues, etc., pour éviter les injections de code ou les comportements inattendus.
    * **Si ton API doit être accessible depuis l'extérieur de ton réseau local (ce qui n'est *pas* recommandé pour un ROV sans précautions supplémentaires),** utilise HTTPS (avec un certificat SSL/TLS) et mets en place une authentification (au minimum, une authentification basique avec un mot de passe fort, ou mieux, une authentification par jeton).  *Ne fais jamais ça sans comprendre les risques de sécurité.* Pour une utilisation en réseau local, HTTP est généralement suffisant, mais sois conscient des risques si ton réseau Wi-Fi n'est pas sécurisé.

7. **Documentation**
   * Il est recommandé de documenter ton code, et de commenter les différentes fonctions.

## Développement du Site Web (HTML, CSS, JavaScript)

Le script que nous avons mis en place *ne gère plus* le service des fichiers statiques du site web. Tu devras utiliser une autre méthode (voir la section "Alternatives" ci-dessous).

**Structure de base d'une page HTML interagissant avec l'API:**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Contrôle du Sous-Marin</title>
    <link rel="stylesheet" href="style.css">