/*
 * ESP32-S3 Submarine Controller (8 Motors + ICM-20948 + LED Control - ON/OFF)
 *
 * Ce programme reçoit des commandes via USB (CDC) depuis un Raspberry Pi
 * et génère des signaux PWM pour contrôler 8 ESCs de moteurs brushless.
 * Il lit également un capteur ICM-20948 pour l'orientation via I2C.
 * Contrôle une LED en mode ON/OFF sur GPIO13.
 * Utilise la bibliothèque ESP32Servo pour une meilleure gestion des timers.
 *
 * Commandes série attendues:
 * 1. Moteurs: "M1:xxxx;M2:xxxx;M3:xxxx;M4:xxxx;M5:xxxx;M6:xxxx;M7:xxxx;M8:xxxx;\n"
 * - Mx: Valeur PWM pour le moteur x (1000-2000)
 * 2. Orientation: "GET_ORIENTATION\n"
 * 3. LED: "LED:xx;\n"
 * - xx: Valeur (0-100). La LED s'allume (ON) si xx >= 1, sinon elle s'éteint (OFF).
 *
 * Réponse Orientation: "O:roll,pitch,yaw,sys,gyro,accel,mag\n"
 * - roll, pitch: Calculés à partir de l'accéléromètre.
 * - yaw: Placeholder (valeur brute du magnétomètre X), PAS un vrai lacet/cap.
 * - sys,gyro,accel,mag: Statuts de calibration (sys basé sur la communication ICM, autres sont des placeholders).
 * Réponse LED ACK: "ACK_LED:xx\n" (xx est la valeur reçue 0-100)
 * Réponse Moteur ACK: "ACK_MOT:target1,target2,...,target8\n"
 *
 * Connexions Moteurs:
 * - ESP32 S3 GPIO4  -> ESC Moteur 1 Signal
 * - ESP32 S3 GPIO5  -> ESC Moteur 2 Signal
 * - ESP32 S3 GPIO6  -> ESC Moteur 3 Signal
 * - ESP32 S3 GPIO7  -> ESC Moteur 4 Signal
 * - ESP32 S3 GPIO11 -> ESC Moteur 5 Signal
 * - ESP32 S3 GPIO3  -> ESC Moteur 6 Signal
 * - ESP32 S3 GPIO12 -> ESC Moteur 7 Signal
 * - ESP32 S3 GPIO10 -> ESC Moteur 8 Signal
 *
 * Connexion LED:
 * - ESP32 S3 GPIO13 -> Transistor contrôlant les LED (signal ON/OFF)
 *
 * Connexions ICM-20948 (I2C):
 * - ESP32 GPIO 8 (SDA) -> ICM-20948 SDA
 * - ESP32 GPIO 9 (SCL) -> ICM-20948 SCL
 * - ESP32 3.3V -> ICM-20948 VIN
 * - ESP32 GND  -> ICM-20948 GND
 */

#include <Wire.h>
#include "ICM_20948.h"  // SparkFun ICM-20948 IMU Library
#include <ESP32Servo.h> // Utilise la bibliothèque Servo optimisée pour ESP32
#include <math.h>       // For atan2, sqrt, M_PI

// --- Configuration Moteurs ---
#define NUM_MOTORS 8
// Vérifiez que ces pins correspondent bien à votre câblage et ne sont pas en conflit (ex: I2C)
const int MOTOR_PINS[NUM_MOTORS] = {4, 5, 6, 7, 11, 3, 12, 10};
#define MIN_PWM 1000
#define MAX_PWM 2000
Servo motors[NUM_MOTORS];
int motorValues[NUM_MOTORS];
int motorTargets[NUM_MOTORS];
bool motorsInitialized = false;
const int SMOOTHING_STEP = 10;
unsigned long lastSmoothingTime = 0;
const int SMOOTHING_INTERVAL = 10; // ms

// --- Configuration LED ---
#define LED_PIN 13
int ledReceivedValue = 0; // Stocke la dernière valeur 0-100 reçue

// --- Configuration ICM-20948 ---
#define I2C_SDA_PIN 8
#define I2C_SCL_PIN 9
#define AD0_VAL 0       // I2C Address Jumper value (1 for 0x69 - default, 0 for 0x68)
ICM_20948_I2C myICM;    // Create an ICM_20948_I2C object
bool icmInitialized = false;

// --- Communication Série ---
String inputBuffer = "";
bool commandComplete = false;
unsigned long lastDebugTime = 0;
const unsigned long debugInterval = 5000; // 5 secondes

