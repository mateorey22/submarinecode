# Guide d'Installation Complet - Système de Contrôle Sous-Marin

Ce guide vous explique pas à pas comment installer et configurer le système de contrôle pour votre drone sous-marin, en utilisant un Raspberry Pi 5 et un ESP8266.

## Table des Matières

1. [Matériel Nécessaire](#matériel-nécessaire)
2. [Connexions Matérielles](#connexions-matérielles)
3. [Configuration du Raspberry Pi 5](#configuration-du-raspberry-pi-5)
4. [Configuration de l'ESP8266](#configuration-de-lesp8266)
5. [Déploiement du Code](#déploiement-du-code)
6. [Test du Système](#test-du-système)
7. [Dépannage](#dépannage)

## Matériel Nécessaire

- Raspberry Pi 5
- ESP8266 (NodeMCU ou Wemos D1 Mini recommandé)
- Carte microSD (16 Go minimum) pour le Raspberry Pi
- Câbles Dupont femelle-femelle (pour les connexions)
- ESCs (Electronic Speed Controllers) pour moteurs brushless
- Moteurs brushless étanches
- Alimentation pour le Raspberry Pi (5V, 3A minimum)
- Batterie LiPo pour les moteurs (3S recommandée)
- Caméra compatible Raspberry Pi (optionnel)
- Boîtier étanche pour l'électronique

## Connexions Matérielles

### 1. Connexion USB entre Raspberry Pi 5 et ESP8266

Connectez simplement l'ESP8266 (NodeMCU ou Wemos D1 Mini) à un port USB du Raspberry Pi 5 à l'aide d'un câble USB approprié.

![Schéma de connexion USB](https://i.imgur.com/example.jpg)

**Note importante**: L'ESP8266 sera alimenté directement par le port USB du Raspberry Pi, il n'est donc pas nécessaire de connecter une alimentation séparée pour l'ESP8266.

### 2. Connexion des ESCs à l'ESP8266

| ESP8266 (NodeMCU) | ESC                |
|-------------------|-------------------|
| D1 (GPIO 5)       | Signal ESC Moteur 1 |
| D2 (GPIO 4)       | Signal ESC Moteur 2 |
| GND               | GND ESC           |

**Note**: Les ESCs doivent être alimentés séparément par la batterie LiPo.

### 3. Schéma d'Alimentation

```
Batterie LiPo 3S ----+---- ESC 1 ---- Moteur 1
                     |
                     +---- ESC 2 ---- Moteur 2
                     |
                     +---- Convertisseur DC-DC (5V) ---- Raspberry Pi 5
```

## Configuration du Raspberry Pi 5

### 1. Installation du Système d'Exploitation

1. Téléchargez Raspberry Pi OS (64-bit) depuis [le site officiel](https://www.raspberrypi.org/software/operating-systems/)
2. Utilisez [Raspberry Pi Imager](https://www.raspberrypi.org/software/) pour flasher l'image sur la carte microSD
3. Insérez la carte microSD dans le Raspberry Pi et démarrez-le
4. Suivez les instructions à l'écran pour configurer le système

### 2. Configuration Réseau

1. Connectez-vous au Raspberry Pi (via SSH ou directement)
2. Configurez le WiFi:
   ```bash
   sudo raspi-config
   ```
   Allez dans "Interface Options" > "Wireless LAN" et suivez les instructions

### 3. Configuration des permissions USB

1. Ajoutez votre utilisateur au groupe dialout pour avoir accès aux ports série:
   ```bash
   sudo usermod -a -G dialout $USER
   ```

2. Redémarrez le Raspberry Pi pour appliquer les changements:
   ```bash
   sudo reboot
   ```

3. Vérifiez que l'ESP8266 est bien détecté:
   ```bash
   ls -l /dev/ttyUSB*
   ```
   Vous devriez voir quelque chose comme `/dev/ttyUSB0`

### 4. Installation des Dépendances

1. Mettez à jour le système:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

2. Installez les dépendances nécessaires:
   ```bash
   sudo apt install -y git python3-pip python3-venv build-essential cmake libjpeg-dev libatlas-base-dev v4l-utils
   ```

3. Installez mjpg-streamer pour la caméra (optionnel):
   ```bash
   cd ~
   git clone --depth 1 https://github.com/jacksonliam/mjpg-streamer.git
   cd mjpg-streamer/mjpg-streamer-experimental
   make
   sudo make install
   ```

### 5. Configuration de la Caméra (Optionnel)

1. Activez la caméra:
   ```bash
   sudo raspi-config
   ```
   Allez dans "Interface Options" > "Camera" et activez-la

2. Créez un service pour mjpg-streamer:
   ```bash
   sudo nano /etc/systemd/system/mjpg-streamer.service
   ```

3. Ajoutez ce contenu:
   ```
   [Unit]
   Description=mjpg-streamer
   After=network.target

   [Service]
   ExecStart=/usr/local/bin/mjpg_streamer -i "input_uvc.so -d /dev/video0 -r 1280x720 -f 30" -o "output_http.so -p 8080 -w /usr/local/share/mjpg-streamer/www"
   Restart=always
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```

4. Activez et démarrez le service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable mjpg-streamer
   sudo systemctl start mjpg-streamer
   ```

## Configuration de l'ESP8266

### 1. Installation de l'IDE Arduino

1. Téléchargez et installez l'IDE Arduino depuis [le site officiel](https://www.arduino.cc/en/software)
2. Ouvrez l'IDE Arduino
3. Allez dans Fichier > Préférences
4. Dans "URL de gestionnaire de cartes supplémentaires", ajoutez:
   ```
   https://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
5. Cliquez sur OK
6. Allez dans Outils > Type de carte > Gestionnaire de cartes
7. Recherchez "esp8266" et installez "ESP8266 Community"
8. Fermez et rouvrez l'IDE Arduino

### 2. Flashage du Code ESP8266

1. Connectez l'ESP8266 à votre ordinateur via USB
2. Ouvrez l'IDE Arduino
3. Allez dans Outils > Type de carte > ESP8266 Boards et sélectionnez votre modèle (ex: "NodeMCU 1.0 (ESP-12E Module)")
4. Allez dans Outils > Port et sélectionnez le port COM de votre ESP8266
5. Ouvrez le fichier `code_esp8266/esp8266_submarine_controller.ino`
6. Cliquez sur le bouton "Téléverser" (flèche vers la droite)
7. Attendez que le téléversement soit terminé

## Déploiement du Code

### 1. Clonage du Dépôt sur le Raspberry Pi

1. Connectez-vous au Raspberry Pi via SSH:
   ```bash
   ssh pi@<adresse_ip_du_raspberry>
   ```

2. Clonez le dépôt:
   ```bash
   cd ~
   git clone https://github.com/mateorey22/submarine-control.git
   cd submarine-control
   ```

### 2. Installation des Dépendances Python

1. Créez un environnement virtuel:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Installez les dépendances:
   ```bash
   pip install -r /home/mateo/requirements.txt
   ```

### 3. Configuration du Service API

1. Créez un script de démarrage:
   ```bash
   nano ~/start_api.sh
   ```

2. Ajoutez ce contenu:
   ```bash
   #!/bin/bash
   cd ~/submarine-control
   source .venv/bin/activate
   python submarine/api/api.py
   ```

3. Rendez-le exécutable:
   ```bash
   chmod +x ~/start_api.sh
   ```

4. Créez un service systemd:
   ```bash
   sudo nano /etc/systemd/system/submarine-api.service
   ```

5. Ajoutez ce contenu:
   ```
   [Unit]
   Description=Submarine Control API
   After=network-online.target
   Wants=network-online.target

   [Service]
   User=pi
   WorkingDirectory=/home/pi/submarine-control
   ExecStart=/home/pi/start_api.sh
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

6. Activez et démarrez le service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable submarine-api
   sudo systemctl start submarine-api
   ```

## Test du Système

### 1. Vérification des Services

1. Vérifiez que l'API fonctionne:
   ```bash
   curl http://localhost:5000/api/test
   ```
   Vous devriez voir: `{"message":"API is working"}`

2. Vérifiez que la caméra fonctionne (si installée):
   ```bash
   curl http://localhost:5000/api/camera/status
   ```

### 2. Test de l'Interface Web

1. Sur un ordinateur ou un smartphone, ouvrez un navigateur
2. Accédez à `http://<adresse_ip_du_raspberry>/submarine/web/index.html`
3. Entrez l'adresse IP du Raspberry Pi dans le champ prévu
4. Cliquez sur "Connect to Submarine"
5. Vous devriez voir le flux vidéo (si la caméra est installée) et les informations système

### 3. Test des Moteurs

1. Utilisez le joystick virtuel pour contrôler les moteurs
2. Vérifiez que les valeurs PWM changent en fonction de vos mouvements
3. Vérifiez que les moteurs répondent correctement

## Dépannage

### Problèmes de Communication USB

1. Vérifiez que l'ESP8266 est bien détecté:
   ```bash
   ls -l /dev/ttyUSB*
   ```
   Vous devriez voir quelque chose comme: `/dev/ttyUSB0`

2. Vérifiez les permissions:
   ```bash
   sudo usermod -a -G dialout pi
   ```

3. Testez la communication avec un terminal série:
   ```bash
   sudo apt install minicom
   minicom -D /dev/ttyUSB0 -b 115200
   ```
   Tapez quelque chose et vérifiez si l'ESP8266 répond

### Problèmes avec les ESCs

1. Vérifiez que les ESCs sont correctement alimentés
2. Vérifiez que les signaux PWM sont correctement connectés
3. Essayez de calibrer les ESCs manuellement:
   - Déconnectez l'ESP8266
   - Connectez un récepteur RC standard
   - Suivez la procédure de calibration du fabricant des ESCs

### Problèmes avec l'API

1. Vérifiez les logs:
   ```bash
   sudo journalctl -u submarine-api
   ```

2. Redémarrez le service:
   ```bash
   sudo systemctl restart submarine-api
   ```

### Problèmes avec la Caméra

1. Vérifiez que la caméra est correctement connectée
2. Vérifiez les logs:
   ```bash
   sudo journalctl -u mjpg-streamer
   ```

3. Testez la caméra manuellement:
   ```bash
   raspistill -o test.jpg
   ```

## Conclusion

Félicitations! Votre système de contrôle pour drone sous-marin est maintenant configuré et prêt à l'emploi. Si vous rencontrez des problèmes, consultez la section dépannage ou n'hésitez pas à ouvrir une issue sur le dépôt GitHub.
