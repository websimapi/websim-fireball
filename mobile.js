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
            <div id="mic-status">Initializing...</div>
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
}

function updateMicStatus(text) {
    document.getElementById('mic-status').textContent = text;
}

function onCommand(command) {
    const currentSpell = SPELLS[currentPage];
    if (command.toLowerCase() === currentSpell.name.toLowerCase()) {
        if (desktopPeerId) {
            updateMicStatus(`Casting ${currentSpell.name}!`);
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
        updateMicStatus(`Heard "${command}", but current spell is ${currentSpell.name}.`);
    }
}

function findMyDesktopPeer() {
    const myUsername = roomInstance.peers[roomInstance.clientId].username;
    const peers = Object.values(roomInstance.peers);
    const myPresence = Object.values(roomInstance.presence);
    
    const desktopPeer = myPresence.find(p => 
        p.device === 'desktop' && 
        p.online &&
        roomInstance.peers[p.clientId]?.username === myUsername
    );

    if (desktopPeer) {
        desktopPeerId = desktopPeer.clientId;
        updateMicStatus('Desktop connected. Say the spell name to cast!');
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
        await voiceCommander.start();
    } catch (error) {
        console.error("Voice recognition failed to start:", error);
        updateMicStatus("Microphone permission denied or not supported.");
    }
}

