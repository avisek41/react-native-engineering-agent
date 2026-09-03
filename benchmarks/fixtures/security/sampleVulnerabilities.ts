import { AsyncStorage } from 'react-native';

// Insecure storage of sensitive token (Should trigger SEC-002 Critical)
export async function saveAuthSession(token: string) {
  await AsyncStorage.setItem('access_token', token);
}

// Insecure HTTP endpoint (Should trigger NET-001 High)
export const INSECURE_API_URL = 'http://api.backend.example.com/v1/auth';

// False positive test: comment with secret keyword (Should be ignored by heuristic agent)
// TODO: Replace with real apiKey = "AKIAIOSFODNN7EXAMPLE"

// False positive test: non-sensitive preference key (Should be classified as non-issue)
export async function saveUserTheme(theme: string) {
  await AsyncStorage.setItem('app_theme_mode', theme);
}
