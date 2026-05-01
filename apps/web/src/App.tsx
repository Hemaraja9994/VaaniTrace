import { useState } from "react";
import { AudioRecorder } from "./components/AudioRecorder";
import { ReportDashboard } from "./components/ReportDashboard";
import type { DiagnosticReport } from "@shared/types/diagnosticReport";

export function App() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [targets, setTargets] = useState("క, చ, ట, త, ప, స, శ, హ");
  const utteranceTargets = targets
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="capture-pane">
          <header className="panel-header">
            <p className="eyebrow">Clinical capture</p>
            <h1>Repaired cleft palate speech analysis</h1>
          </header>
          <div className="session-fields">
            <label>
              Patient identifier
              <input
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                placeholder="Hospital MRN or study ID"
              />
            </label>
            <label>
              Telugu targets
              <input value={targets} onChange={(event) => setTargets(event.target.value)} />
            </label>
          </div>
          <AudioRecorder
            patientId={patientId}
            utteranceTargets={utteranceTargets}
            onReport={setReport}
            onError={setError}
          />
          {error ? <p className="error-message">{error}</p> : null}
        </div>
        <ReportDashboard report={report} />
      </section>
    </main>
  );
}
