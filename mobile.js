import { VoiceCommander } from './voice.js';

const SPELLS = [
    { name: 'Fireball', icon: 'fireball.png' },
    { name: '---', icon: '' },
    { name: '---', icon: '' },
];

let currentPage = 0;
let roomInstance = null;
let desktopPeerId = null;
let voiceCommander;
let movementState = {
    isMoving: false,
    startEvent: null, // To differentiate between touch for movement and touch for spell casting
    moveTimeout: null,
    centerX: 0,
    centerY: 0,
    currentX: 0,
    currentY: 0,
    joystickRadius: 80
};

function renderMobileUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div id="mobile-ui">
            <div id="mic-status">Hold to speak, tap to move.</div>
            <div id="spellbook">
                <div id="spell-display">
                    <img id="spell-icon" src="" alt="Spell Icon">
                    <h1 id="spell-name"></h1>
                </div>
                <div id="spell-pages">
                    <button id="prev-btn" class="page-btn">Prev</button>
                    <button id="next-btn" class="page-btn">Next</button>
                </div>
            </div>
            <div id="virtual-joystick" style="display: none;">
                <div id="joystick-base"></div>
                <div id="joystick-knob"></div>
            </div>
        </div>
    `;
    updateSpellDisplay();
}

function updateSpellDisplay() {
    const spell = SPELLS[currentPage];
    document.getElementById('spell-name').textContent = spell.name;
    const iconEl = document.getElementById('spell-icon');
    iconEl.src = spell.icon;
    iconEl.style.display = spell.icon ? 'block' : 'none';
}

function setupEventListeners() {
    document.getElementById('prev-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent spellbook listener from firing
        currentPage = (currentPage - 1 + SPELLS.length) % SPELLS.length;
        updateSpellDisplay();
    });

    document.getElementById('next-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent spellbook listener from firing
        currentPage = (currentPage + 1) % SPELLS.length;
        updateSpellDisplay();
    });

    const spellbook = document.getElementById('spellbook');
    setupSpellAndMoveControls(spellbook);
}

function setupSpellAndMoveControls(element) {
    const virtualJoystick = document.getElementById('virtual-joystick');
    const joystickKnob = document.getElementById('joystick-knob');
    const joystickBase = document.getElementById('joystick-base');

    function sendMovementData() {
        if (!desktopPeerId || !movementState.isMoving) return;
    
        const deltaX = movementState.currentX - movementState.centerX;
        const deltaY = movementState.currentY - movementState.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
        if (distance === 0) {
            roomInstance.send({ type: 'movement', x: 0, y: 0 });
            return;
        }
    
        // Normalize the vector
        const maxDistance = movementState.joystickRadius;
        let normalizedX = deltaX / maxDistance;
        let normalizedY = deltaY / maxDistance;
        
        // Clamp to a circle with radius 1
        const magnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
        if (magnitude > 1) {
            normalizedX /= magnitude;
            normalizedY /= magnitude;
        }
    
        roomInstance.send({
            type: 'movement',
            x: normalizedX,
            y: normalizedY, // Remove inversion to fix forward/backward movement
        });
    }

    const startListener = (e) => {
        // Prevent default actions like text selection or page scrolling
        e.preventDefault();
        // Ignore multi-touch
        if (e.touches && e.touches.length > 1) return;

        movementState.startEvent = e;
        
        // Start voice recognition immediately on touch
        if (voiceCommander) {
            voiceCommander.start().catch(err => {
                updateMicStatus("Mic permission denied. Check browser settings.");
                console.error("Error starting voice commander:", err);
            });
        }
    };

    const moveListener = (e) => {
        if (!movementState.startEvent) return;
        e.preventDefault();

        // If we move, start the movement logic.
        if (!movementState.isMoving) {
            // This is the first movement after the initial touch.
            movementState.isMoving = true;
            const startTouch = movementState.startEvent.touches ? movementState.startEvent.touches[0] : movementState.startEvent;
            const rect = element.getBoundingClientRect();
            
            movementState.centerX = startTouch.clientX - rect.left;
            movementState.centerY = startTouch.clientY - rect.top;
            
            // Show virtual joystick
            virtualJoystick.style.display = 'block';
            virtualJoystick.style.left = (movementState.centerX - 40) + 'px';
            virtualJoystick.style.top = (movementState.centerY - 40) + 'px';
        }
        
        const touch = e.touches ? e.touches[0] : e;
        const rect = element.getBoundingClientRect();
        movementState.currentX = touch.clientX - rect.left;
        movementState.currentY = touch.clientY - rect.top;
        
        updateJoystickPosition();
        sendMovementData();
    };

    const endListener = (e) => {
        e.preventDefault();

        // Always stop listening on touch end.
        if (voiceCommander) {
            voiceCommander.stop();
        }

        if (movementState.isMoving) {
            // If we were moving, stop movement.
            movementState.isMoving = false;
            virtualJoystick.style.display = 'none';
            if (desktopPeerId) {
                roomInstance.send({ type: 'movement', x: 0, y: 0 });
            }
        }
        
        movementState.startEvent = null;
    };

    function updateJoystickPosition() {
        const deltaX = movementState.currentX - movementState.centerX;
        const deltaY = movementState.currentY - movementState.centerY;
        const distance = Math.min(movementState.joystickRadius, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
        const angle = Math.atan2(deltaY, deltaX);

        const knobX = Math.cos(angle) * distance;
        const knobY = Math.sin(angle) * distance;
        
        joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    // Touch events
    element.addEventListener('touchstart', startListener);
    element.addEventListener('touchmove', moveListener);
    element.addEventListener('touchend', endListener);
    element.addEventListener('touchcancel', endListener);

    // Mouse events for desktop testing
    element.addEventListener('mousedown', startListener);
    element.addEventListener('mousemove', moveListener);
    element.addEventListener('mouseup', endListener);
    element.addEventListener('mouseleave', endListener);
}

function setupMovementControls() {
   // This function is now obsolete as its logic is merged into setupSpellAndMoveControls.
   // We are keeping it empty to prevent errors if it's called somewhere else, but it should be removed in the future.
}

function updateMicStatus(text) {
    document.getElementById('mic-status').textContent = text;
}

function onCommand(command) {
    // Always show what was heard on mobile.
    updateMicStatus(`Heard: "${command}"`);

    // Send the recognized text to the desktop client immediately
    if (desktopPeerId) {
        roomInstance.send({
            type: 'spokenText',
            text: command,
        });
    }

    const currentSpell = SPELLS[currentPage];
    if (command.toLowerCase().includes(currentSpell.name.toLowerCase())) { // Use includes for partial matches
        if (desktopPeerId) {
            // Update status immediately without delay
            updateMicStatus(`Casting ${currentSpell.name}!`);
            roomInstance.send({
                type: 'castSpell',
                spell: currentSpell.name,
            });
        } else {
            updateMicStatus('Desktop not connected. Cannot cast spell.');
        }
    }
}

function findMyDesktopPeer() {
    if (!roomInstance.peers[roomInstance.clientId]) return; // Not ready yet
    const myUsername = roomInstance.peers[roomInstance.clientId].username;
    
    const desktopPeerEntry = Object.entries(roomInstance.presence).find(([clientId, presence]) => 
        presence.device === 'desktop' && 
        presence.online &&
        roomInstance.peers[clientId]?.username === myUsername
    );

    if (desktopPeerEntry) {
        desktopPeerId = desktopPeerEntry[0]; // This is the clientId
        console.log('Mobile: Found desktop peer with ID:', desktopPeerId);
        updateMicStatus('Desktop connected. Hold to cast, drag to move.');
    } else {
        desktopPeerId = null;
        console.log('Mobile: No desktop peer found');
        updateMicStatus('Waiting for desktop to connect...');
    }
}

export async function initMobile(room) {
    roomInstance = room;
    renderMobileUI();
    setupEventListeners();

    findMyDesktopPeer();
    room.subscribePresence(findMyDesktopPeer);

    try {
        voiceCommander = new VoiceCommander({
            onCommand,
            onStatus: updateMicStatus,
            onError: (err) => updateMicStatus(`Mic Error: ${err}`),
            onStart: () => {
                // Send speaking status to desktop
                if (desktopPeerId) {
                    roomInstance.send({
                        type: 'speakingStatus',
                        speaking: true,
                    });
                }
            },
            onStop: () => {
                // Send speaking status to desktop
                if (desktopPeerId) {
                    roomInstance.send({
                        type: 'speakingStatus',
                        speaking: false,
                    });
                }
            }
        });
        // Do not start automatically anymore. It's triggered by touch.
    } catch (error) {
        console.error("Voice recognition failed to initialize:", error);
        updateMicStatus("Speech recognition not supported by this browser.");
    }
}