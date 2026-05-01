import { Activity, ClipboardCheck, Waves } from "lucide-react";
import type { DiagnosticReport } from "@shared/types/diagnosticReport";

interface ReportDashboardProps {
  report: DiagnosticReport | null;
}

export function ReportDashboard({ report }: ReportDashboardProps) {
  if (!report) {
    return (
      <section className="report-pane empty-report">
        <ClipboardCheck size={32} />
        <h2>Diagnostic report</h2>
        <p>Reports appear here after a clinical audio capture is analyzed.</p>
      </section>
    );
  }

  return (
    <section className="report-pane">
      <header className="report-header">
        <div>
          <p className="eyebrow">Report {report.report_id}</p>
          <h2>Telugu phonetic findings</h2>
        </div>
        <span className={report.review_required ? "status-pill warn" : "status-pill"}>
          {report.review_required ? "Clinician review" : "No urgent flags"}
        </span>
      </header>

      <div className="metric-grid">
        <div className="metric">
          <Waves size={20} />
          <span>Resonance</span>
          <strong>{report.global_impressions.resonance}</strong>
        </div>
        <div className="metric">
          <Activity size={20} />
          <span>Pressure consonants</span>
          <strong>{report.global_impressions.pressure_consonant_integrity}</strong>
        </div>
      </div>

      <div className="transcript">
        <h3>Verbatim transcript</h3>
        <p lang="te">{report.transcript_telugu}</p>
        <p>{report.transcript_latin}</p>
      </div>

      <div className="finding-table" role="table" aria-label="Segment findings">
        <div className="table-row table-head" role="row">
          <span>Target</span>
          <span>Produced</span>
          <span>Error</span>
          <span>Nasality</span>
        </div>
        {report.segment_findings.map((finding, index) => (
          <div className="table-row" role="row" key={`${finding.target_phoneme}-${index}`}>
            <span>{finding.target_phoneme}</span>
            <span>{finding.produced_phoneme}</span>
            <span>{finding.error_type}</span>
            <span>{Math.round(finding.nasality_score * 100)}%</span>
          </div>
        ))}
      </div>

      <div className="recommendations">
        <h3>Therapy recommendations</h3>
        <ul>
          {report.therapy_recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
