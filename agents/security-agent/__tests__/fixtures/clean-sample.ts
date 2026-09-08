// Test fixture: Clean sample file.
// This file represents properly secured code and should produce zero findings.

import { getGenericPassword, setGenericPassword } from 'react-native-keychain';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const API_BASE = 'https://api.example.com/v1';

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const credentials = await getGenericPassword();
  if (!credentials) {
    throw new Error('No stored credentials');
  }

  const response = await fetch(`${API_BASE}/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${credentials.password}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function storeAuthToken(token: string): Promise<void> {
  await setGenericPassword('auth', token);
}

function formatDisplayName(profile: UserProfile): string {
  return profile.name || 'Anonymous';
}

export { fetchUserProfile, storeAuthToken, formatDisplayName };
export type { UserProfile };
