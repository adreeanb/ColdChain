# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cold chain monitoring REST API: ESP32 sensors report temperatures for cold rooms, cold storage and reefer trucks, and readings outside a unit's limits raise alerts. Stack: Express 5, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16, MQTT, JWT. Code comments and API error messages are in Portuguese; keep new ones consistent.

## Commands

```bash
docker compose up -d      # Postgres (host port 5433) and the Mosquitto broker (1883)
npm run dev               # tsx watch src/server.ts (PORT from .env, falls back to 3334)
npx tsc --noEmit          # type check (src/ only; the seed runs through tsx)
npm run build             # prisma generate && tsc, output in dist/
npm start                 # node dist/server.js (production)
npm run migrate:deploy    # prisma migrate deploy (production)

npx prisma migrate dev --name <name>   # apply schema changes and create a migration
npx prisma generate                    # regenerate the client
npx prisma db seed                     # upsert the base enterprise and MASTER user
```

There is no test runner or linter configured (`npm test` is a placeholder that exits 1).

`.env` needs `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (read by `docker-compose.yml`), `DATABASE_URL`, `PORT`, `JWT_SECRET`, `MQTT_BROKER_URL`, `MQTT_USERNAME`/`MQTT_PASSWORD` (the API's broker account) and `MQTT_DEVICE_USERNAME`/`MQTT_DEVICE_PASSWORD` (the boards' shared account); see `.env.example`. The Mosquitto container regenerates its password and ACL files from these on every start (`mosquitto/entrypoint.sh`). Optional: `MQTT_CLIENT_ID` (default `coldchain-api`), `QUARANTINE_TTL_HOURS` (default 2), `SENSOR_OFFLINE_MINUTES` (default 10), `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`) and `TRUST_PROXY` (number of reverse proxies in front of the API). The seed reads `SEED_MASTER_EMAIL`/`SEED_MASTER_PASSWORD` (and optional `SEED_MASTER_NAME`); never hardcode credentials.

Production runs on Render (API and web, `render.yaml` at the repo root), Supabase (Postgres, Session pooler) and EMQX Cloud Serverless (MQTT over TLS); see `docs/DEPLOY.md`. `GET /health` (public) reports database and MQTT state for the Render health check. On `SIGTERM`/`SIGINT`, `server.ts` stops the jobs, closes HTTP connections (including SSE), the MQTT client and Prisma, then exits.

`src/config/env.ts` is the first import of `src/server.ts`: it loads `.env`, and `validateEnv()` stops startup without `DATABASE_URL` or `JWT_SECRET`. With `NODE_ENV=production` it also stops on a `JWT_SECRET` under 32 characters, a missing `CORS_ORIGINS` or MQTT account, a `MQTT_BROKER_URL` without `mqtts://`, or values copied from `.env.example`; in development those only warn. `server.ts` also applies `helmet` and a 100 KB JSON limit, and `src/middlewares/rateLimit.ts` limits `POST /login` and `POST /telemetry/readings` per IP.

This is the `api/` folder of the ColdChain monorepo. The web client in `../web` is its only consumer, so response shapes can change as long as both move together, in the same commit. Its Playwright suite starts this API from `../api`. The ESP32 firmware in `../firmware` is the other side of the MQTT topics and payloads, so changes there also move together.

## Architecture

Requests flow `src/routes/index.ts` → middleware → controller → service → `prisma` from `src/lib/prisma.ts`.

- **Controllers** (`src/controllers/<domain>/`) are classes with a `handle(req, res)` method. They read the request, instantiate the service, and map thrown errors to HTTP responses in a local `try/catch` through `sendError(res, status, error)` (`src/lib/httpError.ts`). It returns the message only for plain `Error`s thrown by services (business rules written for the user); anything else (Prisma, pg, TypeError) is logged and answered with a generic 500, so internal details never leak. Never answer with `error.message` directly. `src/middlewares/errorHandler.ts` is the global handler for `express.json` errors (413, invalid JSON) and anything that escapes a controller.
- **Services** (`src/services/<domain>/`) are classes with a single `execute()` method holding the business logic. They signal failures with `throw new Error(message)`.
- **One class per action**, with file names like `CreateColdUnitController.ts` / `CreateColdUnitService.ts`. Routes are all registered in `src/routes/index.ts`.
- **ESM**: `"type": "module"` with `nodenext` resolution, so relative imports need the `.js` extension. `verbatimModuleSyntax` requires `import type` for type-only imports.

**Auth and tenancy**: `isAuthenticated` verifies the Bearer JWT and sets `req.user` (`id`, `name`, `email`, `role`, `enterpriseId`). `isMaster` and `isAdmin` (ADMIN or MASTER) must run after it. Roles are `MASTER`, `ADMIN` and `OPERATOR`: operators read, resolve alerts and bind boards; admins also manage the units and users of their enterprise; only MASTER manages enterprises and boards. Tenancy is by `enterpriseId` from the token, applied per service rather than centrally, so every new service has to apply it. Routes where MASTER can act on another enterprise use `resolveEnterpriseId` from `src/lib/tenant.ts`, which ignores the requested enterprise for other roles. Tokens are not checked against the database, so a removed user or a changed role only takes effect when the token expires (1 day).

