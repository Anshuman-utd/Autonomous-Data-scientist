# Frontend

React 19 / Vite / Tailwind / React Router / Recharts. See the repository README
for backend setup, API contracts, environment configuration and deployment.

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
```

`VITE_API_URL` is the public backend origin. It must not include credentials.
The authenticated shell and route pages live in `src/components/layout` and
`src/pages`; dataset workflows are split into `src/features` and load lazily.
Shared API/session/download handling lives in `src/lib/api.js`.

Vitest/Testing Library tests run in jsdom without a real AI service. The full
browser review, responsive screenshots and known limits are in
`../docs/TEST_RESULTS.md`. `vercel.json` retains SPA route fallback support.
