const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

const getRiskLevel = (score) => {
  if (score >= 90) return 'Very High Confidence';
  if (score >= 75) return 'High Confidence';
  if (score >= 60) return 'Moderate Confidence';
  if (score >= 40) return 'Low Confidence';
  return 'Needs Review';
};

// This service is intentionally isolated from persistence. Future scoring methods
// (such as a reviewed ML model) can return the same report shape.
const generateAuthenticityReport = (session) => {
  const analytics = session.analytics || {};
  const pasteMetrics = session.pasteMetrics || {};
  const wordCount = session.wordCount || 0;
  const duration = session.duration || 0;
  const totalKeystrokes = analytics.totalKeystrokes || 0;
  const backspaceCount = analytics.backspaceCount || 0;
  const pauseCount = analytics.pauseCount || 0;
  const totalPasteEvents = pasteMetrics.totalPasteEvents || 0;
  const totalPastedCharacters = pasteMetrics.totalPastedCharacters || 0;
  const durationMinutes = duration / 60000;
  const wordsPerMinute = durationMinutes > 0 ? wordCount / durationMinutes : 0;
  const keystrokesPerWord = wordCount > 0 ? totalKeystrokes / wordCount : 0;

  let score = 100;
  const deductions = [];
  const findings = [];
  const addDeduction = (rule, points, reason) => {
    score -= points;
    deductions.push({ rule, points, reason });
    findings.push(reason);
  };

  // Paste activity is evidence to review, not proof of non-human authorship.
  if (totalPastedCharacters >= 500) {
    addDeduction('large-paste-content', 25, 'Large pasted text blocks were detected (500 or more characters).');
  } else if (totalPastedCharacters >= 150) {
    addDeduction('moderate-paste-content', 12, 'A moderate pasted text block was detected (150 or more characters).');
  } else if (totalPasteEvents === 0) {
    findings.push('Writing session contained no paste activity.');
  }

  if (totalPasteEvents >= 3) {
    addDeduction('multiple-pastes', 10, 'Multiple paste events were detected.');
  } else if (totalPasteEvents > 0 && totalPastedCharacters < 150) {
    findings.push('Limited paste activity was detected.');
  }

  // Manual composition usually produces several key events for each word.
  if (wordCount >= 40 && keystrokesPerWord < 2) {
    addDeduction('low-typing-activity', 15, 'Typing activity was low compared with the document word count.');
  } else if (wordCount >= 40 && keystrokesPerWord >= 3) {
    findings.push('Typing activity was consistent with manual composition.');
  }

  if (wordCount >= 80 && backspaceCount === 0) {
    addDeduction('no-revisions', 10, 'No corrections were recorded for a long document.');
  } else if (totalKeystrokes > 0 && backspaceCount / totalKeystrokes >= 0.01) {
    findings.push('Natural revision behavior was detected through backspace activity.');
  }

  if (wordCount >= 100 && duration < 120000) {
    addDeduction('very-short-session', 20, 'A large document was completed in under two minutes.');
  } else if (wordCount >= 80 && wordsPerMinute > 180) {
    addDeduction('high-writing-speed', 15, 'The writing speed was unusually high for the document length.');
  } else if (wordCount >= 40 && duration > 0) {
    findings.push('Session duration was consistent with a sustained writing process.');
  }

  if (wordCount >= 100 && pauseCount === 0) {
    addDeduction('no-pauses', 8, 'No pauses longer than two seconds were recorded in a long session.');
  } else if (pauseCount > 0) {
    findings.push('Natural thinking pauses were detected during writing.');
  }

  score = Math.max(0, Math.min(100, score));
  const riskLevel = getRiskLevel(score);
  const summary = deductions.length === 0
    ? 'This rules-v1 report applied no deductions. The stored timing, revision, pause, and paste metrics showed no configured review signals.'
    : `This rules-v1 report started at 100 and applied ${deductions.length} visible deduction${deductions.length === 1 ? '' : 's'} for the signals listed below. It is evidence from session behavior, not an AI-detection result.`;

  return {
    authenticityScore: score,
    riskLevel,
    generatedAt: new Date(),
    findings,
    behaviorSummary: summary,
    scoringVersion: 'rules-v1',
    metrics: {
      wordCount,
      duration,
      totalKeystrokes,
      backspaceCount,
      pauseCount,
      totalPasteEvents,
      totalPastedCharacters,
      wordsPerMinute: roundToTwoDecimals(wordsPerMinute),
      keystrokesPerWord: roundToTwoDecimals(keystrokesPerWord),
      deductions,
    },
  };
};

module.exports = { generateAuthenticityReport };
