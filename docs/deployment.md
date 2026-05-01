# Deployment And Security Notes

This package is designed for Cloudflare Pages plus a TypeScript Worker API.

## Provisioning

1. Create R2 buckets:
   - `cleft-speech-audio-prod`
   - `cleft-speech-audio-dev`
2. Create KV namespaces:
   - `cleft-speech-session-prod`
   - `cleft-speech-session-dev`
   - `cleft-speech-report-prod`
   - `cleft-speech-report-dev`
3. Replace the placeholder namespace IDs in `wrangler.toml`.
4. Configure secrets:
   - `wrangler secret put STT_API_KEY`
   - `wrangler secret put LLM_API_KEY`
5. Deploy the Worker:
   - `npm run worker:deploy`
6. Build and deploy Pages:
   - `npm run build`
   - `wrangler pages deploy apps/web/dist`

## Cloudflare Access

Create Access applications for both the Pages hostname and `/api/*` Worker route.

Recommended policies:

- Allow only hospital IdP groups for treating clinicians, SLP supervisors, and approved admins.
- Require MFA.
- Restrict by device posture for managed hospital laptops where possible.
- Pass identity headers to the Worker so `Cf-Access-Authenticated-User-Email` is available.
- Disable public R2 access. Audio objects should be reachable only through audited Worker routes.

## HIPAA Alignment

This code is an implementation starting point, not a compliance certification. Before production use, confirm BAAs and data handling terms for Cloudflare and any STT/LLM vendor, configure retention policies, and complete threat modeling with the hospital security team.

The Worker avoids logging PHI, stores audio under hashed patient IDs, keeps report JSON in KV, and requires Cloudflare Access identity headers.