void setup() {
    Serial.begin(115200);
    delay(1000); // Donne le temps au moniteur série de se connecter

    Serial.println("------------------------------------------");
    Serial.println("ESP32-S3 Submarine Controller Initializing (ICM-20948, LED ON/OFF Mode)...");
    Serial.println("------------------------------------------");

    // --- Initialisation LED (Mode ON/OFF) ---
    Serial.println("Initializing LED control (ON/OFF) on GPIO 13...");
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW); // Éteindre la LED au démarrage
    Serial.println("LED control initialized (LOW).");
    Serial.println("------------------------------------------");

    // --- Initialisation ICM-20948 ---
    Serial.println("Initializing ICM-20948 sensor...");
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN); // Initialise la communication I2C avec les broches spécifiées
    Wire.setClock(400000); // Set I2C clock to 400kHz

    // Try to initialize the ICM-20948
    int maxRetries = 5;
    int retryCount = 0;
    while(!icmInitialized && retryCount < maxRetries) {
        myICM.begin(Wire, AD0_VAL);
        Serial.print("Attempting to initialize ICM-20948 (Attempt ");
        Serial.print(retryCount + 1);
        Serial.print(")... Status: ");
        Serial.println(myICM.statusString());

        if (myICM.status == ICM_20948_Stat_Ok) {
            icmInitialized = true;
            Serial.println("ICM-20948 detected and initialized successfully!");
            // You can check/set specific sensor settings here if needed, e.g.:
            // myICM.enableAccel(true);
            // myICM.enableGyro(true);
            // myICM.enableMag(true);
        } else {
            Serial.println("ICM-20948 initialization failed. Retrying...");
            delay(1000); // Wait a bit before retrying
            retryCount++;
        }
    }
    if (!icmInitialized) {
        Serial.printf("Failed to initialize ICM-20948 after %d attempts on SDA=%d, SCL=%d. Check wiring or I2C ADDR (AD0_VAL)!\n", maxRetries, I2C_SDA_PIN, I2C_SCL_PIN);
        // On continue même sans l'ICM pour que les moteurs fonctionnent potentiellement
    }
    Serial.println("------------------------------------------");


    // --- Initialisation Moteurs ---
    Serial.printf("Initializing %d motors...\n", NUM_MOTORS);
    for (int i = 0; i < NUM_MOTORS; i++) {
        motorValues[i] = MIN_PWM;
        motorTargets[i] = MIN_PWM;
        // Vérifier si la pin moteur est la même qu'une pin I2C ou LED
        if (MOTOR_PINS[i] == LED_PIN || MOTOR_PINS[i] == I2C_SDA_PIN || MOTOR_PINS[i] == I2C_SCL_PIN) {
            Serial.printf("WARNING: Motor %d pin (%d) conflicts with LED or I2C pins!\n", i + 1, MOTOR_PINS[i]);
        }
        motors[i].attach(MOTOR_PINS[i], MIN_PWM, MAX_PWM);
        motors[i].writeMicroseconds(MIN_PWM);
        Serial.printf("Motor %d attached to GPIO %d, set to %d us\n", i + 1, MOTOR_PINS[i], MIN_PWM);
    }

    Serial.println("Waiting for ESCs initialization (2 seconds)...");
    delay(2000);

    Serial.println("Sending final MIN_PWM signal to ESCs...");
    for (int i = 0; i < NUM_MOTORS; i++) {
        motors[i].writeMicroseconds(MIN_PWM);
    }
    delay(100);

    motorsInitialized = true;
    Serial.println("Motor initialization complete.");
    Serial.println("------------------------------------------");
    Serial.println("ESP32-S3 Submarine Controller Ready");
    Serial.println("Waiting for serial commands...");
    Serial.println("------------------------------------------");
}

void loop() {
    unsigned long currentMillisLoop = millis();
    if (currentMillisLoop - lastDebugTime > debugInterval && !Serial.available() && inputBuffer.length() == 0) {
        Serial.println("Waiting for serial data...");
        lastDebugTime = currentMillisLoop;
    }

    // Lecture des commandes série
    while (Serial.available() > 0) {
        char inChar = (char)Serial.read();
        if (inChar == '\n') {
            commandComplete = true;
            break;
        } else if (inChar != '\r') { // Ignorer les caractères '\r' (retour chariot)
            inputBuffer += inChar;
        }
        lastDebugTime = millis(); // Réinitialiser le timer si on reçoit des données
    }

    // Traitement de la commande si elle est complète
    if (commandComplete) {
        Serial.print("Raw command received: "); Serial.println(inputBuffer); // Afficher la commande brute reçue

        // Vérifier si c'est une demande d'orientation
        if (inputBuffer.equals("GET_ORIENTATION")) {
            if (icmInitialized) {
                sendOrientationData();
            } else {
                // Envoyer une réponse d'erreur formatée que l'API peut comprendre
                Serial.println("O:0.00,0.00,0.00,0,0,0,0"); // Valeurs par défaut / erreur
            }
        }
        // Vérifier si c'est une commande LED
        else if (inputBuffer.startsWith("LED:")) {
            processLedCommand(inputBuffer);
        }
        // Sinon, essayer de traiter comme une commande moteur
        else {
            processMotorCommand(inputBuffer);
        }

        inputBuffer = ""; // Vider le buffer pour la prochaine commande
        commandComplete = false;
        Serial.println("------------------------------------------"); // Séparateur visuel après traitement
    }

    // Appliquer le lissage des valeurs moteur en continu
    if (motorsInitialized) {
        updateMotorValues();
    }

    delay(1); // Petite pause pour la stabilité
}

