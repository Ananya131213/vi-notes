// In dev, Vite proxies /api → http://localhost:5000 (see vite.config.js)
// In production, set VITE_API_URL to your deployed backend URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default API_BASE;
