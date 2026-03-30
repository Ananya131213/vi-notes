const express = require('express');
const KeystrokeSession = require('../models/KeystrokeSession');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/keystrokes/session
// Save (or append to) a keystroke session
router.post('/session', async (req, res) => {
  const { sessionId, events } = req.body;

  if (!sessionId || !Array.isArray(events)) {
    return res.status(400).json({ message: 'sessionId and events array are required' });
  }

  // Validate events: must only contain numeric timing fields
  for (const e of events) {
    if (typeof e.pressDuration !== 'number' || e.pressDuration < 0) {
      return res.status(400).json({ message: 'Invalid event: pressDuration must be a non-negative number' });
    }
    // Strip any accidental character data — never store key identity
    delete e.key;
    delete e.code;
    delete e.char;
  }

  try {
    let session = await KeystrokeSession.findOne({ userId: req.user._id, sessionId });

    if (session) {
      session.events.push(...events);
    } else {
      session = new KeystrokeSession({
        userId: req.user._id,
        sessionId,
        events,
      });
    }

    await session.save();

    res.status(200).json({
      message: 'Session saved',
      totalKeystrokes: session.totalKeystrokes,
      averagePressDuration: session.averagePressDuration,
      averageInterKeyInterval: session.averageInterKeyInterval,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/keystrokes/sessions
// Get all session summaries for the logged-in user
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await KeystrokeSession.find(
      { userId: req.user._id },
      'sessionId totalKeystrokes averagePressDuration averageInterKeyInterval createdAt updatedAt'
    ).sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/keystrokes/sessions/:sessionId
// Get a specific session's full data
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await KeystrokeSession.findOne({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
