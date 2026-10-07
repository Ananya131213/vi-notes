import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMySessions, getWritingSession } from '../services/keystrokeService';
import './SessionHistoryPage.css';

const formatDuration = (duration) => {
  const totalSeconds = Math.round((duration || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const formatDate = (date) => {
  if (!date) return 'Not saved';
  return new Date(date).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

// Older Phase 1 records can use legacy fields, so the dashboard remains useful
// while new records use the nested analytics object.
const getAnalytics = (session) => ({
  totalKeystrokes: session.analytics?.totalKeystrokes ?? session.totalKeystrokes ?? 0,
  averageKeyInterval: session.analytics?.averageKeyInterval ?? session.averageInterKeyInterval ?? 0,
  minKeyInterval: session.analytics?.minKeyInterval ?? 0,
  maxKeyInterval: session.analytics?.maxKeyInterval ?? 0,
  backspaceCount: session.analytics?.backspaceCount ?? 0,
  pauseCount: session.analytics?.pauseCount ?? 0,
});

export default function SessionHistoryPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMySessions(token);
      setSessions(response.data);
    } catch {
      setError('Could not load your writing sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const dashboardStats = useMemo(() => {
    const totalWords = sessions.reduce((total, session) => total + (session.wordCount || 0), 0);
    const totalDuration = sessions.reduce((total, session) => total + (session.duration || 0), 0);
    const sessionCount = sessions.length;

    return {
      sessionCount,
      totalWords,
      totalDuration,
      averageWords: sessionCount ? Math.round(totalWords / sessionCount) : 0,
      averageDuration: sessionCount ? Math.round(totalDuration / sessionCount) : 0,
    };
  }, [sessions]);

  const handleSelectSession = async (sessionId) => {
    setDetailLoading(true);
    setDetailError('');
    setSelectedSession(null);

    try {
      // The API receives the authenticated token and returns only the owner's session.
      const response = await getWritingSession(token, sessionId);
      setSelectedSession(response.data);
    } catch (requestError) {
      const message = requestError.response?.data?.message;
      setDetailError(message || 'Could not load this session. Please try again.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <main className="session-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">Vi-Notes</p>
          <h1>Writing Session History</h1>
          <p>Review saved writing sessions and the behavior metadata captured with them.</p>
        </div>
        <div className="dashboard-actions">
          <span className="dashboard-email">{user?.email}</span>
          <button className="dashboard-button secondary" onClick={() => navigate('/editor')}>Editor</button>
          <button className="dashboard-button logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-summary" aria-label="Session summary">
        <SummaryCard label="Total sessions" value={dashboardStats.sessionCount} />
        <SummaryCard label="Words written" value={dashboardStats.totalWords} />
        <SummaryCard label="Writing time" value={formatDuration(dashboardStats.totalDuration)} />
        <SummaryCard label="Avg. words/session" value={dashboardStats.averageWords} />
        <SummaryCard label="Avg. duration" value={formatDuration(dashboardStats.averageDuration)} />
      </section>

      <section className="dashboard-content">
        <div className="sessions-column">
          <div className="section-heading">
            <div>
              <h2>Your sessions</h2>
              <p>Newest sessions appear first.</p>
            </div>
            <button className="refresh-button" onClick={loadSessions} disabled={loading}>Refresh</button>
          </div>

          {loading && <div className="dashboard-state">Loading sessions...</div>}
          {error && (
            <div className="dashboard-state error">
              <p>{error}</p>
              <button className="dashboard-button secondary" onClick={loadSessions}>Try again</button>
            </div>
          )}
          {!loading && !error && sessions.length === 0 && (
            <div className="dashboard-state">
              <h3>No saved sessions yet</h3>
              <p>Write in the editor and select Save to add your first session.</p>
              <button className="dashboard-button" onClick={() => navigate('/editor')}>Open editor</button>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div className="dashboard-session-list">
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onClick={() => handleSelectSession(session._id)}
                  onOpenReport={() => navigate(`/sessions/${session._id}/report`)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="session-detail-panel" aria-live="polite">
          {detailLoading && <div className="dashboard-state">Loading session details...</div>}
          {detailError && <div className="dashboard-state error">{detailError}</div>}
          {!detailLoading && !detailError && !selectedSession && (
            <div className="detail-placeholder">Select a session to inspect its details and saved content.</div>
          )}
          {selectedSession && (
            <SessionDetail
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
              onOpenReport={() => navigate(`/sessions/${selectedSession._id}/report`)}
            />
          )}
        </aside>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SessionCard({ session, onClick, onOpenReport }) {
  const analytics = getAnalytics(session);
  return (
    <article className="dashboard-session-card">
      <button className="session-card-select" onClick={onClick}>
        <div className="card-heading">
          <span>{formatDate(session.startedAt || session.createdAt)}</span>
          <span>{formatDuration(session.duration)}</span>
        </div>
        <div className="session-card-metrics">
          <Metric label="Words" value={session.wordCount || 0} />
          <Metric label="Keys" value={analytics.totalKeystrokes} />
          <Metric label="Backspaces" value={analytics.backspaceCount} />
          <Metric label="Pauses" value={analytics.pauseCount} />
          <Metric label="Pastes" value={session.pasteMetrics?.totalPasteEvents || 0} />
        </div>
      </button>
      <button className="report-card-button" onClick={onOpenReport}>View report</button>
    </article>
  );
}

function SessionDetail({ session, onClose, onOpenReport }) {
  const analytics = getAnalytics(session);
  const pasteMetrics = session.pasteMetrics || {};

  return (
    <div className="session-detail">
      <div className="detail-heading">
        <div>
          <p className="dashboard-kicker">Selected session</p>
          <h2>Session details</h2>
        </div>
        <button className="close-detail" onClick={onClose} aria-label="Close session details">Close</button>
      </div>

      <button className="report-detail-button" onClick={onOpenReport}>Open authenticity report</button>

      <DetailSection title="Session information">
        <Metric label="Started" value={formatDate(session.startedAt)} />
        <Metric label="Ended" value={formatDate(session.endedAt)} />
        <Metric label="Duration" value={formatDuration(session.duration)} />
        <Metric label="Word count" value={session.wordCount || 0} />
      </DetailSection>

      <DetailSection title="Typing analytics">
        <Metric label="Total keystrokes" value={analytics.totalKeystrokes} />
        <Metric label="Average key interval" value={`${analytics.averageKeyInterval} ms`} />
        <Metric label="Minimum key interval" value={`${analytics.minKeyInterval} ms`} />
        <Metric label="Maximum key interval" value={`${analytics.maxKeyInterval} ms`} />
        <Metric label="Backspace count" value={analytics.backspaceCount} />
        <Metric label="Pause count" value={analytics.pauseCount} />
      </DetailSection>

      <DetailSection title="Paste analytics">
        <Metric label="Total paste events" value={pasteMetrics.totalPasteEvents || 0} />
        <Metric label="Total pasted characters" value={pasteMetrics.totalPastedCharacters || 0} />
      </DetailSection>

      <section className="detail-section">
        <h3>Writing content</h3>
        <div className="saved-content">{session.content || 'This session has no saved content.'}</div>
      </section>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      <div className="detail-metrics">{children}</div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
