export interface Env {
  ALLOWED_ORIGIN?: string;
}

export interface AnalyzeMetadata {
  patientId: string;
  clinicianId: string;
  utteranceTargets: string[];
  sampleRate: number;
  channelCount: number;
}

export interface AudioUpload {
  blob: Blob;
  name: string;
  size: number;
  type: string;
}

export interface SttResult {
  transcript_telugu: string;
  transcript_latin: string;
  confidence?: number;
}
