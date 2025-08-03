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
}

function updateMicStatus(text) {
    document.getElementById('mic-status').textContent = text;
}

function onCommand(command) {
    // Always show what was heard on mobile.
    updateMicStatus(`Heard: "${command}"`);

    // Send the recognized text to the desktop client for debugging.
    if (desktopPeerId) {
        roomInstance.send({
            type: 'spokenText',
            text: command,
            recipient: desktopPeerId
        });
    }

    const currentSpell = SPELLS[currentPage];
    if (command.toLowerCase() === currentSpell.name.toLowerCase()) {
        if (desktopPeerId) {
            // Update status after a short delay so user can see "Heard:..."
            setTimeout(() => updateMicStatus(`Casting ${currentSpell.name}!`), 500);
            roomInstance.send({
                type: 'castSpell',
                spell: currentSpell.name,
                // Only send to our desktop client
                recipient: desktopPeerId
            });
        } else {
            updateMicStatus('Desktop not connected. Cannot cast spell.');
        }
    } else {
        // No need for another status update, "Heard:..." is enough.
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
        updateMicStatus('Desktop connected. Hold spellbook and say the spell name to cast!');
    } else {
        desktopPeerId = null;
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
            onError: (err) => updateMicStatus(`Mic Error: ${err}`)
        });
        // Do not start automatically anymore. It's triggered by touch.
    } catch (error) {
        console.error("Voice recognition failed to initialize:", error);
        updateMicStatus("Speech recognition not supported by this browser.");
    }
}