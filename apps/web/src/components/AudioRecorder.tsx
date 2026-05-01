import { CircleStop, Mic, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { ClinicalAudioRecorder } from "../lib/clinicalRecorder";
import type { DiagnosticReport } from "@shared/types/diagnosticReport";
import { Waveform } from "./Waveform";

interface AudioRecorderProps {
  patientId: string;
  utteranceTargets: string[];
  onReport: (report: DiagnosticReport) => void;
  onError: (message: string) => void;
}

type RecorderState = "idle" | "recording" | "uploading";

export function AudioRecorder({ patientId, utteranceTargets, onReport, onError }: AudioRecorderProps) {
  const recorderRef = useRef<ClinicalAudioRecorder | null>(null);
  const [state, setState] = useState<RecorderState>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [durationMs, setDurationMs] = useState(0);

  async function startRecording() {
    try {
      setLevels([]);
      const recorder = new ClinicalAudioRecorder((samples) => {
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        setLevels((existing) => [...existing.slice(-95), Math.min(1, rms * 8)]);
      });
      recorderRef.current = recorder;
      await recorder.start();
      setState("recording");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to access microphone.");
    }
  }

  async function stopAndUpload() {
    if (!recorderRef.current) {
      return;
    }

    setState("uploading");
    try {
      const audio = await recorderRef.current.stop();
      setDurationMs(audio.durationMs);
      const form = new FormData();
      form.append("audio", audio.blob, `clinical-capture-${Date.now()}.wav`);
      form.append("patientId", patientId);
      form.append("utteranceTargets", JSON.stringify(utteranceTargets));
      form.append("sampleRate", String(audio.sampleRate));
      form.append("channelCount", String(audio.channelCount));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Upload failed with status ${response.status}`);
      }

      onReport((await response.json()) as DiagnosticReport);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Audio upload or analysis failed.");
    } finally {
      setState("idle");
      recorderRef.current = null;
    }
  }

  return (
    <div className="recorder">
      <Waveform levels={levels} isRecording={state === "recording"} />
      <div className="recorder-meta">
        <span>16 kHz</span>
        <span>Mono WAV</span>
        <span>{durationMs ? `${(durationMs / 1000).toFixed(1)}s captured` : "Ready"}</span>
      </div>
      <div className="button-row">
        <button
          className="primary-button"
          disabled={state !== "idle" || !patientId || utteranceTargets.length === 0}
          onClick={startRecording}
          title="Start recording"
          type="button"
        >
          <Mic size={18} />
          Record
        </button>
        <button
          className="secondary-button"
          disabled={state !== "recording"}
          onClick={stopAndUpload}
          title="Stop and analyze"
          type="button"
        >
          {state === "uploading" ? <UploadCloud size={18} /> : <CircleStop size={18} />}
          {state === "uploading" ? "Analyzing" : "Stop"}
        </button>
      </div>
    </div>
  );
}
