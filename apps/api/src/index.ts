import type { AnalyzeMetadata, AudioUpload, Env } from "./types";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/analyze") {
      return json({ error: "Not found" }, 404, env);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, env);
    }

    try {
      const { audio, metadata } = await readAnalyzeRequest(request, getClinicianId(request));
      const report = buildPrototypeReport(audio, metadata);

      return json(report, 200, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server error";
      const status = message.includes("Unauthorized")
        ? 401
        : message.includes("Invalid") || message.includes("required") || message.includes("too large")
          ? 400
          : 500;
      return json({ error: message }, status, env);
    }
  }
};

async function readAnalyzeRequest(
  request: Request,
  clinicianId: string
): Promise<{ audio: AudioUpload; metadata: AnalyzeMetadata }> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.startsWith("audio/wav")) {
    return readRawWav(request, clinicianId);
  }
  return readAnalyzeForm(request, clinicianId);
}

async function readRawWav(request: Request, clinicianId: string): Promise<{ audio: AudioUpload; metadata: AnalyzeMetadata }> {
  const body = await request.blob();
  if (body.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio file too large");
  }

  const sampleRate = Number(request.headers.get("X-Audio-Sample-Rate"));
  const channelCount = Number(request.headers.get("X-Audio-Channel-Count"));
  if (sampleRate !== 16000 || channelCount !== 1) {
    throw new Error("Invalid audio capture settings; expected 16 kHz mono");
  }

  return {
    audio: {
      blob: body,
      name: request.headers.get("X-Audio-Filename") ?? `clinical-capture-${Date.now()}.wav`,
      size: body.size,
      type: "audio/wav"
    },
    metadata: {
      patientId: await sha256(request.headers.get("X-Patient-Id") ?? ""),
      clinicianId,
      utteranceTargets: parseTargets(request.headers.get("X-Utterance-Targets") ?? "[]"),
      sampleRate,
      channelCount
    }
  };
}

async function readAnalyzeForm(
  request: Request,
  clinicianId: string
): Promise<{ audio: AudioUpload; metadata: AnalyzeMetadata }> {
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    throw new Error("audio file is required");
  }
  if (audio.type !== "audio/wav" && !audio.name.endsWith(".wav")) {
    throw new Error("Invalid audio format; expected audio/wav");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio file too large");
  }

  const utteranceTargets = parseTargets(String(form.get("utteranceTargets") ?? "[]"));

  const sampleRate = Number(form.get("sampleRate"));
  const channelCount = Number(form.get("channelCount"));
  if (sampleRate !== 16000 || channelCount !== 1) {
    throw new Error("Invalid audio capture settings; expected 16 kHz mono");
  }

  return {
    audio: {
      blob: audio,
      name: audio.name,
      size: audio.size,
      type: audio.type || "audio/wav"
    },
    metadata: {
      patientId: await sha256(String(form.get("patientId") ?? "")),
      clinicianId,
      utteranceTargets,
      sampleRate,
      channelCount
    }
  };
}

function getClinicianId(request: Request): string {
  return request.headers.get("Cf-Access-Authenticated-User-Email") ?? "prototype-user";
}

function parseTargets(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((target) => typeof target === "string")) {
      throw new Error("Invalid utterance targets");
    }
    return parsed;
  } catch {
    throw new Error("Invalid utterance targets");
  }
}

function buildPrototypeReport(audio: AudioUpload, metadata: AnalyzeMetadata): Record<string, unknown> & { report_id: string } {
  const audioSeconds = Math.round((audio.size / 32_000) * 10) / 10;
  const segmentFindings = metadata.utteranceTargets.map((target) => ({
    target_phoneme: target,
    produced_phoneme: "not transcribed",
    telugu_grapheme: target,
    error_type: "uncertain",
    severity: "mild",
    nasality_score: 0,
    confidence: 0,
    acoustic_markers: ["Prototype mode does not run acoustic or AI analysis."],
    clinical_notes: "Use this row as a clinician checklist item during manual review.",
    therapy_recommendations: ["Record clinician-observed production, resonance, and pressure consonant quality."]
  }));

  return {
    report_id: crypto.randomUUID(),
    patient_id_hash: metadata.patientId,
    clinician_id: metadata.clinicianId,
    created_at: new Date().toISOString(),
    audio_object_key: "not-stored-prototype-mode",
    transcript_telugu: "Prototype mode: audio was received but not stored or transcribed.",
    transcript_latin: `${audio.name} received (${audioSeconds}s estimated, ${(audio.size / 1024).toFixed(1)} KiB).`,
    utterance_targets: metadata.utteranceTargets,
    global_impressions: {
      resonance: "uncertain",
      pressure_consonant_integrity: "uncertain",
      suspected_vpi_markers: [],
      intelligibility_estimate: 0
    },
    segment_findings: segmentFindings,
    therapy_recommendations: [
      "Use this prototype report for workflow demonstration only.",
      "Add clinician-scored observations before using findings for care planning.",
      "Connect a funded STT/AI provider later if automated analysis becomes available."
    ],
    review_required: true,
    limitations: [
      "Free prototype mode does not store audio, transcribe speech, or call paid AI services.",
      "This output is not a diagnosis and must be completed by a licensed clinician."
    ]
  };
}

async function sha256(value: string): Promise<string> {
  if (!value) {
    throw new Error("patientId is required");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(payload: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Audio-Sample-Rate, X-Audio-Channel-Count, X-Audio-Filename, X-Patient-Id, X-Utterance-Targets",
    Vary: "Origin"
  };
}
