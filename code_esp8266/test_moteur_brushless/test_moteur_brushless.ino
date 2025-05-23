#include <Servo.h>

Servo esc;
int brocheESC = D1; // Broche D1 pour le signal PWM

void setup() {
  Serial.begin(115200);
  Serial.println("Test moteur brushless");
  
  esc.attach(brocheESC);
  esc.writeMicroseconds(1000); // Initialisation ESC (arrêt)
  Serial.println("ESC initialisé à 1000µs (arrêt)");
  delay(3000); // Délai d'armement
}

void loop() {
  // Accélération progressive (1000µs à 2000µs)
  Serial.println("Accélération progressive...");
  for(int pulse = 1000; pulse <= 2000; pulse += 10) {
    esc.writeMicroseconds(pulse);
    Serial.print("Pulse: ");
    Serial.println(pulse);
    delay(100);
  }
  
  // Maintien vitesse max (2s)
  Serial.println("Maintien vitesse maximale pendant 2s");
  delay(2000);
  
  // Décélération progressive (2000µs à 1000µs)
  Serial.println("Décélération progressive...");
  for(int pulse = 2000; pulse >= 1000; pulse -= 10) {
    esc.writeMicroseconds(pulse);
    Serial.print("Pulse: ");
    Serial.println(pulse);
    delay(100);
  }
  
  // Arrêt complet (2s)
  Serial.println("Arrêt complet pendant 2s");
  delay(2000);
}
