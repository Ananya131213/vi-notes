import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthenticityReport } from '../services/keystrokeService';
import './SessionReportPage.css';

const formatDuration = (duration) => {
  const totalSeconds = Math.round((duration || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const formatDate = (date) =>
  new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const riskClass = (riskLevel) => riskLevel.toLowerCase().replaceAll(' ', '-');

export default function SessionReportPage() {
  const { sessionId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getAuthenticityReport(token, sessionId);
        if (isCurrent) setReport(response.data);
      } catch (requestError) {
        const message = requestError.response?.data?.message;
        if (isCurrent) setError(message || 'Could not load the authenticity report.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadReport();
    return () => {
      isCurrent = false;
    };
  }, [sessionId, token]);

  if (loading) {
    return <main className="report-page report-state">Loading authenticity report...</main>;
  }

  if (error || !report) {
    return (
      <main className="report-page report-state">
        <h1>Report unavailable</h1>
        <p>{error || 'No report was found for this session.'}</p>
        <button className="report-button" onClick={() => navigate('/sessions')}>Back to sessions</button>
      </main>
    );
  }

  const { metrics } = report;
  const deductions = metrics.deductions || [];

  return (
    <main className="report-page">
      <header className="report-header">
        <div>
          <p className="report-kicker">Vi-Notes session evidence</p>
          <h1>Authenticity report</h1>
          <p className="report-subtitle">A transparent behavioral summary, not an AI-detection result.</p>
        </div>
        <div className="report-actions">
          <button className="report-button secondary" onClick={() => navigate('/sessions')}>Session history</button>
          <button className="report-button secondary" onClick={() => navigate('/editor')}>Editor</button>
        </div>
      </header>

      <section className="report-overview">
        <div className="score-card">
          <span>Authenticity score</span>
          <strong>{report.authenticityScore}</strong>
          <small>out of 100</small>
        </div>
        <div className={`risk-card ${riskClass(report.riskLevel)}`}>
          <span>Risk level</span>
          <strong>{report.riskLevel}</strong>
          <small>Generated {formatDate(report.generatedAt)}</small>
        </div>
      </section>

      <section className="report-section">
        <h2>Behavior summary</h2>
        <p>{report.behaviorSummary}</p>
      </section>

      <section className="report-section">
        <h2>Session metrics</h2>
        <div className="report-metrics">
          <ReportMetric label="Word count" value={metrics.wordCount} />
          <ReportMetric label="Duration" value={formatDuration(metrics.duration)} />
          <ReportMetric label="Keystrokes" value={metrics.totalKeystrokes} />
          <ReportMetric label="Backspaces" value={metrics.backspaceCount} />
          <ReportMetric label="Pauses" value={metrics.pauseCount} />
          <ReportMetric label="Paste events" value={metrics.totalPasteEvents} />
          <ReportMetric label="Pasted characters" value={metrics.totalPastedCharacters} />
          <ReportMetric label="Words per minute" value={metrics.wordsPerMinute} />
          <ReportMetric label="Keystrokes per word" value={metrics.keystrokesPerWord} />
        </div>
      </section>

      <section className="report-section">
        <h2>Findings</h2>
        <ul className="findings-list">
          {report.findings.map((finding, index) => <li key={`${finding}-${index}`}>{finding}</li>)}
        </ul>
      </section>

      <section className="report-section">
        <h2>Score calculation</h2>
        <p className="report-explanation">This report uses {report.scoringVersion}. It starts at 100 and applies only the visible deductions below.</p>
        <div className="score-breakdown">
          <div><span>Starting score</span><strong>100</strong></div>
          {deductions.map((deduction) => (
            <div key={deduction.rule}>
              <span>{deduction.reason}</span>
              <strong>-{deduction.points}</strong>
            </div>
          ))}
          {deductions.length === 0 && <div><span>No deductions applied</span><strong>0</strong></div>}
          <div className="final-score"><span>Final score</span><strong>{report.authenticityScore}</strong></div>
        </div>
      </section>
    </main>
  );
}

function ReportMetric({ label, value }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}
