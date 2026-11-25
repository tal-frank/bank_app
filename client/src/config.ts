// Frontend settings, read once from Vite's import.meta.env (values come from client/.env).
// Fail loudly at startup instead of sending requests to "undefined/auth/login".
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error('VITE_API_URL is not set: copy client/.env.example to client/.env');
}

export const config = { apiUrl } as const;
