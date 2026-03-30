import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { saveSession } from '../services/keystrokeService';
import SessionHistory from '../components/SessionHistory';
import './EditorPage.css';

// How many events to batch before sending to server
const FLUSH_INTERVAL_MS = 5000;
const BATCH_SIZE = 50;

export default function EditorPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [sessionStats, setSessionStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  // Keystroke tracking refs (no state — avoids re-renders)
  const sessionId = useRef(uuidv4());
  const pendingEvents = useRef([]);  // events buffered locally
  const keyDownTimes = useRef({});   // { [eventCode]: timestamp }
  const lastKeyUpTime = useRef(null);
  const flushTimer = useRef(null);

  const textareaRef = useRef(null);

  // ── Flush pending events to the server ─────────────────────
  const flushEvents = useCallback(async () => {
    if (pendingEvents.current.length === 0) return;

    const batch = [...pendingEvents.current];
    pendingEvents.current = [];

    setSaveStatus('saving');
    try {
      const res = await saveSession(token, sessionId.current, batch);
      setSessionStats(res.data);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      // Return events back to queue so they aren't lost
      pendingEvents.current = [...batch, ...pendingEvents.current];
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [token]);

  // ── Set up periodic flush ───────────────────────────────────
  useEffect(() => {
    flushTimer.current = setInterval(flushEvents, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(flushTimer.current);
      flushEvents(); // flush on unmount
    };
  }, [flushEvents]);

  // ── Keystroke handlers ──────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    // Track by event code so Shift/Alt etc. are distinct
    if (!keyDownTimes.current[e.code]) {
      keyDownTimes.current[e.code] = performance.now();
    }
  }, []);

  const handleKeyUp = useCallback((e) => {
    const downTime = keyDownTimes.current[e.code];
    if (downTime === undefined) return;

    const upTime = performance.now();
    const pressDuration = Math.round(upTime - downTime);

    let interKeyInterval = null;
    if (lastKeyUpTime.current !== null) {
      interKeyInterval = Math.round(downTime - lastKeyUpTime.current);
      // Clamp negative IKI (can happen with overlapping keypresses)
      if (interKeyInterval < 0) interKeyInterval = 0;
    }

    // IMPORTANT: We only store timing — never the key character/code
    pendingEvents.current.push({ pressDuration, interKeyInterval });

    delete keyDownTimes.current[e.code];
    lastKeyUpTime.current = upTime;

    // Flush early if batch is full
    if (pendingEvents.current.length >= BATCH_SIZE) {
      flushEvents();
    }
  }, [flushEvents]);

  // ── Word/char count ─────────────────────────────────────────
  const handleTextChange = useCallback((e) => {
    const text = e.target.value;
    setCharCount(text.length);
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setWordCount(words);
  }, []);

  const handleLogout = () => {
    flushEvents().finally(() => {
      logout();
      navigate('/');
    });
  };

  const saveStatusLabel = {
    idle:   null,
    saving: { text: '● Saving…',   cls: 'saving' },
    saved:  { text: '✓ Data saved', cls: 'saved' },
    error:  { text: '✕ Save error', cls: 'error' },
  }[saveStatus];

  return (
    <div className="editor-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="editor-header">
        <div className="header-left">
          <span className="logo-icon">📝</span>
          <span className="logo-text">vi-notes</span>
        </div>

        <div className="header-center">
          {saveStatusLabel && (
            <span className={`save-status ${saveStatusLabel.cls}`}>
              {saveStatusLabel.text}
            </span>
          )}
        </div>

        <nav className="header-right">
          <button
            id="history-btn"
            className="header-btn"
            onClick={() => setShowHistory((v) => !v)}
            title="Session history"
          >
            {showHistory ? '✕ Close' : '📊 History'}
          </button>
          <span className="user-email">{user?.email}</span>
          <button id="logout-btn" className="header-btn logout" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="editor-main">
        {showHistory ? (
          <SessionHistory token={token} onClose={() => setShowHistory(false)} />
        ) : (
          <>
            {/* ── Session stats strip ───────────────────────── */}
            {sessionStats && (
              <div className="stats-strip">
                <StatPill label="Keystrokes" value={sessionStats.totalKeystrokes} />
                <StatPill
                  label="Avg press duration"
                  value={`${sessionStats.averagePressDuration} ms`}
                />
                {sessionStats.averageInterKeyInterval !== null && (
                  <StatPill
                    label="Avg inter-key interval"
                    value={`${sessionStats.averageInterKeyInterval} ms`}
                  />
                )}
              </div>
            )}

            {/* ── Editor ───────────────────────────────────── */}
            <div className="editor-wrapper">
              <textarea
                id="main-editor"
                ref={textareaRef}
                className="editor-textarea"
                placeholder="Start writing…"
                spellCheck="true"
                autoFocus
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onChange={handleTextChange}
                aria-label="Main writing area"
              />
            </div>

            {/* ── Footer bar ───────────────────────────────── */}
            <div className="editor-footer">
              <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
              <span className="footer-sep">·</span>
              <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
              <span className="footer-sep">·</span>
              <span className="session-label">Session: {sessionId.current.slice(0, 8)}…</span>
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
