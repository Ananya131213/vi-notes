const mongoose = require('mongoose');

// Kept for compatibility with sessions created by the earlier batching API.
// Key identity is intentionally never stored.
const keystrokeEventSchema = new mongoose.Schema(
  {
    pressDuration: { type: Number, required: true, min: 0 },
    interKeyInterval: { type: Number, default: null },
  },
  { _id: false }
);

// A paste record contains metadata only. The pasted text itself is never recorded here.
const pasteEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    pastedLength: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const analyticsSchema = new mongoose.Schema(
  {
    totalKeystrokes: { type: Number, default: 0, min: 0 },
    averageKeyInterval: { type: Number, default: 0, min: 0 },
    minKeyInterval: { type: Number, default: 0, min: 0 },
    maxKeyInterval: { type: Number, default: 0, min: 0 },
    backspaceCount: { type: Number, default: 0, min: 0 },
    pauseCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const pasteMetricsSchema = new mongoose.Schema(
  {
    totalPasteEvents: { type: Number, default: 0, min: 0 },
    totalPastedCharacters: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const keystrokeSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // A client-generated UUID lets the browser retry start-session safely.
    sessionId: { type: String, required: true },
    // This is the user's saved document text, not behavioral analytics.
    content: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: 0, min: 0 }, // milliseconds
    wordCount: { type: Number, default: 0, min: 0 },
    analytics: { type: analyticsSchema, default: () => ({}) },
    pasteMetrics: { type: pasteMetricsSchema, default: () => ({}) },
    pasteEvents: { type: [pasteEventSchema], default: [] },

    // Legacy fields remain readable for already-saved session data.
    events: { type: [keystrokeEventSchema], default: [] },
    totalKeystrokes: { type: Number, default: 0 },
    averagePressDuration: { type: Number, default: 0 },
    averageInterKeyInterval: { type: Number, default: null },
  },
  { timestamps: true }
);

// Auto-compute aggregates for the legacy /session endpoint.
keystrokeSessionSchema.pre('save', function (next) {
  if (this.events.length === 0) return next();

  this.totalKeystrokes = this.events.length;
  const averagePressDuration =
    this.events.reduce((sum, event) => sum + event.pressDuration, 0) / this.events.length;
  this.averagePressDuration = Math.round(averagePressDuration * 100) / 100;

  const intervals = this.events
    .map((event) => event.interKeyInterval)
    .filter((interval) => interval !== null && interval >= 0);
  if (intervals.length > 0) {
    this.averageInterKeyInterval =
      Math.round((intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length) * 100) / 100;
  }

  next();
});

module.exports = mongoose.model('KeystrokeSession', keystrokeSessionSchema);
