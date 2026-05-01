# Deployment And Security Notes

This project is currently configured for a free prototype deployment on Cloudflare Workers.

## Free Prototype Mode

The app does not require:

- R2 buckets
- KV namespaces
- STT API keys
- LLM API keys
- Cloudflare Access

When a recording is submitted, the Worker returns a structured prototype report. Audio is accepted only long enough to create the response. It is not stored, transcribed, or sent to an external AI service.

## Deploy

1. Push the latest code to GitHub.
2. In Cloudflare, retry the Worker deployment.
3. The previous R2 error should be gone because `wrangler.toml` no longer asks Cloudflare for R2.

## Clinical Safety

Prototype mode is for workflow demonstration only. It is not a diagnosis and does not provide automated clinical analysis. A licensed clinician must complete and review all findings before care planning.

## Future Paid Upgrade Path

If funding becomes available later, the project can be upgraded to add:

- R2 storage for private audio retention
- KV or D1 for report history
- Cloudflare Access for staff-only login
- Speech-to-text and LLM services for automated draft findings
