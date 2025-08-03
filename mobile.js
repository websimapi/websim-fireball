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
            <div id="mic-status">Press and hold the spellbook to speak a spell.</div>
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
            <div id="movement-area">
                <div id="movement-instructions">Touch anywhere here to move</div>
                <div id="virtual-joystick" style="display: none;">
                    <div id="joystick-base"></div>
                    <div id="joystick-knob"></div>
                </div>
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
    document.getElementById('prev-btn').addEventListener('click', () => {
        currentPage = (currentPage - 1 + SPELLS.length) % SPELLS.length;
        updateSpellDisplay();
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        currentPage = (currentPage + 1) % SPELLS.length;
        updateSpellDisplay();
    });

    const spellbook = document.getElementById('spellbook');
    const startListening = (e) => {
        e.preventDefault();
        if (voiceCommander) {
            voiceCommander.start().catch(err => {
                updateMicStatus("Mic permission denied. Check browser settings.");
                console.error("Error starting voice commander:", err);
            });
        }
    };
    const stopListening = (e) => {
        e.preventDefault();
        if (voiceCommander) {
            voiceCommander.stop();
        }
    };

    // For mobile
    spellbook.addEventListener('touchstart', startListening);
    spellbook.addEventListener('touchend', stopListening);
    spellbook.addEventListener('touchcancel', stopListening);

    // For desktop testing
    spellbook.addEventListener('mousedown', startListening);
    spellbook.addEventListener('mouseup', stopListening);
    spellbook.addEventListener('mouseleave', stopListening);

    // Movement controls
    setupMovementControls();
}

function setupMovementControls() {
    const movementArea = document.getElementById('movement-area');
    const virtualJoystick = document.getElementById('virtual-joystick');
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');

    function startMovement(e) {
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const rect = movementArea.getBoundingClientRect();
        
        movementState.isMoving = true;
        movementState.centerX = touch.clientX - rect.left;
        movementState.centerY = touch.clientY - rect.top;
        movementState.currentX = movementState.centerX;
        movementState.currentY = movementState.centerY;

        // Show virtual joystick
        virtualJoystick.style.display = 'block';
        virtualJoystick.style.left = (movementState.centerX - 40) + 'px';
        virtualJoystick.style.top = (movementState.centerY - 40) + 'px';
        
        updateJoystickPosition();
    }

    function updateMovement(e) {
        if (!movementState.isMoving) return;
        e.preventDefault();
        
        const touch = e.touches ? e.touches[0] : e;
        const rect = movementArea.getBoundingClientRect();
        
        movementState.currentX = touch.clientX - rect.left;
        movementState.currentY = touch.clientY - rect.top;
        
        updateJoystickPosition();
        sendMovementData();
    }

    function stopMovement(e) {
        if (!movementState.isMoving) return;
        e.preventDefault();
        
        movementState.isMoving = false;
        virtualJoystick.style.display = 'none';
        
        // Send stop movement
        if (desktopPeerId) {
            roomInstance.send({
                type: 'movement',
                x: 0,
                y: 0
            });
        }
    }

    function updateJoystickPosition() {
        const deltaX = movementState.currentX - movementState.centerX;
        const deltaY = movementState.currentY - movementState.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Constrain knob to joystick radius
        if (distance <= movementState.joystickRadius) {
            joystickKnob.style.left = (40 + deltaX) + 'px';
            joystickKnob.style.top = (40 + deltaY) + 'px';
        } else {
            const angle = Math.atan2(deltaY, deltaX);
            const constrainedX = Math.cos(angle) * movementState.joystickRadius;
            const constrainedY = Math.sin(angle) * movementState.joystickRadius;
            joystickKnob.style.left = (40 + constrainedX) + 'px';
            joystickKnob.style.top = (40 + constrainedY) + 'px';
            
            // Update current position to constrained position
            movementState.currentX = movementState.centerX + constrainedX;
            movementState.currentY = movementState.centerY + constrainedY;
        }
    }

    function sendMovementData() {
        if (!desktopPeerId) return;
        
        const deltaX = movementState.currentX - movementState.centerX;
        const deltaY = movementState.currentY - movementState.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Normalize to -1 to 1 range
        const normalizedX = distance > 0 ? (deltaX / movementState.joystickRadius) : 0;
        const normalizedY = distance > 0 ? (deltaY / movementState.joystickRadius) : 0;
        
        // Clamp values
        const clampedX = Math.max(-1, Math.min(1, normalizedX));
        const clampedY = Math.max(-1, Math.min(1, normalizedY));
        
        roomInstance.send({
            type: 'movement',
            x: clampedX,
            y: -clampedY // Invert Y for game coordinates
        });
    }

    // Touch events
    movementArea.addEventListener('touchstart', startMovement);
    movementArea.addEventListener('touchmove', updateMovement);
    movementArea.addEventListener('touchend', stopMovement);
    movementArea.addEventListener('touchcancel', stopMovement);

    // Mouse events for desktop testing
    movementArea.addEventListener('mousedown', startMovement);
    movementArea.addEventListener('mousemove', updateMovement);
    movementArea.addEventListener('mouseup', stopMovement);
    movementArea.addEventListener('mouseleave', stopMovement);
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
        updateMicStatus('Desktop connected. Hold spellbook and say the spell name to cast!');
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