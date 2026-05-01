import { buildDiagnosticPrompt } from "./prompts";
import type { AnalyzeMetadata, AudioUpload, Env, SttResult } from "./types";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const API_TIMEOUT_MS = 25_000;

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
      assertAccessIdentity(request);
      const { audio, metadata } = await readAnalyzeRequest(request, getClinicianId(request));
      const objectKey = await storeAudio(env, audio, metadata);
      await env.SESSION_KV.put(
        `session:${metadata.clinicianId}:${crypto.randomUUID()}`,
        JSON.stringify({ patientId: metadata.patientId, objectKey, createdAt: new Date().toISOString() }),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );

      const transcript = await transcribeVerbatim(env, audio);
      const report = normalizeReport(await analyzeTranscript(env, transcript, metadata, objectKey), transcript, metadata, objectKey);
      await env.REPORT_KV.put(`report:${report.report_id}`, JSON.stringify(report));

      return json(report, 200, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server error";
      const status = message.includes("Unauthorized")
        ? 401
        : message.includes("Invalid") || message.includes("required") || message.includes("too large")
          ? 400
          : 502;
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

async function storeAudio(env: Env, audio: AudioUpload, metadata: AnalyzeMetadata): Promise<string> {
  const objectKey = `clinical-audio/${new Date().toISOString().slice(0, 10)}/${metadata.patientId}/${crypto.randomUUID()}.wav`;
  await env.AUDIO_BUCKET.put(objectKey, audio.blob.stream(), {
    httpMetadata: { contentType: "audio/wav" },
    customMetadata: {
      sampleRate: String(metadata.sampleRate),
      channelCount: String(metadata.channelCount)
    }
  });
  return objectKey;
}

async function transcribeVerbatim(env: Env, audio: AudioUpload): Promise<SttResult> {
  const body = new FormData();
  body.append("file", audio.blob, audio.name);
  body.append("model", env.STT_MODEL);
  body.append("language", "te");
  body.append("mode", "verbatim");
  body.append("normalize", "false");
  body.append("profanity_filter", "false");
  body.append("disfluency_retention", "true");

  const response = await fetchWithTimeout(env.STT_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STT_API_KEY}` },
    body
  });

  if (!response.ok) {
    throw new Error(`STT API failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Partial<SttResult>;
  return {
    transcript_telugu: payload.transcript_telugu ?? "",
    transcript_latin: payload.transcript_latin ?? "",
    confidence: payload.confidence
  };
}

async function analyzeTranscript(
  env: Env,
  transcript: SttResult,
  metadata: AnalyzeMetadata,
  audioObjectKey: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(env.LLM_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: buildDiagnosticPrompt(transcript, metadata, audioObjectKey)
    })
  });

  if (!response.ok) {
    throw new Error(`Diagnostic LLM failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Diagnostic LLM returned an empty response");
  }

  return JSON.parse(content) as Record<string, unknown>;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("External API timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertAccessIdentity(request: Request): void {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) {
    throw new Error("Unauthorized: Cloudflare Access identity header missing");
  }
}

function getClinicianId(request: Request): string {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) {
    throw new Error("Unauthorized: Cloudflare Access identity header missing");
  }
  return email;
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

function normalizeReport(
  report: Record<string, unknown>,
  transcript: SttResult,
  metadata: AnalyzeMetadata,
  audioObjectKey: string
): Record<string, unknown> & { report_id: string } {
  return {
    ...report,
    report_id: typeof report.report_id === "string" ? report.report_id : crypto.randomUUID(),
    patient_id_hash: metadata.patientId,
    clinician_id: metadata.clinicianId,
    created_at: typeof report.created_at === "string" ? report.created_at : new Date().toISOString(),
    audio_object_key: audioObjectKey,
    transcript_telugu: transcript.transcript_telugu,
    transcript_latin: transcript.transcript_latin,
    utterance_targets: metadata.utteranceTargets,
    review_required: typeof report.review_required === "boolean" ? report.review_required : true,
    limitations: Array.isArray(report.limitations)
      ? report.limitations
      : ["Machine analysis requires review by a licensed clinician."]
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
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Audio-Sample-Rate, X-Audio-Channel-Count, X-Audio-Filename, X-Patient-Id, X-Utterance-Targets",
    Vary: "Origin"
  };
}
