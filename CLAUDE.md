# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Web client (responsive, installable PWA) for the cold chain monitoring API in the sibling repository `../ColdChain_API`. Stack: Vite, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, React Router, React Hook Form + Zod, Recharts, `@zxing/browser`. All interface text and code comments are in Portuguese; keep new ones consistent.

## Commands

```bash
npm run dev         # Vite on port 5173, /api proxied to API_PROXY_TARGET (default localhost:3001)
npm run dev:https   # same, over HTTPS, needed to use the camera from a phone on the local network
npm run build       # type check and production build, including the service worker
npm run lint        # oxlint
npm test            # Vitest with MSW
npx vitest run src/shared/lib/format.test.ts   # a single test file
npm run test:e2e    # Playwright: starts the API and Vite on their own ports, needs Docker Postgres and the seeded MASTER
```

The e2e suite creates enterprises named `e2e-*` and does not delete them.

## Architecture

- `src/app/`: routes, layout, access guards and the query client.
- `src/features/<domain>/`: `api.ts`, `hooks.ts`, `types.ts`, `components/`, `pages/`. A feature imports another only through its `index.ts`; pages are imported only by `src/app/router.tsx`, which loads them lazily. `dashboard` must not import `cold-units` or `alerts`, since both depend on it.
- `src/shared/`: API client, shadcn/ui components, formatting and domain constants.

**Server state** lives only in TanStack Query; polling intervals are in `src/shared/polling.ts`. Unit status always comes from `GET /dashboard/summary`, so the unit list and detail pages reuse that query instead of calculating status.

**Auth**: `AuthProvider` keeps the Bearer token in `localStorage`. A 401 anywhere except `/login` signs out, and so does a 404 on `/me`, which means the user was removed. Guards only organize navigation; the API enforces permissions. Show errors through `getErrorMessage`, and do not branch on 400 versus 404, because the API often uses 400 for "not found".

**HTTPS and proxy**: the camera requires HTTPS or localhost, and an HTTPS page cannot call an HTTP API, so the app always calls the relative `/api`. Vite proxies it in development, and production needs a reverse proxy or `VITE_API_URL`.

**Chart**: `chartData.ts` holds the logic and has unit tests. Series colors come from `--series-1..8` in `src/index.css`, validated for color vision deficiency in both themes, in a fixed order assigned by sorted MAC so a board keeps its color. Status colors are reserved for state and always come with an icon and text.
