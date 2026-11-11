# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Monorepo of a cold chain monitoring system. Each part has its own tooling and its own CLAUDE.md:

- `api/`: Express 5 + Prisma 7 REST API, Mosquitto broker and PostgreSQL via `docker compose`. See `api/CLAUDE.md`.
- `web/`: React PWA, the API's only consumer. See `web/CLAUDE.md`.
- `firmware/`: ESP32 PlatformIO project (`pio run`). Credentials live in `include/secrets.h`, which is git-ignored; never commit it.
- `docs/`: system architecture (`ARQUITETURA.md`) and detailed API documentation, in Portuguese.

The three parts share contracts: API response shapes (api ↔ web) and MQTT topics and payloads (api ↔ firmware). Change both sides in the same commit and update `docs/` when behavior changes. Run commands from the part's own folder; there is no root `package.json`.
