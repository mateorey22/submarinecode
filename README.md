# Submarine Control System

Ce projet implémente un système de contrôle pour un drone sous-marin avec :
- Un Raspberry Pi comme contrôleur principal
- Un ESP8266 pour la génération des signaux PWM
- Une communication UART entre le RPi et l'ESP8266
- Une API web pour le contrôle à distance

## Architecture du système

```
Interface Web <-> API Flask (RPi) <-> USB <-> ESP8266 <-> ESCs/Moteurs
```

Le flux de données est le suivant :
1. L'interface web envoie des commandes à l'API Flask
2. L'API Flask transmet ces commandes à l'ESP8266 via USB
3. L'ESP8266 génère les signaux PWM pour contrôler les ESCs des moteurs

## Configuration du Raspberry Pi

### Connexion USB

1. Connecter l'ESP8266 à un port USB du Raspberry Pi

2. Vérifier que le périphérique est reconnu :
   ```
   ls -l /dev/ttyUSB*
   ```

3. Si nécessaire, ajouter l'utilisateur au groupe dialout pour les permissions :
   ```
   sudo usermod -a -G dialout $USER
   sudo reboot
   ```

### Installer les dépendances Python

```
cd submarine/api
pip install -r requirements.txt
```

Si `pyserial` n'est pas inclus dans requirements.txt, l'installer :
```
pip install pyserial
```

## Configuration de l'ESP8266

### Flasher le code

1. Installer l'IDE Arduino et configurer pour l'ESP8266
2. Ouvrir le fichier `code_esp8266/esp8266_submarine_controller.ino`
3. Sélectionner la carte NodeMCU 1.0 (ESP-12E Module)
4. Connecter l'ESP8266 via USB et sélectionner le port
5. Téléverser le code

## Schéma de câblage

### Connexion USB

Connecter simplement l'ESP8266 à un port USB du Raspberry Pi à l'aide d'un câble USB approprié.

### Connexion des ESCs

| ESP8266 | ESC |
|---------|-----|
| D1      | Signal ESC Moteur 1 |
| D2      | Signal ESC Moteur 2 |
| GND     | GND ESC |

**Note** : Les ESCs doivent être alimentés séparément avec une batterie adaptée.

## Test du système

### Démarrer l'API

```
cd submarine/api
python api.py
```

### Tester le contrôle des moteurs

Utiliser curl pour envoyer une commande :

```
curl -X POST http://localhost:5000/api/motors/control \
  -H "Content-Type: application/json" \
  -d '{"m1": 1000, "m2": 1000}'
```

Valeurs PWM :
- 1000 : Moteur arrêté (pulse de 1ms)
- 1000-2000 : Contrôle de vitesse (pulse de 1ms à 2ms)
- 2000 : Vitesse maximale (pulse de 2ms)

## Dépannage

### Problèmes de communication USB

1. Vérifier que l'ESP8266 est bien détecté
   ```
   ls -l /dev/ttyUSB*
   ```

2. Vérifier les permissions
   ```
   sudo usermod -a -G dialout $USER
   ```

3. Tester la communication avec un terminal série
   ```
   sudo apt install minicom
   minicom -D /dev/ttyUSB0 -b 115200
   ```

### Problèmes avec les ESCs

1. Vérifier que les ESCs sont correctement calibrés
2. Vérifier l'alimentation des ESCs
3. Tester les ESCs avec un récepteur RC standard pour confirmer leur fonctionnement

## Ressources

- [Documentation ESP8266](https://arduino-esp8266.readthedocs.io/)
- [Documentation Flask](https://flask.palletsprojects.com/)
- [Guide UART Raspberry Pi](https://www.raspberrypi.org/documentation/configuration/uart.md)
