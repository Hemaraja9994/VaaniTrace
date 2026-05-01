# VaaniTrace

A Cloudflare Pages + Workers deployment package for clinical capture and analysis of repaired cleft palate speech in Telugu.

## What Is Included

- React frontend with 16 kHz mono WAV capture, waveform feedback, and a diagnostic report dashboard.
- TypeScript Cloudflare Worker accepting secure `POST /api/analyze` uploads.
- R2 storage for permanent audio objects.
- KV bindings for clinician session metadata and report history.
- STT integration configured for verbatim, non-correcting Telugu transcription.
- LLM diagnostic prompt for compensatory articulation and VPI marker review.
- JSON Schema for structured diagnostic reports.

## Local Development

```bash
npm install
npm run dev
```

In another terminal:

```bash
npm run worker:dev
```

The Vite frontend proxies `/api` to the local Worker on port `8787`.

## Project Structure

```text
apps/
  web/       React frontend for Cloudflare Pages
  api/       Cloudflare Worker API
packages/
  shared/    Shared TypeScript report types and JSON schema
docs/        Deployment and clinical data notes
```

## Clinical Safety

The report is decision support for licensed clinicians. It should not be presented as an autonomous diagnosis. Always require clinician review for therapy planning, and validate Telugu phonetic targets with local dialect expectations.

## Deployment

See [docs/deployment.md](./docs/deployment.md).
