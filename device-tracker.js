// device-tracker.js

function getDeviceTrackerConfig() {
    return {
        apiKey: "AIzaSyCKA0k_9UgoJX_RBgEsIeNdiW2w0Okko1o",
        authDomain: "festie-s1u2h3.firebaseapp.com",
        projectId: "festie-s1u2h3",
        storageBucket: "festie-s1u2h3.firebasestorage.app",
        messagingSenderId: "794049194885",
        appId: "1:794049194885:web:8f75f0df4c15cde15eb2ec",
        measurementId: "G-P2TS8F6LLJ"
    };
}

// 1. Setup Firebase if not already initialized
function ensureFirebaseInitialized() {
    if (typeof firebase === 'undefined') {
        if (!window._firebaseLoading) {
            window._firebaseLoading = true;
            console.warn("Firebase not found. Injecting Firebase scripts dynamically...");
            const appScript = document.createElement('script');
            appScript.src = "https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js";
            appScript.onload = () => {
                const fsScript = document.createElement('script');
                fsScript.src = "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore-compat.js";
                fsScript.onload = () => {
                    firebase.initializeApp(getDeviceTrackerConfig());
                    initTracker();
                };
                document.head.appendChild(fsScript);
            };
            document.head.appendChild(appScript);
        }
        return false;
    }
    
    if (!firebase.apps.length) {
        firebase.initializeApp(getDeviceTrackerConfig());
    }
    return true;
}

// 2. ID Generation
function getDeviceId() {
    let deviceId = localStorage.getItem("festivalDeviceId");
    if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("festivalDeviceId", deviceId);
    }
    return deviceId;
}

// 3. Environment Detection
function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "Tablet";
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return "Mobile";
    }
    return "Desktop";
}

function detectOS() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Windows") !== -1) return "Windows";
    if (ua.indexOf("Mac") !== -1) return "macOS";
    if (ua.indexOf("Linux") !== -1) return "Linux";
    if (ua.indexOf("Android") !== -1) return "Android";
    if (ua.indexOf("like Mac") !== -1) return "iOS";
    return "Unknown";
}

function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) return "Edge";
    if (ua.indexOf("OPR") > -1 || ua.indexOf("Opera") > -1) return "Opera";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    return "Other";
}

// 4. Heartbeat logic
function sendHeartbeat() {
    const db = firebase.firestore();
    const deviceId = getDeviceId();
    const docRef = db.collection('connectedDevices').doc(deviceId);
    
    const updateData = {
        deviceId: deviceId,
        deviceType: detectDeviceType(),
        os: detectOS(),
        browser: detectBrowser(),
        currentPage: window.location.pathname,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (window._festDeviceCheckedOnce) {
        docRef.set(updateData, { merge: true }).catch(e => console.warn('Heartbeat error', e));
    } else {
        docRef.get().then(doc => {
            window._festDeviceCheckedOnce = true;
            if (!doc.exists) {
                updateData.firstSeen = firebase.firestore.FieldValue.serverTimestamp();
            }
            docRef.set(updateData, { merge: true });
        }).catch(e => {
            console.warn('Initial heartbeat error', e);
            docRef.set(updateData, { merge: true });
        });
    }
}

function initTracker() {
    if (!ensureFirebaseInitialized()) return;
    
    sendHeartbeat();
    setInterval(sendHeartbeat, 30000);

    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        setTimeout(sendHeartbeat, 50);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        setTimeout(sendHeartbeat, 50);
    };

    window.addEventListener('popstate', () => {
        setTimeout(sendHeartbeat, 50);
    });
}

// Expose helpers globally
window.getDeviceId = getDeviceId;
window.detectDeviceType = detectDeviceType;
window.detectOS = detectOS;
window.detectBrowser = detectBrowser;
window.sendHeartbeat = sendHeartbeat;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracker);
} else {
    initTracker();
}
