export interface Env {
  AUDIO_BUCKET: R2Bucket;
  SESSION_KV: KVNamespace;
  REPORT_KV: KVNamespace;
  STT_API_URL: string;
  STT_API_KEY: string;
  STT_MODEL: string;
  LLM_API_URL: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;
  ALLOWED_ORIGIN: string;
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
