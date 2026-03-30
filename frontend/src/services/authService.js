import axios from 'axios';
import API_BASE from '../config';

const authApi = axios.create({ baseURL: `${API_BASE}/auth` });

export const register = (email, password) =>
  authApi.post('/register', { email, password });

export const login = (email, password) =>
  authApi.post('/login', { email, password });
