const mongoose = require('mongoose');

const deductionSchema = new mongoose.Schema(
  {
    rule: { type: String, required: true },
    points: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const metricsSchema = new mongoose.Schema(
  {
    wordCount: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    totalKeystrokes: { type: Number, default: 0, min: 0 },
    backspaceCount: { type: Number, default: 0, min: 0 },
    pauseCount: { type: Number, default: 0, min: 0 },
    totalPasteEvents: { type: Number, default: 0, min: 0 },
    totalPastedCharacters: { type: Number, default: 0, min: 0 },
    wordsPerMinute: { type: Number, default: 0, min: 0 },
    keystrokesPerWord: { type: Number, default: 0, min: 0 },
    deductions: { type: [deductionSchema], default: [] },
  },
  { _id: false }
);

const authenticityReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // This references the MongoDB writing-session document, not key data.
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KeystrokeSession',
      required: true,
    },
    authenticityScore: { type: Number, required: true, min: 0, max: 100 },
    riskLevel: {
      type: String,
      required: true,
      enum: ['Very High Confidence', 'High Confidence', 'Moderate Confidence', 'Low Confidence', 'Needs Review'],
    },
    generatedAt: { type: Date, default: Date.now },
    findings: { type: [String], default: [] },
    metrics: { type: metricsSchema, required: true },
    // A readable explanation of the visible rule-based score breakdown.
    behaviorSummary: { type: String, required: true },
    scoringVersion: { type: String, default: 'rules-v1' },
  },
  { timestamps: true }
);

// One updatable report per user/session pair.
authenticityReportSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('AuthenticityReport', authenticityReportSchema);
