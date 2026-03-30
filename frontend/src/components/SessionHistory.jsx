import React, { useEffect, useState } from 'react';
import { getSessions } from '../services/keystrokeService';
import './SessionHistory.css';

export default function SessionHistory({ token, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSessions(token)
      .then((res) => setSessions(res.data))
      .catch(() => setError('Could not load sessions'))
      .finally(() => setLoading(false));
  }, [token]);

  const formatDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>📊 Session History</h2>
        <button id="close-history-btn" className="close-btn" onClick={onClose}>✕</button>
      </div>

      <p className="history-note">
        Only <strong>timing metadata</strong> is stored — no text content ever.
      </p>

      {loading && <div className="history-loading">Loading sessions…</div>}
      {error && <div className="history-error">{error}</div>}

      {!loading && !error && sessions.length === 0 && (
        <div className="history-empty">No sessions yet. Start typing!</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="sessions-list">
          {sessions.map((s) => (
            <div className="session-card" key={s._id}>
              <div className="session-card-top">
                <span className="session-id">{s.sessionId.slice(0, 8)}…</span>
                <span className="session-date">{formatDate(s.createdAt)}</span>
              </div>
              <div className="session-card-stats">
                <SessionStat label="Keystrokes" value={s.totalKeystrokes} />
                <SessionStat
                  label="Avg press"
                  value={`${s.averagePressDuration ?? '—'} ms`}
                />
                <SessionStat
                  label="Avg IKI"
                  value={
                    s.averageInterKeyInterval !== null
                      ? `${s.averageInterKeyInterval} ms`
                      : '—'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionStat({ label, value }) {
  return (
    <div className="s-stat">
      <span className="s-stat-value">{value}</span>
      <span className="s-stat-label">{label}</span>
    </div>
  );
}
