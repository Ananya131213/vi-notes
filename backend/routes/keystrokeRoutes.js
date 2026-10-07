const express = require('express');
const mongoose = require('mongoose');
const KeystrokeSession = require('../models/KeystrokeSession');
const AuthenticityReport = require('../models/AuthenticityReport');
const { protect } = require('../middleware/authMiddleware');
const { generateAuthenticityReport } = require('../services/authenticityScoringService');

const router = express.Router();

// All writing-session routes require an authenticated user.
router.use(protect);

const isNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

const countWords = (content) => {
  const trimmedContent = content.trim();
  return trimmedContent ? trimmedContent.split(/\s+/).length : 0;
};

const validateSessionId = (sessionId) =>
  typeof sessionId === 'string' && sessionId.trim().length > 0 && sessionId.length <= 100;

const buildAnalytics = (analytics) => {
  const fields = [
    'totalKeystrokes',
    'averageKeyInterval',
    'minKeyInterval',
    'maxKeyInterval',
    'backspaceCount',
    'pauseCount',
  ];

  if (!analytics || fields.some((field) => !isNonNegativeNumber(analytics[field]))) {
    return null;
  }

  if (
    !Number.isInteger(analytics.totalKeystrokes) ||
    !Number.isInteger(analytics.backspaceCount) ||
    !Number.isInteger(analytics.pauseCount) ||
    analytics.backspaceCount > analytics.totalKeystrokes ||
    analytics.pauseCount > analytics.totalKeystrokes ||
    analytics.minKeyInterval > analytics.maxKeyInterval
  ) {
    return null;
  }

  return {
    totalKeystrokes: analytics.totalKeystrokes,
    averageKeyInterval: roundToTwoDecimals(analytics.averageKeyInterval),
    minKeyInterval: roundToTwoDecimals(analytics.minKeyInterval),
    maxKeyInterval: roundToTwoDecimals(analytics.maxKeyInterval),
    backspaceCount: analytics.backspaceCount,
    pauseCount: analytics.pauseCount,
  };
};

const buildPasteEvents = (pasteEvents) => {
  if (!Array.isArray(pasteEvents) || pasteEvents.length > 1000) return null;

  const sanitizedEvents = [];
  for (const pasteEvent of pasteEvents) {
    const timestamp = new Date(pasteEvent.timestamp);
    if (
      Number.isNaN(timestamp.getTime()) ||
      !Number.isInteger(pasteEvent.pastedLength) ||
      pasteEvent.pastedLength < 0
    ) {
      return null;
    }

    sanitizedEvents.push({ timestamp, pastedLength: pasteEvent.pastedLength });
  }

  return sanitizedEvents;
};

// POST /api/keystrokes/start-session
// Repeated calls with the same client UUID return the existing session.
router.post('/start-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!validateSessionId(sessionId)) {
    return res.status(400).json({ message: 'A valid sessionId is required' });
  }

  try {
    let session = await KeystrokeSession.findOne({ userId: req.user._id, sessionId });
    if (session) {
      return res.status(200).json({ sessionId: session.sessionId, id: session._id, startedAt: session.startedAt });
    }

    session = await KeystrokeSession.create({ userId: req.user._id, sessionId, startedAt: new Date() });
    return res.status(201).json({ sessionId: session.sessionId, id: session._id, startedAt: session.startedAt });
  } catch (err) {
    return res.status(500).json({ message: 'Could not start writing session' });
  }
});

