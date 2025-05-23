document.addEventListener('DOMContentLoaded', function() {
    const ipAddressInput = document.getElementById('ipAddress');
    const testApiButton = document.getElementById('testApi');
    const cpuTempSpan = document.getElementById('cpuTemp');
    const ramUsageSpan = document.getElementById('ramUsage');
    const systemLoadSpan = document.getElementById('systemLoad');
    const diskSpaceSpan = document.getElementById('diskSpace');
    const ramUsageBar = document.getElementById('ramUsageBar');
    const systemLoadBar = document.getElementById('systemLoadBar');
    const diskSpaceBar = document.getElementById('diskSpaceBar');
    const videoStream = document.getElementById('videoStream');
    const cameraStatusSpan = document.getElementById('cameraStatus');
    
    // Récupérer les éléments d'affichage des moteurs
    const motorValueSpans = [];
    for (let i = 1; i <= 8; i++) {
        motorValueSpans.push(document.getElementById(`motor${i}Value`));
    }

    // Récupérer les éléments de contrôle LED
    const ledSlider = document.getElementById('ledSlider');
    const ledValueSpan = document.getElementById('ledValue');
    const ledStatusSpan = document.getElementById('ledStatus');

    const gamepadStatusSpan = document.createElement('p');
    gamepadStatusSpan.id = 'gamepadStatus';
    gamepadStatusSpan.style.color = 'white';
    document.querySelector('.config').appendChild(gamepadStatusSpan);

    const buttonA = document.querySelector('.button.a');
    const buttonB = document.querySelector('.button.b');
    const buttonX = document.querySelector('.button.x');
    const buttonY = document.querySelector('.button.y');

    // Variables pour les valeurs des moteurs (8 moteurs)
    let motorValues = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000];
    let lastCommandTime = 0;
    const commandThrottle = 100; // Envoyer les commandes au maximum toutes les 100ms
    let isMotorActive = false;
    const motorStatusSpan = document.getElementById('motorStatus');
    
    // Variables pour la musique
    let isMusicPlaying = false;
    let musicTimeout = null;
    
    // Variables pour le contrôle LED
    let ledBrightness = 0;
    let isLedOn = false;
    let lastLedCommandTime = 0;
    
    // Valeurs PWM
    const PWM_MIN = 1000;  // Pulse de 1ms (arrêt)
    const PWM_MAX = 2000;  // Pulse de 2ms (vitesse maximale)
    const PWM_HALF = 1500; // Pulse de 1.5ms (vitesse moyenne)
    
    // Joystick gauche - contrôle de 1ms à 1.5ms
    const LEFT_MIN = PWM_MIN;   // 1000 (1ms)
    const LEFT_MAX = PWM_HALF;  // 1500 (1.5ms)
    
    // Joystick droit - contrôle de 1ms à 2ms
    const RIGHT_MIN = PWM_MIN;  // 1000 (1ms)
    const RIGHT_MAX = PWM_MAX;  // 2000 (2ms)

    testApiButton.addEventListener('click', testApiConnection);
    document.getElementById('testSerial').addEventListener('click', testSerialConnection);
    
    // Événement pour le slider LED
    ledSlider.addEventListener('input', function() {
        ledBrightness = parseInt(this.value);
        ledValueSpan.textContent = ledBrightness;
        
        // Mettre à jour le statut LED
        updateLedStatus();
        
        // Envoyer la commande LED (avec limitation de fréquence)
        const now = Date.now();
        if (now - lastLedCommandTime > commandThrottle) {
            sendLedCommand(ledBrightness);
            lastLedCommandTime = now;
        }
    });
    
    // Événement pour le changement final du slider (quand on relâche)
    ledSlider.addEventListener('change', function() {
        // Envoyer la commande LED finale
        sendLedCommand(ledBrightness);
    });
    
    // Fonction pour mettre à jour le statut LED
    function updateLedStatus() {
        isLedOn = ledBrightness > 0;
        
        if (isLedOn) {
            ledStatusSpan.textContent = "On";
            ledStatusSpan.className = "on";
        } else {
            ledStatusSpan.textContent = "Off";
            ledStatusSpan.className = "off";
        }
    }
    
    // Fonction pour envoyer la commande LED
    function sendLedCommand(brightness) {
        const ipAddress = ipAddressInput.value.trim();
        if (!ipAddress) return;
        
        const ledApiUrl = `http://${ipAddress}:5000/api/led/control`;
        
        fetch(ledApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ brightness })
        })
        .then(response => response.json())
        .then(data => console.log('LED control:', data))
        .catch(error => console.error('Error controlling LED:', error));
        
        lastLedCommandTime = Date.now();
    }

    // Fonction pour tester la connexion série avec l'ESP32
    async function testSerialConnection() {
        const ipAddress = ipAddressInput.value.trim();
        if (!ipAddress) {
            alert("Veuillez entrer l'adresse IP du Raspberry Pi");
            return;
        }
        
        const serialStatusSpan = document.getElementById('serialStatus');
        serialStatusSpan.textContent = "Test en cours...";
        
        try {
            // Appeler l'API avec le paramètre reconnect=true pour forcer une reconnexion
            const serialApiUrl = `http://${ipAddress}:5000/api/serial/test?reconnect=true`;
            const response = await fetch(serialApiUrl);
            const data = await response.json();
            
            console.log("Serial connection test:", data);
            
            if (data.connected) {
                serialStatusSpan.textContent = `Connecté sur ${data.port}`;
                serialStatusSpan.style.color = "#4CAF50"; // Vert
                
                // Afficher plus de détails dans une alerte
                let message = `Connexion ESP32 réussie sur ${data.port}\n`;
                if (data.test_response) {
                    message += `Réponse: ${data.test_response}\n`;
                }
                alert(message);
            } else {
                serialStatusSpan.textContent = "Non connecté";
                serialStatusSpan.style.color = "#F44336"; // Rouge
                
                // Afficher les ports disponibles
                let message = "Impossible de se connecter à l'ESP32.\n\nPorts disponibles:\n";
                if (data.available_ports && data.available_ports.length > 0) {
                    data.available_ports.forEach(port => {
                        message += `- ${port.device}: ${port.description}\n`;
                    });
                } else {
                    message += "Aucun port série détecté.\n";
                }
                
                message += "\nVérifiez que:\n";
                message += "1. L'ESP32 S3 est bien connecté au Raspberry Pi\n";
                message += "2. Le programme ESP32 est correctement chargé et fonctionne\n";
                message += "3. Les permissions des ports série sont correctes";
                
                alert(message);
            }
        } catch (error) {
            console.error('Error testing serial connection:', error);
            serialStatusSpan.textContent = "Erreur de test";
            serialStatusSpan.style.color = "#F44336"; // Rouge
            alert(`Erreur lors du test de connexion ESP32: ${error}`);
        }
    }

    function updateVideoStream() {
        const ipAddress = ipAddressInput.value.trim();
        videoStream.src = `http://${ipAddress}:8080/?action=stream`;
    }

    async function testApiConnection() {
        const ipAddress = ipAddressInput.value.trim();
        const apiUrl = `http://${ipAddress}:5000/api/test`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            alert(data.message);
        } catch (error) {
            console.error('API Connection Failed:', error);
            alert('API Connection Failed: ' + error);
        }
    }

    async function fetchSystemInfo() {
        const ipAddress = ipAddressInput.value.trim();
        const apiUrl = `http://${ipAddress}:5000/api/system/info`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            cpuTempSpan.textContent = data.cpu_temperature;
            ramUsageSpan.textContent = data.ram_usage;
            systemLoadSpan.textContent = data.load_system;
            diskSpaceSpan.textContent = data.disk_space;

            ramUsageBar.style.width = data.ram_usage + '%';
            systemLoadBar.style.width = data.load_system + '%';
            diskSpaceBar.style.width = data.disk_space + '%';
        } catch (error) {
            console.error('Error fetching system info:', error);
            cpuTempSpan.textContent = 'Error';
            ramUsageSpan.textContent = 'Error';
            systemLoadSpan.textContent = 'Error';
            diskSpaceSpan.textContent = 'Error';

            ramUsageBar.style.width = '0%';
            systemLoadBar.style.width = '0%';
            diskSpaceBar.style.width = '0%';
        }
    }

    async function fetchCameraStatus() {
        const ipAddress = ipAddressInput.value.trim();
        const apiUrl = `http://${ipAddress}:5000/api/camera/status`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            cameraStatusSpan.textContent = data.status === 'OK' ? data.message : data.message;
        } catch (error) {
            console.error('Error fetching camera status:', error);
            cameraStatusSpan.textContent = 'Error';
        }
    }
    
    async function fetchOrientation() {
        const ipAddress = ipAddressInput.value.trim();
        if (!ipAddress) return;
        
        const orientationApiUrl = `http://${ipAddress}:5000/api/orientation`;
        
        try {
            const response = await fetch(orientationApiUrl);
            const data = await response.json();
            
            if (data.status === 'success' || data.status === 'warning') {
                const orientation = data.data;
                
                // Mise à jour des valeurs d'orientation
                document.getElementById('rollValue').textContent = orientation.roll.toFixed(1) + '°';
                document.getElementById('pitchValue').textContent = orientation.pitch.toFixed(1) + '°';
                document.getElementById('yawValue').textContent = orientation.yaw.toFixed(1) + '°';
                
                // Mise à jour des barres de calibration
                const calibration = orientation.calibration;
                
                // Système (0-3)
                const systemPercent = (calibration.system / 3) * 100;
                document.getElementById('systemCalBar').style.width = systemPercent + '%';
                document.getElementById('systemCalValue').textContent = calibration.system + '/3';
                
                // Gyroscope (0-3)
                const gyroPercent = (calibration.gyro / 3) * 100;
                document.getElementById('gyroCalBar').style.width = gyroPercent + '%';
                document.getElementById('gyroCalValue').textContent = calibration.gyro + '/3';
                
                // Accéléromètre (0-3)
                const accelPercent = (calibration.accel / 3) * 100;
                document.getElementById('accelCalBar').style.width = accelPercent + '%';
                document.getElementById('accelCalValue').textContent = calibration.accel + '/3';
                
                // Magnétomètre (0-3)
                const magPercent = (calibration.mag / 3) * 100;
                document.getElementById('magCalBar').style.width = magPercent + '%';
                document.getElementById('magCalValue').textContent = calibration.mag + '/3';
                
                // Mise à jour du cube 3D si disponible
                if (window.updateOrientationCube) {
                    updateOrientationCube(orientation.roll, orientation.pitch, orientation.yaw);
                }
            }
        } catch (error) {
            console.error('Error fetching orientation data:', error);
            // Optionally clear or indicate error on the cube display
            if (window.updateOrientationCube) {
                // Example: Reset cube or show error state
                // updateOrientationCube(0, 0, 0); 
            }
        }
    }

    // --- Three.js Orientation Cube ---
    let scene, camera, renderer, threeCube;

    function initThreeJS() {
        const container = document.getElementById('orientationCube');
        if (!container || typeof THREE === 'undefined') {
            console.error("Three.js container not found or THREE is not defined. Skipping 3D cube initialization.");
            // Fallback or ensure index_esp32.html is the one being viewed
            if (typeof THREE === 'undefined' && window.location.pathname.includes('index_esp32.html')) {
                 alert('Three.js library is not loaded. Please check the script tag in index_esp32.html.');
            }
            return;
        }

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x404040); // Dark grey background for the cube container

        // Camera
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 2.5; // Adjust camera distance from cube

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // Cube Geometry & Material
        const geometry = new THREE.BoxGeometry(1, 1, 1.5); // Example: slightly elongated to represent a submarine shape
        
        // Different colors for each face for better orientation visibility
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 }), // Right face (Red)
            new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 }), // Left face (Green)
            new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.8 }), // Top face (Blue)
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 }), // Bottom face (Yellow)
            new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 }), // Front face (Magenta)
            new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 })  // Back face (Cyan)
        ];
        threeCube = new THREE.Mesh(geometry, materials);
        scene.add(threeCube);

        // Axes Helper (optional, for debugging orientation)
        const axesHelper = new THREE.AxesHelper(2); // Length of axes lines
        scene.add(axesHelper);


        // Initial render
        renderer.render(scene, camera);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (container && renderer && camera) {
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;
                renderer.setSize(newWidth, newHeight);
                camera.aspect = newWidth / newHeight;
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
            }
        });
    }

    // Function to update the 3D orientation cube (Three.js version)
    window.updateOrientationCube = function(roll, pitch, yaw) {
        if (threeCube && renderer && scene && camera) {
            // Convert degrees to radians
            const rollRad = THREE.MathUtils.degToRad(roll);
            const pitchRad = THREE.MathUtils.degToRad(pitch);
            const yawRad = THREE.MathUtils.degToRad(yaw);

            // Apply rotations - Three.js uses YXZ extrinsic, or ZYX intrinsic order for Euler angles by default.
            // This usually corresponds to:
            // yaw around Z axis (world up, if camera looks along -Z)
            // pitch around X axis
            // roll around Y axis
            // Or, if object's local axes:
            // threeCube.rotation.x = pitchRad; // Pitch around object's X
            // threeCube.rotation.y = yawRad;   // Yaw around object's Y
            // threeCube.rotation.z = rollRad;  // Roll around object's Z
            // The exact mapping depends on sensor coordinate system and desired visual output.
            // A common convention for vehicles (NED - North, East, Down):
            // Roll: rotation around vehicle's longitudinal axis (X)
            // Pitch: rotation around vehicle's transverse axis (Y)
            // Yaw: rotation around vehicle's vertical axis (Z)
            // Let's try:
            threeCube.rotation.set(pitchRad, yawRad, rollRad, 'YXZ'); // Common order for aerospace: Yaw, Pitch, Roll

            renderer.render(scene, camera);
        }
    };
    
    // Call initThreeJS after DOM is loaded, specifically for index_esp32.html
    if (document.getElementById('orientationCube') && window.location.pathname.includes('index_esp32.html')) {
        initThreeJS();
    }


    function gamepadConnected(e) {
        console.log("Gamepad connected: " + e.gamepad.id);
        gamepadStatusSpan.textContent = "Gamepad Connected: " + e.gamepad.id;
    }

    function gamepadDisconnected(e) {
        console.log("Gamepad disconnected: " + e.gamepad.id);
        gamepadStatusSpan.textContent = "Gamepad Disconnected";
    }

    window.addEventListener("gamepadconnected", gamepadConnected);
    window.addEventListener("gamepaddisconnected", gamepadDisconnected);

    function updateGamepad() {
        const gamepads = navigator.getGamepads();
        if (gamepads) {
            for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                if (gamepad) {
                    // Bouton A (index 0) pour activer/désactiver les moteurs
                    if (gamepad.buttons[0].pressed) {
                        buttonA.classList.add('active');
                        
                        // Activer les moteurs
                        if (!isMotorActive) {
                            isMotorActive = true;
                            motorStatusSpan.textContent = "Active";
                            motorStatusSpan.className = "active";
                        }
                    } else {
                        buttonA.classList.remove('active');
                        
                        // Arrêter les moteurs quand le bouton A est relâché
                        if (isMotorActive) {
                            isMotorActive = false;
                            motorValues = motorValues.map(() => PWM_MIN);
                            motorStatusSpan.textContent = "Stopped";
                            motorStatusSpan.className = "stopped";
                            
                            // Mettre à jour l'affichage
                            updateMotorDisplay();
                            
                            // Envoyer la commande d'arrêt
                            const now = Date.now();
                            if (now - lastCommandTime > commandThrottle) {
                                sendMotorCommand(motorValues);
                                lastCommandTime = now;
                            }
                        }
                    }
                    
                    // Bouton Y (index 3) pour allumer/éteindre les LED
                    if (gamepad.buttons[3].pressed) {
                        buttonY.classList.add('active');
                        
                        // Toggle LED on/off (une seule fois par pression)
                        if (!buttonY.wasPressed) {
                            buttonY.wasPressed = true;
                            
                            // Si la LED est éteinte, l'allumer à 100%, sinon l'éteindre
                            if (ledBrightness === 0) {
                                ledBrightness = 100;
                            } else {
                                ledBrightness = 0;
                            }
                            
                            // Mettre à jour le slider et l'affichage
                            ledSlider.value = ledBrightness;
                            ledValueSpan.textContent = ledBrightness;
                            updateLedStatus();
                            
                            // Envoyer la commande
                            sendLedCommand(ledBrightness);
                        }
                    } else {
                        buttonY.classList.remove('active');
                        buttonY.wasPressed = false;
                    }
                    
                    if (isMotorActive) {
                        // Gâchette droite (RT, index 7) pour avancer tout droit
                        const rightTrigger = gamepad.buttons[7].value; // Valeur entre 0 et 1
                        
                        // Joystick gauche horizontal (axes[0]) pour faire tourner le sous-marin sur lui-même
                        const leftJoystickX = gamepad.axes[0]; // Valeur entre -1 (gauche) et 1 (droite)
                        
                        // Valeur par défaut: tous les moteurs à l'arrêt
                        motorValues = motorValues.map(() => PWM_MIN);
                        
                        // Si la gâchette droite est pressée, avancer tout droit
                        if (rightTrigger > 0.1) {
                            // Calculer la vitesse en fonction de la pression sur la gâchette
                            const forwardSpeed = PWM_MIN + rightTrigger * (PWM_MAX - PWM_MIN);
                            
                            // Appliquer la même vitesse à tous les moteurs pour avancer tout droit
                            motorValues = motorValues.map(() => Math.round(forwardSpeed));
                            
                            // Calculer le pourcentage de vitesse (0-100%)
                            const speedPercent = Math.round(rightTrigger * 100);
                            motorStatusSpan.textContent = `Avance (${speedPercent}%)`;
                        }
                        // Si le joystick gauche est utilisé, faire tourner le sous-marin sur lui-même
                        else if (Math.abs(leftJoystickX) > 0.1) {
                            // Déterminer le sens de rotation
                            const isRotatingRight = leftJoystickX > 0;
                            
                            // Calculer la vitesse de rotation en fonction de l'inclinaison du joystick
                            const rotationSpeed = PWM_MIN + Math.abs(leftJoystickX) * (PWM_HALF - PWM_MIN);
                            
                            // Configuration des moteurs pour la rotation
                            // Les moteurs sont à 45 degrés vers l'intérieur
                            // Pour tourner à droite: moteurs gauche avancent, moteurs droite reculent
                            // Pour tourner à gauche: moteurs droite avancent, moteurs gauche reculent
                            
                            if (isRotatingRight) {
                                // Tourner à droite
                                // Moteurs 1, 3, 5, 7 (côté gauche) avancent
                                motorValues[0] = Math.round(rotationSpeed); // Moteur 1
                                motorValues[2] = Math.round(rotationSpeed); // Moteur 3
                                motorValues[4] = Math.round(rotationSpeed); // Moteur 5
                                motorValues[6] = Math.round(rotationSpeed); // Moteur 7
                                
                                // Moteurs 2, 4, 6, 8 (côté droit) restent à l'arrêt
                                motorStatusSpan.textContent = `Rotation Droite (${Math.round((Math.abs(leftJoystickX) * 100))}%)`;
                            } else {
                                // Tourner à gauche
                                // Moteurs 2, 4, 6, 8 (côté droit) avancent
                                motorValues[1] = Math.round(rotationSpeed); // Moteur 2
                                motorValues[3] = Math.round(rotationSpeed); // Moteur 4
                                motorValues[5] = Math.round(rotationSpeed); // Moteur 6
                                motorValues[7] = Math.round(rotationSpeed); // Moteur 8
                                
                                // Moteurs 1, 3, 5, 7 (côté gauche) restent à l'arrêt
                                motorStatusSpan.textContent = `Rotation Gauche (${Math.round((Math.abs(leftJoystickX) * 100))}%)`;
                            }
                        } else {
                            // Aucune commande active, tous les moteurs à l'arrêt
                            motorStatusSpan.textContent = "En attente";
                        }
                        
                        // Mettre à jour l'affichage
                        updateMotorDisplay();
                        
                        // Envoyer la commande (avec limitation de fréquence)
                        const now = Date.now();
                        if (now - lastCommandTime > commandThrottle) {
                            sendMotorCommand(motorValues);
                            lastCommandTime = now;
                        }
                    }
                    
                    // Bouton B pour le mode "boost" (100% de vitesse)
                    if (gamepad.buttons[1].pressed) {
                        buttonB.classList.add('active');
                        
                        // Activer le mode boost seulement si les moteurs sont déjà actifs
                        if (isMotorActive) {
                            // Définir les moteurs à la vitesse maximale (2000 = 2ms)
                            motorValues = motorValues.map(() => PWM_MAX);
                            
                            // Mettre à jour l'affichage
                            updateMotorDisplay();
                            
                            // Afficher le statut boost
                            motorStatusSpan.textContent = "BOOST (100%)";
                            motorStatusSpan.className = "boost";
                            
                            // Envoyer la commande immédiatement
                            sendMotorCommand(motorValues);
                        }
                    } else {
                        buttonB.classList.remove('active');
                    }
                    
                    // Bouton X pour jouer la musique de Bob l'éponge
                    if (gamepad.buttons[2].pressed) {
                        buttonX.classList.add('active');
                        
                        // Jouer la musique de Bob l'éponge si elle n'est pas déjà en cours
                        if (!isMusicPlaying && isMotorActive) {
                            isMusicPlaying = true;
                            
                            // Afficher le statut musique
                            motorStatusSpan.textContent = "SpongeBob Music Mode!";
                            motorStatusSpan.className = "music";
                            
                            // Jouer la musique avec la vitesse du moteur affectant la hauteur
                            playSpongeBobTheme(motorValues[0], (frequency, duration, noteIndex) => {
                                // Calculer une valeur PWM basée sur la note
                                // Mapper les notes sur la plage PWM (1000-2000)
                                const notePwm = 1000 + (noteIndex / (SPONGEBOB_MELODY.length - 1)) * 1000;
                                
                                // Appliquer cette valeur aux moteurs
                                motorValues = motorValues.map(() => Math.round(notePwm));
                                
                                // Mettre à jour l'affichage
                                updateMotorDisplay();
                                
                                // Envoyer la commande aux moteurs
                                sendMotorCommand(motorValues);
                                
                                // Afficher la note en cours
                                const notePercent = Math.round(((notePwm - PWM_MIN) / (PWM_MAX - PWM_MIN)) * 100);
                                motorStatusSpan.textContent = `SpongeBob Note ${noteIndex+1}/${SPONGEBOB_MELODY.length} (${notePercent}%)`;
                                
                                // Programmer la fin de la musique
                                clearTimeout(musicTimeout);
                                musicTimeout = setTimeout(() => {
                                    isMusicPlaying = false;
                                    // Revenir au contrôle normal après la fin de la musique
                                    if (isMotorActive) {
                                        motorStatusSpan.textContent = "Active";
                                        motorStatusSpan.className = "active";
                                    }
                                }, duration + 100);
                            });
                        }
                    } else {
                        buttonX.classList.remove('active');
                    }
                }
            }
        }
    }
    
    // Fonction pour mettre à jour l'affichage des valeurs des moteurs
    function updateMotorDisplay() {
        for (let i = 0; i < 8; i++) {
            if (motorValueSpans[i]) {
                motorValueSpans[i].textContent = motorValues[i];
            }
        }
    }

    // Fonction pour envoyer les commandes aux moteurs
    function sendMotorCommand(values) {
        const ipAddress = ipAddressInput.value.trim();
        if (!ipAddress) return;
        
        const motorApiUrl = `http://${ipAddress}:5000/api/motors/control`;
        
        // Créer l'objet de données pour les 8 moteurs
        const motorData = {};
        for (let i = 0; i < 8; i++) {
            motorData[`m${i+1}`] = values[i];
        }
        
        fetch(motorApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(motorData)
        })
        .then(response => response.json())
        .then(data => console.log('Motor control:', data))
        .catch(error => console.error('Error controlling motors:', error));
    }

    // Fonction pour vérifier le statut de la connexion ESP32
    async function checkSerialStatus() {
        const ipAddress = ipAddressInput.value.trim();
        if (!ipAddress) return;
        
        const serialStatusSpan = document.getElementById('serialStatus');
        const serialApiUrl = `http://${ipAddress}:5000/api/serial/test`;
        
        try {
            const response = await fetch(serialApiUrl);
            const data = await response.json();
            
            if (data.connected) {
                serialStatusSpan.textContent = `Connecté sur ${data.port}`;
                serialStatusSpan.style.color = "#4CAF50"; // Vert
            } else {
                serialStatusSpan.textContent = "Non connecté";
                serialStatusSpan.style.color = "#F44336"; // Rouge
            }
        } catch (error) {
            console.error('Error checking serial status:', error);
            serialStatusSpan.textContent = "Erreur";
            serialStatusSpan.style.color = "#F44336"; // Rouge
        }
    }

    // Fetch system info and other status updates periodically
    setInterval(fetchSystemInfo, 5000);
    setInterval(updateVideoStream, 5000);
    setInterval(fetchCameraStatus, 5000);
    setInterval(checkSerialStatus, 10000); // Vérifier la connexion ESP32 toutes les 10 secondes
    setInterval(fetchOrientation, 200); // Mise à jour plus fréquente pour l'orientation
    setInterval(updateGamepad, 50);
});
