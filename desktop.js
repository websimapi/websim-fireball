import * as THREE from 'three';

let scene, camera, renderer, playerMarker;
let mobilePeerId = null;
let roomInstance = null;
let fireballs = [];
let lastSpokenText = '';

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
    const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    playerMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    playerMarker.position.y = 0.05;
    scene.add(playerMarker);

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
    } else {
        mobilePeerId = null;
    }
    showInfo();
}

function castFireball() {
    const fireballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const fireballMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xff6347,
        emissiveIntensity: 2
    });
    const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
    
    fireball.position.copy(playerMarker.position).y += 1.5;
    
    const light = new THREE.PointLight(0xff4500, 5, 10);
    fireball.add(light);
    
    fireball.userData.velocity = new THREE.Vector3(0, 0, -20); // Shoots forward
    fireball.userData.lifetime = 5; // 5 seconds
    
    fireballs.push(fireball);
    scene.add(fireball);
}

export function initDesktop(room) {
    roomInstance = room;
    setupScene();
    animate();

    findMyMobilePeer();
    room.subscribePresence(findMyMobilePeer);

    room.onmessage = (event) => {
        const { data, fromClientId } = event;
        if (fromClientId !== mobilePeerId) return;
        
        if (data.type === 'castSpell') {
            if (data.spell === 'Fireball') {
                castFireball();
            }
        } else if (data.type === 'spokenText') {
            lastSpokenText = data.text;
            showInfo();
        }
    };
}