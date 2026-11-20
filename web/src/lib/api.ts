// Resilient API Fetch Helper: Calls Next.js proxy route, falls back to direct port 8000 on network failure
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, options);
  } catch {
    return fetch(`http://localhost:8000${path}`, options);
  }
}
