/*
 * ESP8266 Submarine Controller
 * 
 * Ce programme reçoit des commandes via USB depuis un Raspberry Pi
 * et génère des signaux PWM pour contrôler des ESCs de moteurs brushless.
 * 
 * Format de commande: "M1:1000;M2:1000;\n"
 * - M1: Valeur PWM pour le moteur 1 (1000-2000)
 * - M2: Valeur PWM pour le moteur 2 (1000-2000)
 * 
 * Valeurs PWM:
 * - 1000 : Moteur arrêté (pulse de 1ms)
 * - 1000-2000 : Contrôle de vitesse (pulse de 1ms à 2ms)
 * - 2000 : Vitesse maximale (pulse de 2ms)
 * 
 * Connexions:
 * - ESP8266 connecté via USB au Raspberry Pi
 * - ESP8266 D1 -> ESC Moteur 1 Signal
 * - ESP8266 D2 -> ESC Moteur 2 Signal
 */

#include <Servo.h>

// Définition des broches
#define MOTOR1_PIN 5  // GPIO5
#define MOTOR2_PIN 4  // GPIO4

// Limites de sécurité pour les valeurs PWM
#define MIN_PWM 1000   // Valeur minimale (moteur arrêté - pulse de 1ms)
#define MAX_PWM 2000   // Valeur maximale (pleine puissance - pulse de 2ms)
#define MID_PWM 1500   // Valeur moyenne (pulse de 1.5ms pour la touche 'a')

// Objets Servo pour contrôler les ESCs
Servo motor1;
Servo motor2;

// Variables pour stocker les valeurs PWM actuelles
int motor1Value = MIN_PWM;      // Démarrage à l'arrêt (1ms)
int motor2Value = MIN_PWM;      // Démarrage à l'arrêt (1ms)
int motor1Target = MIN_PWM;     // Valeur cible pour le moteur 1
int motor2Target = MIN_PWM;     // Valeur cible pour le moteur 2
bool motorsInitialized = false;

// Paramètres de lissage pour les transitions douces
const int SMOOTHING_STEP = 5;   // Pas de changement par cycle (plus petit = plus doux)
unsigned long lastSmoothingTime = 0;
const int SMOOTHING_INTERVAL = 10; // Intervalle en ms entre les étapes de lissage

// Buffer pour les commandes reçues
String inputBuffer = "";
bool commandComplete = false;

void setup() {
  // Initialisation de la communication série
  Serial.begin(115200);
  
  // Initialisation des ESCs
  motor1.attach(MOTOR1_PIN);
  motor2.attach(MOTOR2_PIN);
  
  // Position initiale (arrêt - 1ms)
  motor1.writeMicroseconds(MIN_PWM);
  motor2.writeMicroseconds(MIN_PWM);
  
  // Délai pour laisser les ESCs s'initialiser
  delay(2000);
  
  // Message de démarrage
  Serial.println("ESP8266 Submarine Controller Ready");
  
  // Envoyer une seule fois la valeur d'arrêt pour initialiser les ESCs
  motor1.writeMicroseconds(MIN_PWM);
  motor2.writeMicroseconds(MIN_PWM);
  delay(100);
  
  // Garder les servos attachés pour générer des signaux continus
  motorsInitialized = true;
}

// Variable pour limiter les messages de debug
unsigned long lastDebugTime = 0;
const unsigned long debugInterval = 5000; // 5 secondes entre les messages de debug

void loop() {
  // Lecture des commandes série
  // Afficher le message d'attente seulement toutes les 5 secondes pour éviter de saturer la connexion
  unsigned long currentMillis = millis();
  if (currentMillis - lastDebugTime > debugInterval) {
    Serial.println("Waiting for serial data...");
    lastDebugTime = currentMillis;
  }
  
  // Vérifier si des données sont disponibles
  while (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    inputBuffer += inChar;

    // Détection de fin de commande
    if (inChar == '\n') {
      commandComplete = true;
      Serial.print("Command received: "); Serial.println(inputBuffer);
      break;
    }
  }

  // Traitement de la commande
  if (commandComplete) {
    processCommand(inputBuffer);
    inputBuffer = "";
    commandComplete = false;
  }
  
  // Appliquer le lissage des valeurs moteur
  updateMotorValues();
  
  // Petit délai pour éviter de surcharger le processeur
  delay(5);
}

// Fonction pour lisser les transitions de vitesse des moteurs
void updateMotorValues() {
  unsigned long currentMillis = millis();
  
  // Limiter la fréquence des mises à jour pour un lissage contrôlé
  if (currentMillis - lastSmoothingTime >= SMOOTHING_INTERVAL) {
    lastSmoothingTime = currentMillis;
    
    // Lissage pour le moteur 1
    if (motor1Value < motor1Target) {
      motor1Value = min(motor1Value + SMOOTHING_STEP, motor1Target);
      motor1.writeMicroseconds(motor1Value);
    } 
    else if (motor1Value > motor1Target) {
      motor1Value = max(motor1Value - SMOOTHING_STEP, motor1Target);
      motor1.writeMicroseconds(motor1Value);
    }
    
    // Lissage pour le moteur 2
    if (motor2Value < motor2Target) {
      motor2Value = min(motor2Value + SMOOTHING_STEP, motor2Target);
      motor2.writeMicroseconds(motor2Value);
    } 
    else if (motor2Value > motor2Target) {
      motor2Value = max(motor2Value - SMOOTHING_STEP, motor2Target);
      motor2.writeMicroseconds(motor2Value);
    }
  }
}

void processCommand(String command) {
  // Traitement de la commande reçue
  // Vérification du format de la commande
  if (command.indexOf("M1:") >= 0 && command.indexOf("M2:") >= 0) {

    // Extraction de la valeur M1
    int m1Start = command.indexOf("M1:") + 3;
    int m1End = command.indexOf(";", m1Start);
    if (m1Start >= 3 && m1End > m1Start) {
      int m1Value = command.substring(m1Start, m1End).toInt();
      Serial.print("M1 Target: "); Serial.println(m1Value);
      // Validation de la plage
      if (m1Value >= MIN_PWM && m1Value <= MAX_PWM) {
        // Définir la valeur cible (sera atteinte progressivement)
        motor1Target = m1Value;
      }
    }

    // Extraction de la valeur M2
    int m2Start = command.indexOf("M2:") + 3;
    int m2End = command.indexOf(";", m2Start);
    if (m2Start >= 3 && m2End > m2Start) {
      int m2Value = command.substring(m2Start, m2End).toInt();
      Serial.print("M2 Target: "); Serial.println(m2Value);
      // Validation de la plage
      if (m2Value >= MIN_PWM && m2Value <= MAX_PWM) {
        // Définir la valeur cible (sera atteinte progressivement)
        motor2Target = m2Value;
      }
    }

    // Attacher les servos si ce n'est pas déjà fait
    if (!motorsInitialized) {
      motor1.attach(MOTOR1_PIN);
      motor2.attach(MOTOR2_PIN);
      motorsInitialized = true;
    }

    // Les valeurs seront mises à jour progressivement dans updateMotorValues()

    // Confirmation de la commande reçue
    Serial.print("ACK:");
    Serial.print(motor1Target);
    Serial.print(",");
    Serial.println(motor2Target);
  }
}
