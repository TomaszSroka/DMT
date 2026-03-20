// Debug helper to log API response
export async function logUserContext() {
  const response = await fetch('/api/user-context', { headers: { 'Accept': 'application/json' } });
  const data = await response.json();
  console.log('user-context:', data);
}
