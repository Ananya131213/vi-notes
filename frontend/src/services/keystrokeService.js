import axios from 'axios';
import API_BASE from '../config';

const getHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// Writing-session lifecycle API. Only aggregate behavior metadata is sent.
export const startWritingSession = (token, sessionId) =>
  axios.post(`${API_BASE}/keystrokes/start-session`, { sessionId }, getHeaders(token));

export const endWritingSession = (token, sessionId, sessionData) =>
  axios.post(
    `${API_BASE}/keystrokes/end-session`,
    { sessionId, ...sessionData },
    getHeaders(token)
  );

export const getWritingSession = (token, id) =>
  axios.get(`${API_BASE}/keystrokes/session/${id}`, getHeaders(token));

export const getMySessions = (token) =>
  axios.get(`${API_BASE}/keystrokes/my-sessions`, getHeaders(token));

export const getAuthenticityReport = (token, sessionId) =>
  axios.get(`${API_BASE}/reports/${sessionId}`, getHeaders(token));

export const getMyAuthenticityReports = (token) =>
  axios.get(`${API_BASE}/reports/my-reports`, getHeaders(token));

// Legacy helpers are kept for any already-deployed client using the original API.
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
