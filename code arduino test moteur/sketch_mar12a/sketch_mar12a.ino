#include <Servo.h>

const int escPin = 6;
const int ledPin = 13;
const int potPin = A0;

// Seuil pour allumer la LED (ajustez si nécessaire)
const int ledThreshold = 1050; // Légèrement au-dessus de la valeur minimale de l'ESC (1000)

Servo esc;

void setup() {
  esc.attach(escPin);
  pinMode(ledPin, OUTPUT);
  pinMode(potPin, INPUT);
  Serial.begin(9600);

  // Calibration de l'ESC
  esc.writeMicroseconds(1000);
  delay(2000);
  esc.writeMicroseconds(2000);
  delay(1000);
  esc.writeMicroseconds(1000);
  delay(1000);
}

void loop() {
  int potValue = analogRead(potPin);
  int escSignal = map(potValue, 0, 1023, 1000, 2000);
  esc.writeMicroseconds(escSignal);

  // Contrôle de la LED avec un seuil
  if (escSignal > ledThreshold) {
    digitalWrite(ledPin, HIGH); // Allume la LED
  } else {
    digitalWrite(ledPin, LOW);  // Éteint la LED
  }

  Serial.print("Pot: ");
  Serial.print(potValue);
  Serial.print(", ESC: ");
  Serial.print(escSignal);
  Serial.print(", LED: ");
  Serial.println(digitalRead(ledPin)); // Affiche l'état de la LED (0 ou 1)

  delay(20);
}
