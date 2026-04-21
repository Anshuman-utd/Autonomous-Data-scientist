// Central API base URL — reads from Vite env var at build time.
// Falls back to localhost for local development.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;
