# Docker Dev Environment

Run the full OP stack locally using only Docker Desktop — no Node.js, pnpm, or Supabase CLI required on your host machine.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS or Linux)
- Nothing else — all tools run inside containers

## Quick Start

```bash
docker compose up
```

This starts four services:

| Service | URL | Description |
|---------|-----|-------------|
| app (Next.js) | http://localhost:3100 | Main frontend |
| api (tRPC) | http://localhost:3300 | API server |
| Supabase Studio | http://localhost:54323 | Database admin UI |
| Supabase API | http://localhost:54321 | PostgREST / Auth / Storage |
| Postgres | localhost:54322 | Direct database access |
| Inbucket | http://localhost:54324 | Local email testing |
| Redis | localhost:6379 | Cache / pub-sub |

The first run builds the Docker image and downloads all dependencies — this may take a few minutes. Subsequent starts are fast.

## Changing the App Port

Pass `APP_PORT` to use a different host port for the Next.js app:

```bash
APP_PORT=4000 docker compose up
```

The app will be available at http://localhost:4000.

## Environment Variables

A pre-filled `.env.docker` file at the repo root contains all required variables with safe local dev defaults. No manual configuration is needed for local development.

To customise variables, copy the annotated example file:

```bash
cp .env.docker.example .env.docker
```

Then edit `.env.docker` as needed. The file is committed to git and safe to share — it contains only well-known Supabase local dev defaults, not real secrets.

## Hot Reload

The repo root is bind-mounted into both the `app` and `api` containers. Editing any source file on your host triggers an immediate reload inside the container — no restart needed.

`node_modules` and `.next` directories use named Docker volumes so the container's installed packages are not overwritten by the bind mount.

## Teardown

Stop all services (data is preserved in Docker volumes):

```bash
docker compose down
```

Stop and **wipe all data** (database, Redis, build caches):

```bash
docker compose down -v
```