// Fonction pour envoyer les données d'orientation de l'ICM-20948
void sendOrientationData() {
    // Serial.println("Processing GET_ORIENTATION command (ICM-20948)..."); // Commenté pour éviter d'interférer avec la réponse API
    if (myICM.dataReady()) { // Check if new data is available from the sensor
        myICM.getAGMT();     // Reads all sensor data (Accelerometer, Gyroscope, Magnetometer, Temperature)

        float accX = myICM.agmt.acc.axes.x; // Scaled accelerometer X reading (in g's)
        float accY = myICM.agmt.acc.axes.y; // Scaled accelerometer Y reading (in g's)
        float accZ = myICM.agmt.acc.axes.z; // Scaled accelerometer Z reading (in g's)

        // Calculate Roll and Pitch from accelerometer data.
        // This provides tilt angles but is susceptible to linear acceleration.
        // The BNO055 output format was: O:roll,pitch,yaw,...
        // BNO055 euler.y() was Roll, euler.z() was Pitch, euler.x() was Yaw.
        // We aim to match this.
        // Common tilt calculations (assuming sensor X forward, Y left, Z up):
        // Roll (around sensor's X-axis) = atan2(accY, accZ)
        // Pitch (around sensor's Y-axis) = atan2(-accX, sqrt(accY^2 + accZ^2))

        float roll_deg_equivalent = atan2(accY, accZ) * 180.0 / M_PI;
        float pitch_deg_equivalent = atan2(-accX, sqrt(accY * accY + accZ * accZ)) * 180.0 / M_PI;
        
        // Yaw: ICM-20948 basic getAGMT() doesn't provide fused yaw.
        // Using raw magnetometer X-axis reading as a placeholder. THIS IS NOT TRUE YAW.
        float yaw_placeholder = myICM.agmt.mag.axes.x; // Scaled magnetometer X reading (in uT)

        // Calibration status:
        // 'sys' based on ICM communication status. 3 = good, 0 = error/not init.
        // 'gyro', 'accel', 'mag' are placeholders (1) as basic ICM read doesn't offer BNO055-like detailed cal status.
        uint8_t cal_sys = (myICM.status == ICM_20948_Stat_Ok) ? 3 : 0;
        uint8_t cal_gyro = 1;  // Placeholder
        uint8_t cal_accel = 1; // Placeholder
        uint8_t cal_mag = 1;   // Placeholder (Magnetometer self-test/status is more complex)

        Serial.printf("O:%.2f,%.2f,%.2f,%d,%d,%d,%d\n",
                      roll_deg_equivalent,    // Mapped to BNO's roll (euler.y)
                      pitch_deg_equivalent,   // Mapped to BNO's pitch (euler.z)
                      yaw_placeholder,        // Mapped to BNO's yaw (euler.x) - MAGNETOMETER X-AXIS VALUE
                      cal_sys, cal_gyro, cal_accel, cal_mag);
        // Serial.println("ICM-20948 data sent. Note: Roll/Pitch from Accel. Yaw is MagX (placeholder)."); // Commenté

    } else {
        // Serial.println("WARNING: ICM-20948 data not ready or sensor error during read."); // Commenté
        // Send default/error values in the correct format
        Serial.println("O:0.00,0.00,0.00,0,0,0,0");
    }
}


