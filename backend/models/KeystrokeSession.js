const mongoose = require('mongoose');

// A single keystroke event: duration in ms between keydown and keyup
const keystrokeEventSchema = new mongoose.Schema(
  {
    // Key identity is intentionally NOT stored — only timing
    pressDuration: {
      type: Number, // milliseconds key was held down
      required: true,
      min: 0,
    },
    interKeyInterval: {
      type: Number, // ms between previous keyup and this keydown (null for first key)
      default: null,
    },
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
    sessionId: {
      type: String,
      required: true, // UUID generated on the frontend per writing session
    },
    events: [keystrokeEventSchema],
    totalKeystrokes: {
      type: Number,
      default: 0,
    },
    averagePressDuration: {
      type: Number,
      default: 0,
    },
    averageInterKeyInterval: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-compute aggregates before save
keystrokeSessionSchema.pre('save', function (next) {
  if (this.events.length === 0) return next();

  this.totalKeystrokes = this.events.length;

  const avgPress =
    this.events.reduce((sum, e) => sum + e.pressDuration, 0) / this.events.length;
  this.averagePressDuration = Math.round(avgPress * 100) / 100;

  const ikiValues = this.events
    .map((e) => e.interKeyInterval)
    .filter((v) => v !== null && v >= 0);
  if (ikiValues.length > 0) {
    this.averageInterKeyInterval =
      Math.round((ikiValues.reduce((s, v) => s + v, 0) / ikiValues.length) * 100) / 100;
  }

  next();
});

module.exports = mongoose.model('KeystrokeSession', keystrokeSessionSchema);
