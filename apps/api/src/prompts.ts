import type { AnalyzeMetadata, SttResult } from "./types";

export function buildDiagnosticPrompt(stt: SttResult, metadata: AnalyzeMetadata, audioObjectKey: string) {
  return [
    {
      role: "system",
      content:
        "You are assisting a licensed Speech-Language Pathologist. Return only valid JSON matching the requested schema. Do not provide a diagnosis; identify speech production patterns that require clinician review."
    },
    {
      role: "user",
      content: `Analyze repaired cleft palate speech using Telugu phonetic expectations.

Patient identifier hash: ${metadata.patientId}
Clinician: ${metadata.clinicianId}
Audio object key: ${audioObjectKey}
Expected targets: ${metadata.utteranceTargets.join(", ")}

Verbatim Telugu transcript:
${stt.transcript_telugu}

Latin transliteration:
${stt.transcript_latin}

Compare target Telugu pressure consonants and fricatives against produced output. Flag compensatory articulations including glottal substitution, pharyngeal fricatives, posterior nasal fricatives, weak pressure consonants, nasal emission, hypernasality, and other VPI markers.

Return a JSON object with:
report_id, patient_id_hash, clinician_id, created_at, audio_object_key, transcript_telugu, transcript_latin, utterance_targets, global_impressions, segment_findings, therapy_recommendations, review_required, limitations.
Each segment finding must include target_phoneme, produced_phoneme, error_type, severity, nasality_score, confidence, acoustic_markers, clinical_notes, and therapy_recommendations.`
    }
  ];
}
