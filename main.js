import { initDesktop } from './desktop.js';
import { initMobile } from './mobile.js';

const room = new WebsimSocket();

function isMobile() {
    // A simple check for mobile devices.
    return /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

async function main() {
    await room.initialize();
    
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.remove();
    }

    const deviceType = isMobile() ? 'mobile' : 'desktop';

    // Announce presence with device type
    room.updatePresence({ device: deviceType, online: true });
    
    window.addEventListener('beforeunload', () => {
        room.updatePresence({ online: false });
    });

    if (deviceType === 'desktop') {
        initDesktop(room);
    } else {
        initMobile(room);
    }
}

main();