// POST /api/keystrokes/end-session
// Finalizes document content and metadata. Key values are never accepted or saved.
router.post('/end-session', async (req, res) => {
  const { sessionId, content, analytics, pasteEvents } = req.body;
  if (!validateSessionId(sessionId) || typeof content !== 'string') {
    return res.status(400).json({ message: 'A valid sessionId and text content are required' });
  }

  const sanitizedAnalytics = buildAnalytics(analytics);
  const sanitizedPasteEvents = buildPasteEvents(pasteEvents);
  if (!sanitizedAnalytics || !sanitizedPasteEvents) {
    return res.status(400).json({ message: 'Session analytics or paste metadata is invalid' });
  }

  try {
    const session = await KeystrokeSession.findOne({ userId: req.user._id, sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found. Start a session before saving.' });
    }

    const endedAt = new Date();
    session.content = content;
    session.endedAt = endedAt;
    session.duration = Math.max(0, endedAt.getTime() - session.startedAt.getTime());
    session.wordCount = countWords(content);
    session.analytics = sanitizedAnalytics;
    session.pasteEvents = sanitizedPasteEvents;
    session.pasteMetrics = {
      totalPasteEvents: sanitizedPasteEvents.length,
      totalPastedCharacters: sanitizedPasteEvents.reduce(
        (total, pasteEvent) => total + pasteEvent.pastedLength,
        0
      ),
    };
    await session.save();

    // Reports are regenerated on every completed save so they always reflect
    // the currently stored session data without collecting any new behavior.
    const reportData = generateAuthenticityReport(session);
    const report = await AuthenticityReport.findOneAndUpdate(
      { userId: req.user._id, sessionId: session._id },
      { $set: { ...reportData, userId: req.user._id, sessionId: session._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ message: 'Writing session saved', session, reportId: report._id });
  } catch (err) {
    return res.status(500).json({ message: 'Could not save writing session' });
  }
});

// GET /api/keystrokes/session/:id
// Accepts either the MongoDB document id or the client session UUID.
router.get('/session/:id', async (req, res) => {
  const sessionQuery = { userId: req.user._id, $or: [{ sessionId: req.params.id }] };
  if (mongoose.isValidObjectId(req.params.id)) {
    sessionQuery.$or.push({ _id: req.params.id });
  }

  try {
    const session = await KeystrokeSession.findOne(sessionQuery);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load writing session' });
  }
});

// GET /api/keystrokes/my-sessions
// List metadata only; content is returned only by the single-session route.
router.get('/my-sessions', async (req, res) => {
  try {
    const sessions = await KeystrokeSession.find(
      { userId: req.user._id },
      'sessionId startedAt endedAt duration wordCount analytics pasteMetrics createdAt updatedAt totalKeystrokes averagePressDuration averageInterKeyInterval'
    ).sort({ startedAt: -1 });
    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load writing sessions' });
  }
});

// Legacy API: retain batched timing support for existing clients.
router.post('/session', async (req, res) => {
  const { sessionId, events } = req.body;
  if (!validateSessionId(sessionId) || !Array.isArray(events)) {
    return res.status(400).json({ message: 'sessionId and events array are required' });
  }

  for (const event of events) {
    if (!isNonNegativeNumber(event.pressDuration)) {
      return res.status(400).json({ message: 'Invalid event: pressDuration must be non-negative' });
    }
    if (event.interKeyInterval !== null && !isNonNegativeNumber(event.interKeyInterval)) {
      return res.status(400).json({ message: 'Invalid event: interKeyInterval must be non-negative' });
    }
  }

  try {
    let session = await KeystrokeSession.findOne({ userId: req.user._id, sessionId });
    if (session) {
      session.events.push(...events.map(({ pressDuration, interKeyInterval = null }) => ({ pressDuration, interKeyInterval })));
    } else {
      session = new KeystrokeSession({ userId: req.user._id, sessionId, events });
    }
    await session.save();

    return res.json({
      message: 'Session saved',
      totalKeystrokes: session.totalKeystrokes,
      averagePressDuration: session.averagePressDuration,
      averageInterKeyInterval: session.averageInterKeyInterval,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Could not save timing data' });
  }
});

// Legacy session-list endpoint retained for existing clients.
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await KeystrokeSession.find(
      { userId: req.user._id },
      'sessionId totalKeystrokes averagePressDuration averageInterKeyInterval createdAt updatedAt'
    ).sort({ createdAt: -1 });
    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load sessions' });
  }
});

// Legacy UUID route retained for existing clients.
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await KeystrokeSession.findOne({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load session' });
  }
});

module.exports = router;
