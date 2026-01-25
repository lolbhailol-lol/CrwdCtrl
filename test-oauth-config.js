// OAuth Configuration Test Script
// Run this in browser console to test authentication setup

console.log('🧪 Testing OAuth Configuration...');

// Test 1: Check Firebase configuration
console.log('1️⃣ Firebase Configuration:');
try {
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    };
    
    console.log('✅ Firebase config loaded:', {
        hasApiKey: !!firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId
    });
} catch (error) {
    console.error('❌ Firebase config error:', error);
}

// Test 2: Check popup capability
console.log('2️⃣ Popup Capability Test:');
try {
    const testPopup = window.open('', '_blank', 'width=1,height=1');
    if (testPopup) {
        testPopup.close();
        console.log('✅ Popup authentication available');
    } else {
        console.log('⚠️ Popup blocked - will use redirect authentication');
    }
} catch (error) {
    console.log('⚠️ Popup blocked by security policy - will use redirect authentication');
}

// Test 3: Check mobile detection
console.log('3️⃣ Device Detection:');
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 window.innerWidth <= 768;
console.log(isMobile ? '📱 Mobile device detected' : '🖥️ Desktop device detected');

// Test 4: Check CORS headers
console.log('4️⃣ CORS Headers Test:');
fetch(window.location.origin, { method: 'HEAD' })
    .then(response => {
        console.log('✅ CORS headers:', {
            'Cross-Origin-Opener-Policy': response.headers.get('Cross-Origin-Opener-Policy'),
            'Cross-Origin-Embedder-Policy': response.headers.get('Cross-Origin-Embedder-Policy'),
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin')
        });
    })
    .catch(error => {
        console.error('❌ CORS test failed:', error);
    });

// Test 5: Check API connectivity
console.log('5️⃣ API Connectivity Test:');
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crwdctrl-730576782394.asia-south2.run.app/api';
fetch(`${apiUrl}/health`)
    .then(response => response.json())
    .then(data => {
        console.log('✅ API connection successful:', data);
    })
    .catch(error => {
        console.error('❌ API connection failed:', error);
    });

console.log('🏁 OAuth configuration test completed. Check results above.');