**Dashboard**: `GET /dashboard/summary` returns each unit with its status, computed from the latest reading of each active board: `OUT_OF_RANGE` wins over `NO_SIGNAL`, and one silent board is enough for `NO_SIGNAL`. A board's last contact is `ColdUnitDevice.lastSeenAt`, the arrival time of its last accepted message (store-and-forward data is old but proves the board is alive). Raw SQL here and in `ListTemperatureSeriesService` converts timestamps as UTC text, since the columns have no time zone.

**Devices and associations**: `ColdUnitDevice` is the ESP32 board, owned by an enterprise and identified by a normalized MAC (`src/lib/macAddress.ts`). `AssociationHistory` links a board to a `ColdUnit`; `endDate` null means active. A partial unique index added by hand in the migration, which `schema.prisma` cannot express, allows one active association per board, while a unit can have several boards. `BindDeviceService` is the QR Code handshake: in one transaction it closes the old association, opens the new one and either recovers the board's quarantined data into official readings as `HISTORICAL` or discards it (`quarantine: 'recover' | 'discard'`, optional `recoverFrom`). The new association starts at the first recovered reading, never before the board's previous association ended, so no two associations cover the same time.

**Telemetry**: `IngestTelemetryService` is the single entry point, used by `POST /telemetry/readings` and the MQTT subscriber in `src/services/mqtt/mqttSubscriber.ts` (topics `coldchain/devices/<MAC>/realtime` and `/historical`). Both accept one reading or a batch of up to 500. Boards authenticate with a per-device key (`X-Device-Key` header over HTTP, `key` in the MQTT payload), stored only as a SHA-256 hash in `ColdUnitDevice.apiKeyHash` (`src/lib/deviceKey.ts`); the key is returned once by `POST /devices` and `POST /devices/:id/key`. The Prisma client omits `apiKeyHash` globally, so code that needs it passes `omit: { apiKeyHash: false }`. Ingestion drops data from unknown or inactive boards, rejects a wrong key, sets `lastSeenAt` on the board, then looks up the association in force at each reading's timestamp, not its arrival time. With one, it calls `CreateTemperatureReadingService`, which stores the reading and updates alerts through `applyReadingsToAlerts`. Ingestion and binding run in a transaction holding `lockDevice` (a Postgres advisory lock per board), so concurrent messages from one board never race. `@@unique([deviceId, timestamp])` on readings and quarantine makes resends idempotent (`createManyAndReturn` with `skipDuplicates`; the HTTP route answers 200 `DUPLICATE`).

**Alerts are episodes** (`src/lib/temperatureAlerts.ts`): consecutive out-of-range readings of one board in one unit form a single `Alert`, with `peakTemperature`, `readingsCount`, `startedAt`, `lastReadingAt` and `endedAt` (null while ongoing). `planAlertEpisodes` is pure and decides by time windows, not arrival order, because store-and-forward data arrives late: a reading within `SENSOR_OFFLINE_MINUTES` of an episode joins it (short flaps reopen it), an in-range reading ends it, and silence longer than that ends it at the last reading. `resolvedAt` is the operator's action and also ends the episode, so a continuing excursion opens a new alert. Alerts created before episodes have `deviceId` null. `Alert.type` is `OUT_OF_RANGE` or `SENSOR_OFFLINE`; the latter is opened and closed by `src/jobs/detectOfflineDevices.ts` (every minute) for bound boards silent longer than `SENSOR_OFFLINE_MINUTES`, and has no temperature.

**Live updates**: services call `publishEvent` (`src/lib/eventBus.ts`, an in-memory `EventEmitter`) after their transaction commits, and `GET /events` streams them as Server-Sent Events filtered by enterprise (MASTER gets all). Events only say what changed (`telemetry`, `alerts`, `devices` plus `coldUnitIds`); the web refetches through the usual routes. Being in memory, this assumes a single API instance. Without one, the data goes to `UnboundTelemetry`, which `GET /devices/unbound` reports (`Alert` requires a `coldUnitId`, so it cannot represent this) and `src/jobs/purgeExpiredTelemetry.ts` clears after expiry.

**Soft delete**: `Enterprise`, `User` and `ColdUnit` have `isDeleted`. The client extension in `src/lib/prisma.ts` turns `delete`/`deleteMany` into updates and filters reads, so services call them normally (the explicit `isDeleted: false` in services is redundant). It does not cover `findUnique`, which uniqueness checks rely on to see deleted rows, or relation filters and includes, which need their own `isDeleted: false`. Its `delete` runs outside `$transaction`, so inside a transaction use `update`/`updateMany` with `isDeleted: true`.

## Known incomplete state

The code does not currently match itself in these places; check before relying on them:

- `src/app.ts` and `src/config/auth.ts` are empty (environment config lives in `src/config/env.ts`).
- `req.user` is declared twice with different shapes: `src/@types/express/index.d.ts` (full) and `src/types/express.d.ts` (optional, `enterpriseId` only).
