import * as THREE from 'three';

let scene, camera, renderer, player;
let mobilePeerId = null;
let roomInstance = null;
let fireballs = [];
let lastSpokenText = '';

const spellCooldowns = {
    Fireball: {
        duration: 3000, // 3 seconds
        lastCast: 0,
        timer: null,
        ui: null
    }
};

function setupCooldownUI() {
    const container = document.getElementById('cooldown-container');
    container.innerHTML = ''; // Clear previous

    const spell = spellCooldowns.Fireball;

    const cooldownEl = document.createElement('div');
    cooldownEl.id = 'fireball-cooldown';
    cooldownEl.className = 'cooldown-spell';

    const img = document.createElement('img');
    img.src = '/fireball.png';
    cooldownEl.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'cooldown-overlay';
    cooldownEl.appendChild(overlay);
    
    container.appendChild(cooldownEl);
    spell.ui = {
        element: cooldownEl,
        overlay: overlay
    };
    updateCooldownVisual('Fireball');
}

function setupScene() {
    const app = document.getElementById('app');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    app.appendChild(renderer.domElement);

    // Info display
    let infoEl = document.createElement('div');
    infoEl.id = 'desktop-info';
    document.getElementById('app').appendChild(infoEl);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x556b2f });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Player Marker
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.y = 1; // Capsule height is 2 (1 radius + 1 height), so pivot is at center. Y=1 puts bottom on ground.
    player.castShadow = true;
    player.rotation.y = Math.PI; // Face the camera
    scene.add(player);

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = 0.016; // simple fixed timestep
    fireballs.forEach((fireball, index) => {
        fireball.position.addScaledVector(fireball.userData.velocity, delta);
        fireball.userData.lifetime -= delta;
        if (fireball.userData.lifetime <= 0) {
            scene.remove(fireball);
            fireballs.splice(index, 1);
        }
    });

    renderer.render(scene, camera);
}

function updateCooldownVisual(spellName) {
    const spell = spellCooldowns[spellName];
    if (!spell || !spell.ui) return;

    const now = Date.now();
    const timeSinceCast = now - spell.lastCast;
    const cooldownRemaining = spell.duration - timeSinceCast;

    if (cooldownRemaining <= 0) {
        spell.ui.element.classList.add('ready');
        spell.ui.overlay.style.transform = 'scaleY(0)';
        if (spell.timer) {
            clearInterval(spell.timer);
            spell.timer = null;
        }
    } else {
        spell.ui.element.classList.remove('ready');
        const progress = cooldownRemaining / spell.duration;
        spell.ui.overlay.style.transform = `scaleY(${progress})`;

        if (!spell.timer) {
            spell.timer = setInterval(() => updateCooldownVisual(spellName), 100);
        }
    }
}

function showInfo() {
    let infoEl = document.getElementById('desktop-info');
    if (!infoEl) return;

    const connectionStatus = mobilePeerId ? 'Mobile device connected.' : 'Waiting for mobile device to connect...';
    const spokenTextDisplay = lastSpokenText ? `\nLast heard: "${lastSpokenText}"` : '';
    
    infoEl.innerText = connectionStatus + spokenTextDisplay;
}

function findMyMobilePeer() {
    if (!roomInstance.peers[roomInstance.clientId]) return; // Not ready yet
    const myUsername = roomInstance.peers[roomInstance.clientId].username;
    
    const mobilePeerEntry = Object.entries(roomInstance.presence).find(([clientId, presence]) => 
        presence.device === 'mobile' && 
        presence.online &&
        roomInstance.peers[clientId]?.username === myUsername
    );

    if (mobilePeerEntry) {
        mobilePeerId = mobilePeerEntry[0]; // This is the clientId
        console.log('Desktop: Found mobile peer with ID:', mobilePeerId);
    } else {
        mobilePeerId = null;
        console.log('Desktop: No mobile peer found');
    }
    showInfo();
}

function castFireball() {
    const spell = spellCooldowns.Fireball;
    const now = Date.now();
    if (now - spell.lastCast < spell.duration) {
        console.log("Fireball is on cooldown.");
        return; // Spell on cooldown
    }
    spell.lastCast = now;
    updateCooldownVisual('Fireball');

    const fireballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const fireballMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xff6347,
        emissiveIntensity: 2
    });
    const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
    
    // Get player's forward direction
    const forward = new THREE.Vector3();
    player.getWorldDirection(forward);

    // Position fireball in front of player
    fireball.position.copy(player.position).add(forward.clone().multiplyScalar(1));
    
    const light = new THREE.PointLight(0xff4500, 5, 10);
    fireball.add(light);
    
    fireball.userData.velocity = forward.multiplyScalar(20); // Shoots in player's facing direction
    fireball.userData.lifetime = 5; // 5 seconds
    
    fireballs.push(fireball);
    scene.add(fireball);
}

export function initDesktop(room) {
    roomInstance = room;
    setupScene();
    setupCooldownUI();
    animate();

    findMyMobilePeer();
    room.subscribePresence(findMyMobilePeer);

    room.onmessage = (event) => {
        const { data, fromClientId } = event;
        console.log('Desktop: Received message:', data, 'from:', fromClientId, 'expected mobile peer:', mobilePeerId);
        
        // Temporarily less restrictive filtering for debugging
        if (data.type === 'castSpell') {
            console.log('Desktop: Processing castSpell message for:', data.spell);
            if (data.spell === 'Fireball') {
                console.log('Desktop: Calling castFireball()');
                castFireball();
            }
        } else if (data.type === 'spokenText') {
            lastSpokenText = data.text;
            showInfo();
        }
    };
}