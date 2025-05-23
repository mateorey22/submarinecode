// SpongeBob SquarePants Theme Song Notes
// Simplified version for motor control

// Notes frequencies (Hz)
const NOTE_C4 = 261.63;
const NOTE_D4 = 293.66;
const NOTE_E4 = 329.63;
const NOTE_F4 = 349.23;
const NOTE_G4 = 392.00;
const NOTE_A4 = 440.00;
const NOTE_B4 = 493.88;
const NOTE_C5 = 523.25;
const NOTE_D5 = 587.33;
const NOTE_E5 = 659.25;
const NOTE_F5 = 698.46;
const NOTE_G5 = 783.99;

// SpongeBob theme song notes (simplified)
const SPONGEBOB_MELODY = [
    { note: NOTE_C5, duration: 250 },
    { note: NOTE_D5, duration: 250 },
    { note: NOTE_E5, duration: 250 },
    { note: NOTE_F5, duration: 250 },
    { note: NOTE_G5, duration: 500 },
    { note: NOTE_E5, duration: 500 },
    { note: NOTE_C5, duration: 500 },
    { note: NOTE_G4, duration: 500 },
    { note: NOTE_E4, duration: 500 },
    { note: NOTE_C4, duration: 500 },
    { note: NOTE_D4, duration: 250 },
    { note: NOTE_E4, duration: 250 },
    { note: NOTE_F4, duration: 250 },
    { note: NOTE_G4, duration: 250 },
    { note: NOTE_A4, duration: 500 },
    { note: NOTE_G4, duration: 500 },
    { note: NOTE_F4, duration: 500 },
    { note: NOTE_E4, duration: 500 },
    { note: NOTE_D4, duration: 500 },
    { note: NOTE_C4, duration: 1000 }
];

// Audio context for playing sounds
let audioContext = null;

// Initialize audio context
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Play a single note
function playNote(frequency, duration) {
    const context = initAudio();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.type = 'square'; // Square wave for a more "8-bit" sound
    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Start the note
    oscillator.start();
    
    // Fade out at the end
    gainNode.gain.setValueAtTime(0.5, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000);
    
    // Stop the note after duration
    oscillator.stop(context.currentTime + duration / 1000);
    
    return { oscillator, duration };
}

// Map a PWM value (1000-2000) to a frequency multiplier (0.5-2.0)
function mapPwmToFrequency(pwmValue) {
    // Convert PWM range (1000-2000) to frequency multiplier (0.5-2.0)
    return 0.5 + ((pwmValue - 1000) / 1000) * 1.5;
}

// Play the SpongeBob theme song with motor speed affecting pitch
function playSpongeBobTheme(motorSpeed, onNoteCallback) {
    const context = initAudio();
    let currentTime = context.currentTime;
    let noteIndex = 0;
    
    // Calculate frequency multiplier based on motor speed
    const freqMultiplier = mapPwmToFrequency(motorSpeed);
    
    // Play each note in sequence
    function playNextNote() {
        if (noteIndex < SPONGEBOB_MELODY.length) {
            const { note, duration } = SPONGEBOB_MELODY[noteIndex];
            
            // Adjust frequency based on motor speed
            const adjustedFreq = note * freqMultiplier;
            
            // Play the note
            playNote(adjustedFreq, duration);
            
            // Call the callback with the current note info
            if (onNoteCallback) {
                onNoteCallback(adjustedFreq, duration, noteIndex);
            }
            
            // Schedule the next note
            noteIndex++;
            setTimeout(playNextNote, duration);
        }
    }
    
    // Start playing
    playNextNote();
}
