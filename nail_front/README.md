# Nail Platform frontend

Next.js 16 / React 19 frontend. Complete platform setup and SSO configuration are documented in [the root README](../README.md).

```sh
npm ci
npm run dev
npm run lint
npm run build
```

The complete Docker stack is started from the repository root with `python run_platform.py`.
Production uses the standalone build and Node.js 24. `NEXT_PUBLIC_BASE_PATH` is compiled at build time.
The backend URL is server-only `INTERNAL_API_BASE_URL`; browser API requests use the same-origin `/api` route.
