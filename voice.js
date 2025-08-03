export class VoiceCommander {
    constructor({ onCommand, onStatus, onError }) {
        this.onCommand = onCommand;
        this.onStatus = onStatus;
        this.onError = onError;
        this.manualStop = false;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error("Speech Recognition not supported by this browser.");
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true; // Enable interim results for faster detection
        this.recognition.lang = 'en-US';
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.recognition.onresult = (event) => {
            // Process both interim and final results for faster detection
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const command = result[0].transcript.trim();
                
                // Send command immediately if confidence is high or if it's a final result
                if (result.isFinal || result[0].confidence > 0.8) {
                    this.onCommand(command);
                    break; // Process only the first high-confidence result
                }
            }
        };

        this.recognition.onspeechend = () => {
            // Restart immediately when speech ends for continuous listening
            if (!this.manualStop) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.warn("Could not restart recognition:", e.message);
                    }
                }, 100); // Minimal delay for restart
            }
        };
        
        this.recognition.onend = () => {
            // Only restart if we haven't manually stopped and didn't already restart in onspeechend
            if (!this.manualStop) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.warn("Could not restart recognition:", e.message);
                    }
                }, 50); // Very short delay
            } else {
                this.onStatus("Listening stopped.");
            }
        };

        this.recognition.onstart = () => {
            this.onStatus("Listening...");
        };

        this.recognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                // Ignore these common errors, as 'onend' will handle restart.
            } else {
                this.onError(event.error);
            }
        };
    }

    async start() {
        this.manualStop = false;
        // Request microphone permission implicitly by starting
        try {
            this.recognition.start();
        } catch (error) {
            if (error.name !== 'InvalidStateError') { // Ignore if already started
                this.onError("Could not start. May be already started or permission denied.");
                throw error;
            }
        }
    }

    stop() {
        this.manualStop = true;
        this.recognition.stop();
    }
}