import { fetchJson } from './ApiClient.js';

export async function fetchUserManagers() {
  const payload = await fetchJson('/api/user-managers');
  return Array.isArray(payload && payload.users) ? payload.users : [];
}