// Fonction pour lisser les transitions de vitesse des moteurs
void updateMotorValues() {
    unsigned long currentMillisUpdate = millis();
    if (currentMillisUpdate - lastSmoothingTime >= SMOOTHING_INTERVAL) {
        lastSmoothingTime = currentMillisUpdate;
        for (int i = 0; i < NUM_MOTORS; i++) {
            bool valueChanged = false;
            if (motorValues[i] < motorTargets[i]) {
                motorValues[i] = min(motorValues[i] + SMOOTHING_STEP, motorTargets[i]);
                valueChanged = true;
            } else if (motorValues[i] > motorTargets[i]) {
                motorValues[i] = max(motorValues[i] - SMOOTHING_STEP, motorTargets[i]);
                valueChanged = true;
            }
            // Écrire sur le servo uniquement si la valeur lissée a changé
            if (valueChanged) {
                motors[i].writeMicroseconds(motorValues[i]);
            }
        }
    }
}

// Fonction pour traiter la commande série des moteurs
void processMotorCommand(String command) {
    Serial.println("Processing motor command...");
    bool anyMotorUpdated = false;

    for (int i = 0; i < NUM_MOTORS; i++) {
        String motorKey = "M" + String(i + 1) + ":";
        int keyIndex = command.indexOf(motorKey);
        if (keyIndex != -1) {
            int valueStartIndex = keyIndex + motorKey.length();
            int valueEndIndex = command.indexOf(";", valueStartIndex);
            if (valueEndIndex != -1) {
                String valueStr = command.substring(valueStartIndex, valueEndIndex);
                int parsedValue = valueStr.toInt();
                // Valider la valeur PWM
                if (parsedValue >= MIN_PWM && parsedValue <= MAX_PWM) {
                    if (motorTargets[i] != parsedValue) { // Mettre à jour seulement si la cible change
                        motorTargets[i] = parsedValue;
                        Serial.printf("  Motor %d target updated to: %d\n", i + 1, parsedValue);
                        anyMotorUpdated = true;
                    }
                } else {
                    Serial.printf("  WARNING: Invalid PWM value (%d) for Motor %d. Must be %d-%d. Ignoring.\n", parsedValue, i + 1, MIN_PWM, MAX_PWM);
                }
            } else {
                 Serial.printf("  WARNING: Malformed command. Missing ';' after value for %s\n", motorKey.c_str());
            }
        }
    }

    if (!anyMotorUpdated && command.length() > 0 && !command.startsWith("ACK")) { // Éviter les warnings pour les ACKs ou si rien n'a changé
      Serial.println("  INFO: Motor command received, but no valid motor keys (M1:..; to M8:..;) found or no targets changed.");
    }

    // Envoyer un accusé de réception (ACK) avec les valeurs cibles MOTEUR ACTUELLES
    Serial.print("ACK_MOT:"); // Préfixe différent pour distinguer de l'orientation
    for (int i = 0; i < NUM_MOTORS; i++) {
        Serial.print(motorTargets[i]);
        if (i < NUM_MOTORS - 1) {
            Serial.print(",");
        }
    }
    Serial.println(); // Terminer la ligne ACK_MOT
    Serial.println("Motor command processing finished.");
}

// Fonction pour traiter la commande de contrôle LED (ON/OFF)
void processLedCommand(String command) {
    Serial.println("Processing LED command (ON/OFF mode)...");

    // Format attendu: "LED:xx;"
    String ledKey = "LED:";
    int keyIndex = command.indexOf(ledKey);
    if (keyIndex != -1) {
        int valueStartIndex = keyIndex + ledKey.length();
        int valueEndIndex = command.indexOf(";", valueStartIndex);
        if (valueEndIndex != -1) {
            String valueStr = command.substring(valueStartIndex, valueEndIndex);
            int parsedValue = valueStr.toInt();

            // Vérifier que la valeur est dans la plage 0-100
            if (parsedValue >= 0 && parsedValue <= 100) {
                ledReceivedValue = parsedValue; // Stocker la valeur reçue

                // Logique ON/OFF: Allumer si >= 1%, éteindre si 0%
                if (parsedValue >= 1) {
                    digitalWrite(LED_PIN, HIGH);
                    Serial.printf("  LED turned ON (Requested value: %d%%)\n", ledReceivedValue);
                } else { // parsedValue == 0
                    digitalWrite(LED_PIN, LOW);
                    Serial.printf("  LED turned OFF (Requested value: %d%%)\n", ledReceivedValue);
                }

                // Envoyer un accusé de réception avec la valeur reçue (0-100)
                Serial.printf("ACK_LED:%d\n", ledReceivedValue);

            } else {
                Serial.printf("  WARNING: Invalid LED value (%d). Must be 0-100. Ignoring.\n", parsedValue);
            }
        } else {
            Serial.println("  WARNING: Malformed LED command. Missing ';' after value.");
        }
    } else {
        Serial.println("  WARNING: LED command format incorrect. Expected 'LED:xx;'");
    }

    Serial.println("LED command processing finished.");
}
