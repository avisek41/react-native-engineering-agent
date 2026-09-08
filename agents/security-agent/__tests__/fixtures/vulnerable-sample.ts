// Test fixture: Intentionally vulnerable sample file.
// This file contains known security anti-patterns for testing the scanner.
// DO NOT use this code in production.

import AsyncStorage from '@react-native-async-storage/async-storage';

// SEC-001: Hardcoded API key
const API_KEY = 'AKIAIOSFODNN7EXAMPLE';

// SEC-002: Hardcoded password
const dbPassword = 'SuperSecretPassword123!';

// SEC-003: Hardcoded JWT token
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N';

// NET-001: HTTP URL (non-HTTPS)
const apiUrl = 'http://api.example.com/v1/users';

// NET-002: Disabled SSL validation
const httpsAgent = { rejectUnauthorized: false };

// STR-001: AsyncStorage for sensitive data
async function saveToken(token: string) {
  await AsyncStorage.setItem('auth_token', token);
}

// LOG-001: Token logged to console
function debugAuth(token: string) {
  console.log('Current access token:', token);
}

// GEN-001: eval usage
function executeCode(code: string) {
  return eval(code);
}

// GEN-008: Math.random for security
function generateSessionId() {
  return 'session_' + Math.random().toString(36);
}

// AUTH-002: skipAuth bypass
const publicEndpoint = { url: '/data', skipAuth: true };

export { API_KEY, apiUrl, saveToken, debugAuth, executeCode, generateSessionId };
