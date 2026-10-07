const express = require('express');
const mongoose = require('mongoose');
const AuthenticityReport = require('../models/AuthenticityReport');
const KeystrokeSession = require('../models/KeystrokeSession');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Resolve a session under the current user's id first. This prevents a report
// URL from revealing whether another user's session or report exists.
const findOwnedSession = async (userId, requestedId) => {
  const query = { userId, $or: [{ sessionId: requestedId }] };
  if (mongoose.isValidObjectId(requestedId)) query.$or.push({ _id: requestedId });
  return KeystrokeSession.findOne(query);
};

// GET /api/reports/my-reports
// Returns report summaries for the current user only.
router.get('/my-reports', async (req, res) => {
  try {
    const reports = await AuthenticityReport.find(
      { userId: req.user._id },
      'sessionId authenticityScore riskLevel generatedAt metrics.wordCount metrics.duration metrics.deductions scoringVersion'
    ).sort({ generatedAt: -1 });
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load authenticity reports' });
  }
});

// GET /api/reports/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await findOwnedSession(req.user._id, req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const report = await AuthenticityReport.findOne({
      userId: req.user._id,
      sessionId: session._id,
    });
    if (!report) {
      return res.status(404).json({ message: 'No authenticity report has been generated for this session' });
    }

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ message: 'Could not load authenticity report' });
  }
});

module.exports = router;
