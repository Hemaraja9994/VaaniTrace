import { Activity, ClipboardCheck, FileDown, Waves } from "lucide-react";
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

  function savePdf() {
    window.print();
  }

  const errorGroups = report.segment_findings.reduce<
    Record<string, { count: number; maxSeverity: string; averageConfidence: number; confidenceTotal: number }>
  >((groups, finding) => {
    const group = groups[finding.error_type] ?? {
      count: 0,
      maxSeverity: "none",
      averageConfidence: 0,
      confidenceTotal: 0
    };
    group.count += 1;
    group.confidenceTotal += finding.confidence;
    group.averageConfidence = group.confidenceTotal / group.count;
    group.maxSeverity = higherSeverity(group.maxSeverity, finding.severity);
    groups[finding.error_type] = group;
    return groups;
  }, {});

  const groupedErrors = Object.entries(errorGroups).sort(([, first], [, second]) => second.count - first.count);

  return (
    <section className="report-pane printable-report">
      <header className="report-header">
        <div>
          <p className="eyebrow">Report {report.report_id}</p>
          <h2>Telugu phonetic findings</h2>
        </div>
        <div className="report-actions">
          <span className={report.review_required ? "status-pill warn" : "status-pill"}>
            {report.review_required ? "Clinician review" : "No urgent flags"}
          </span>
          <button className="icon-button no-print" onClick={savePdf} title="Save report as PDF" type="button">
            <FileDown size={18} />
            Save PDF
          </button>
        </div>
      </header>

      <dl className="report-summary">
        <div>
          <dt>Created</dt>
          <dd>{new Date(report.created_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Patient hash</dt>
          <dd>{report.patient_id_hash.slice(0, 16)}...</dd>
        </div>
        <div>
          <dt>Clinician</dt>
          <dd>{report.clinician_id}</dd>
        </div>
      </dl>

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

      <div className="classification-panel">
        <h3>Error classification</h3>
        <div className="classification-grid">
          {groupedErrors.map(([errorType, group]) => (
            <div className="classification-card" key={errorType}>
              <span>{formatLabel(errorType)}</span>
              <strong>{group.count}</strong>
              <small>
                {formatLabel(group.maxSeverity)} severity · {Math.round(group.averageConfidence * 100)}% confidence
              </small>
            </div>
          ))}
        </div>
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

      <div className="recommendations">
        <h3>Limitations</h3>
        <ul>
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function higherSeverity(current: string, next: string): string {
  const rank = ["none", "mild", "moderate", "severe"];
  return rank.indexOf(next) > rank.indexOf(current) ? next : current;
}
