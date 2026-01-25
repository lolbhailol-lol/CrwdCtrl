// Backend Connection Test Script
// Run this in browser console to test backend connectivity

console.log('🧪 Testing Backend Connection...');

const API_BASE_URL = 'https://crwdctrl-730576782394.asia-south2.run.app/api';

// Test 1: Health Check
console.log('1️⃣ Testing Health Check...');
fetch(`${API_BASE_URL}/health`)
    .then(response => {
        console.log('✅ Health check response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('✅ Health check data:', data);
    })
    .catch(error => {
        console.error('❌ Health check failed:', error);
    });

// Test 2: CORS Test
console.log('2️⃣ Testing CORS...');
fetch(`${API_BASE_URL}/cors-test`)
    .then(response => {
        console.log('✅ CORS test response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('✅ CORS test data:', data);
    })
    .catch(error => {
        console.error('❌ CORS test failed:', error);
    });

// Test 3: Social Auth Endpoint Test (POST with sample data)
console.log('3️⃣ Testing Social Auth Endpoint...');
const testSocialAuthData = {
    name: 'Test User',
    email: 'test@example.com',
    provider: 'google',
    providerId: 'test123',
    isVerified: true
};

fetch(`${API_BASE_URL}/users/social-auth`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testSocialAuthData)
})
    .then(response => {
        console.log('📊 Social auth test response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('📊 Social auth test data:', data);
    })
    .catch(error => {
        console.error('❌ Social auth test failed:', error);
    });

// Test 4: Check Environment Variables
console.log('4️⃣ Checking Environment Variables...');
console.log('API Base URL:', API_BASE_URL);
console.log('Current Origin:', window.location.origin);
console.log('User Agent:', navigator.userAgent);

console.log('🏁 Backend connection tests initiated. Check results above.');