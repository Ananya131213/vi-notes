import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { endWritingSession, startWritingSession } from '../services/keystrokeService';
import SessionHistory from '../components/SessionHistory';
import './EditorPage.css';

const PAUSE_THRESHOLD_MS = 2000;

const createEmptyAnalytics = () => ({
  totalKeystrokes: 0,
  intervalTotal: 0,
  intervalCount: 0,
  minKeyInterval: null,
  maxKeyInterval: 0,
  backspaceCount: 0,
  pauseCount: 0,
  lastKeyTime: null,
  pasteEvents: [],
});

const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

export default function EditorPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [sessionStats, setSessionStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState('starting');

  const textareaRef = useRef(null);
  const contentRef = useRef('');
  const sessionIdRef = useRef(uuidv4());
  const sessionStartedRef = useRef(false);
  const startingSessionRef = useRef(null);
  const endingSessionRef = useRef(false);
  const analyticsRef = useRef(createEmptyAnalytics());

  const resetAnalytics = () => {
    analyticsRef.current = createEmptyAnalytics();
  };

  // The server treats repeat calls for one UUID as idempotent. This also avoids
  // duplicate sessions while React development mode re-runs effects.
  const startCurrentSession = useCallback(
    async (showStatus = true) => {
      if (sessionStartedRef.current) return true;
      if (startingSessionRef.current) return startingSessionRef.current;

      if (showStatus) setSaveStatus('starting');
      const startRequest = startWritingSession(token, sessionIdRef.current)
        .then(() => {
          sessionStartedRef.current = true;
          if (showStatus) setSaveStatus('idle');
          return true;
        })
        .catch(() => {
          setSaveStatus('error');
          return false;
        })
        .finally(() => {
          startingSessionRef.current = null;
        });

      startingSessionRef.current = startRequest;
      return startRequest;
    },
    [token]
  );

  // A session begins when the editor becomes available.
  useEffect(() => {
    startCurrentSession();
  }, [startCurrentSession]);

  const buildSessionAnalytics = () => {
    const analytics = analyticsRef.current;
    const hasIntervals = analytics.intervalCount > 0;

    return {
      totalKeystrokes: analytics.totalKeystrokes,
      averageKeyInterval: hasIntervals
        ? roundToTwoDecimals(analytics.intervalTotal / analytics.intervalCount)
        : 0,
      minKeyInterval: hasIntervals ? analytics.minKeyInterval : 0,
      maxKeyInterval: hasIntervals ? analytics.maxKeyInterval : 0,
      backspaceCount: analytics.backspaceCount,
      pauseCount: analytics.pauseCount,
    };
  };

  const finishCurrentSession = useCallback(
    async (startNextSession) => {
      if (endingSessionRef.current) return false;
      endingSessionRef.current = true;
      setSaveStatus('saving');

      try {
        const didStart = await startCurrentSession(false);
        if (!didStart) throw new Error('Could not start writing session');

        const response = await endWritingSession(token, sessionIdRef.current, {
          content: contentRef.current,
          analytics: buildSessionAnalytics(),
          // This array includes only a timestamp and character count per paste.
          pasteEvents: analyticsRef.current.pasteEvents,
        });

        setSessionStats(response.data.session);
        setSaveStatus('saved');
        window.setTimeout(() => setSaveStatus('idle'), 2500);

        if (startNextSession) {
          sessionIdRef.current = uuidv4();
          sessionStartedRef.current = false;
          resetAnalytics();
          // Keep tracking seamless if the user continues writing after Save.
          startCurrentSession(false);
        }

        return true;
      } catch {
        setSaveStatus('error');
        return false;
      } finally {
        endingSessionRef.current = false;
      }
    },
    [startCurrentSession, token]
  );

  const handleKeyDown = useCallback((event) => {
    const now = performance.now();
    const analytics = analyticsRef.current;

    if (analytics.lastKeyTime !== null) {
      const interval = Math.max(0, Math.round(now - analytics.lastKeyTime));
      analytics.intervalTotal += interval;
      analytics.intervalCount += 1;
      analytics.minKeyInterval =
        analytics.minKeyInterval === null ? interval : Math.min(analytics.minKeyInterval, interval);
      analytics.maxKeyInterval = Math.max(analytics.maxKeyInterval, interval);
      if (interval > PAUSE_THRESHOLD_MS) analytics.pauseCount += 1;
    }

    analytics.totalKeystrokes += 1;
    // The key name is inspected only in memory to count deletions; it is never sent.
    if (event.key === 'Backspace') analytics.backspaceCount += 1;
    analytics.lastKeyTime = now;
  }, []);

  const handlePaste = useCallback((event) => {
    // Read the clipboard string only long enough to obtain its length.
    const pastedLength = event.clipboardData?.getData('text/plain').length || 0;
    analyticsRef.current.pasteEvents.push({
      timestamp: new Date().toISOString(),
      pastedLength,
    });
  }, []);

  const handleTextChange = useCallback((event) => {
    const text = event.target.value;
    contentRef.current = text;
    setCharCount(text.length);
    setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
  }, []);

  const handleSave = () => finishCurrentSession(true);

  const handleLogout = async () => {
    await finishCurrentSession(false);
    logout();
    navigate('/');
  };

  const saveStatusLabel = {
    idle: null,
    starting: { text: 'Starting session...', cls: 'saving' },
    saving: { text: 'Saving session...', cls: 'saving' },
    saved: { text: 'Session saved', cls: 'saved' },
    error: { text: 'Could not save session', cls: 'error' },
  }[saveStatus];

  return (
    <div className="editor-page">
      <header className="editor-header">
        <div className="header-left">
          <span className="logo-icon">Vi</span>
          <span className="logo-text">vi-notes</span>
        </div>

        <div className="header-center">
          {saveStatusLabel && (
            <span className={`save-status ${saveStatusLabel.cls}`}>{saveStatusLabel.text}</span>
          )}
        </div>

        <nav className="header-right">
          <button className="header-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            Save
          </button>
          <button
            id="history-btn"
            className="header-btn"
            onClick={() => setShowHistory((visible) => !visible)}
            title="Session history"
          >
            {showHistory ? 'Close' : 'History'}
          </button>
          <span className="user-email">{user?.email}</span>
          <button id="logout-btn" className="header-btn logout" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="editor-main">
        {showHistory ? (
          <SessionHistory
            token={token}
            onClose={() => setShowHistory(false)}
            onOpenDashboard={() => navigate('/sessions')}
          />
        ) : (
          <>
            {sessionStats && (
              <div className="stats-strip">
                <StatPill label="Keystrokes" value={sessionStats.analytics.totalKeystrokes} />
                <StatPill
                  label="Avg key interval"
                  value={`${sessionStats.analytics.averageKeyInterval} ms`}
                />
                <StatPill label="Pauses" value={sessionStats.analytics.pauseCount} />
                <StatPill label="Paste events" value={sessionStats.pasteMetrics.totalPasteEvents} />
              </div>
            )}

            <div className="editor-wrapper">
              <textarea
                id="main-editor"
                ref={textareaRef}
                className="editor-textarea"
                placeholder="Start writing..."
                spellCheck="true"
                autoFocus
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onChange={handleTextChange}
                aria-label="Main writing area"
              />
            </div>

            <div className="editor-footer">
              <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
              <span className="footer-sep">|</span>
              <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
              <span className="footer-sep">|</span>
              <span className="session-label">Session: {sessionIdRef.current.slice(0, 8)}...</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="stat-pill">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
