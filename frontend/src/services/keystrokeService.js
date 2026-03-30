import axios from 'axios';
import API_BASE from '../config';

const getHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const saveSession = (token, sessionId, events) =>
  axios.post(
    `${API_BASE}/keystrokes/session`,
    { sessionId, events },
    getHeaders(token)
  );

export const getSessions = (token) =>
  axios.get(`${API_BASE}/keystrokes/sessions`, getHeaders(token));

export const getSession = (token, sessionId) =>
  axios.get(`${API_BASE}/keystrokes/sessions/${sessionId}`, getHeaders(token));
