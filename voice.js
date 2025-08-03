export class VoiceCommander {
    constructor({ onCommand, onStatus, onError }) {
        this.onCommand = onCommand;
        this.onStatus = onStatus;
        this.onError = onError;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error("Speech Recognition not supported by this browser.");
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.trim();
            this.onCommand(command);
        };

        this.recognition.onspeechend = () => {
            // It will restart in onend
        };
        
        this.recognition.onend = () => {
            // The service sometimes stops. Restart it to keep listening.
            try {
                this.recognition.start();
            } catch (e) {
                // This can happen if the page is closed or loses focus sometimes.
                console.warn("Could not restart recognition:", e.message);
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
        // Request microphone permission implicitly by starting
        try {
            this.recognition.start();
        } catch (error) {
            this.onError("Could not start. May be already started or permission denied.");
            throw error;
        }
    }

    stop() {
        this.recognition.stop();
    }
}

