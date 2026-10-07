import { useEffect, useState } from 'react';
import { getMySessions } from '../services/keystrokeService';
import './SessionHistory.css';

const formatDuration = (duration) => {
  const totalSeconds = Math.round((duration || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

export default function SessionHistory({ token, onClose, onOpenDashboard }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMySessions(token)
      .then((response) => setSessions(response.data))
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
        <h2>Session History</h2>
        <div className="history-actions">
          <button className="dashboard-link" onClick={onOpenDashboard}>Dashboard</button>
          <button id="close-history-btn" className="close-btn" onClick={onClose}>Close</button>
        </div>
      </div>

      <p className="history-note">
        History loads timing and paste metadata only. Saved writing content is not included in this list.
      </p>

      {loading && <div className="history-loading">Loading sessions...</div>}
      {error && <div className="history-error">{error}</div>}

      {!loading && !error && sessions.length === 0 && (
        <div className="history-empty">No sessions yet. Start writing!</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="sessions-list">
          {sessions.map((session) => {
            const analytics = session.analytics || {};
            return (
              <div className="session-card" key={session._id}>
                <div className="session-card-top">
                  <span className="session-id">{session.sessionId.slice(0, 8)}...</span>
                  <span className="session-date">{formatDate(session.startedAt || session.createdAt)}</span>
                </div>
                <div className="session-card-stats">
                  <SessionStat label="Words" value={session.wordCount ?? 0} />
                  <SessionStat label="Duration" value={formatDuration(session.duration)} />
                  <SessionStat label="Keys" value={analytics.totalKeystrokes ?? session.totalKeystrokes} />
                  <SessionStat label="Pastes" value={session.pasteMetrics?.totalPasteEvents ?? 0} />
                </div>
              </div>
            );
          })}
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
