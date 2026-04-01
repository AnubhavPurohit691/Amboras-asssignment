# Store Analytics Dashboard

Multi-tenant eCommerce analytics dashboard built with NestJS, Next.js, PostgreSQL, and Redis.

## What This Project Does

This project solves the assignment as a tenant-scoped store analytics dashboard with:

- JWT-based authentication
- strict store-level data isolation
- overview KPIs for revenue, event counts, conversion rate, and live visitors
- top products by revenue
- recent activity feed
- date range filtering
- WebSocket-based live updates
- seeded demo data and a simulator so the dashboard feels active locally

## Core Features Implemented

### Backend

- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/top-products`
- `GET /api/v1/analytics/recent-activity`
- JWT auth with tenant scoping by `store_id`
- request validation with Nest validation pipes
- Redis caching for repeated analytics reads
- PostgreSQL materialized view for overview KPI aggregation

### Frontend

- login flow with demo accounts
- responsive analytics dashboard
- loading and error states
- charts and product/activity widgets
- live recent activity and live visitor updates over WebSockets
- date range presets and custom date filtering

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Setup

1. **Clone and install:**
```bash
git clone <repo-url>
cd amboras-analytics

# Start infrastructure
docker compose up -d

# Backend
cd backend
cp .env.example .env   # or use defaults
npm install
npm run seed           # Seeds 3 stores, 60 products, 500K events
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

2. **Open http://localhost:3000**

3. **Login with demo credentials:**
   - `admin@techgear.com` / `password123`
   - `admin@fashionhub.com` / `password123`
   - `admin@homeessentials.com` / `password123`

### Environment Variables

Root `.env.example` contains the variables needed for local development:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `BACKEND_PORT`
- `FRONTEND_URL`
- `NEXT_PUBLIC_API_URL`
- `ENABLE_SIMULATOR`
- `SIMULATOR_EVENTS_PER_SECOND`

## How The System Works

At a high level:

1. A store admin logs in and receives a JWT.
2. The JWT contains the user’s `store_id`.
3. Protected analytics endpoints derive tenant context from that JWT.
4. Overview KPIs are served from a PostgreSQL materialized view plus Redis cache.
5. Recent activity reads the latest raw events directly for freshness.
6. Live visitors and new events are pushed over Socket.IO.

That means the system uses different serving paths depending on the widget:

- overview cards: pre-aggregated + cached
- top products: indexed SQL + cached
- recent activity: raw event feed
- live visitors: Redis sliding window

For the full architecture walkthrough, see [SYSTEMDESIGN.md](SYSTEMDESIGN.md).

## Architecture Decisions

### Data Aggregation Strategy

**Decision:** Hybrid aggregation using a PostgreSQL materialized view for overview metrics and direct indexed queries for recent activity/top products.

**Why:** The dashboard’s overview cards need to feel consistently fast, so I pre-aggregate hourly event counts and revenue into `event_aggregates_hourly` and query that view in `GET /api/v1/analytics/overview`. For `recent-activity`, freshness matters more than aggregation, so it reads directly from the events table. For `top-products`, a filtered purchase query over indexed data is still simple and fast at this project’s scale.

**Trade-offs:** The overview can be a few minutes stale between materialized view refreshes, but query latency stays low as event volume grows. This is a deliberate speed-over-perfect-freshness choice for dashboard analytics.

### Real-time vs. Batch Processing

**Decision:** Hybrid approach. Historical and aggregate analytics are served from PostgreSQL, while recent events and live visitor signals are pushed over WebSockets.

**Why:** Full real-time aggregation for every metric would add a lot of complexity for a take-home. Instead, WebSockets provide the “live” feel where it matters most, and PostgreSQL handles the durable analytics workload.

**Trade-offs:** This keeps the system understandable and fast enough for the assignment, but aggregate metrics are not strictly real-time because the materialized view is refreshed periodically.

### Frontend Data Fetching

**Decision:** Client-side REST fetching with lightweight custom hooks, plus WebSocket subscriptions for live updates.

**Why:** This keeps data flow easy to trace during the take-home. REST endpoints provide the initial dashboard state, and WebSocket events layer in live updates without requiring a more opinionated client cache.

**Trade-offs:** This is more manual than using React Query or SWR, but the data flow is easier to explain and control for a small scoped assignment.

### Performance Optimizations

1. **Materialized view for overview metrics** — Hourly aggregates avoid repeatedly scanning raw events for KPI cards.
2. **Composite indexes** — `(store_id, created_at)`, `(store_id, event_type, created_at)`, `(store_id, product_id, event_type)` support the main query patterns.
3. **Redis TTL caching** — Overview is cached for 60 seconds, top products for 5 minutes.
4. **Batch inserts in the seed** — Historical demo data loads efficiently instead of row-by-row.
5. **WebSocket rooms by store** — Real-time traffic is scoped to the authenticated tenant.

## Known Limitations

- **Materialized view staleness:** Overview metrics can be up to 5 minutes stale between refreshes.
- **Top products still query raw events:** This is acceptable for the current scale, but would likely need its own aggregate table at much larger volume.
- **No event ingestion API:** Events come from simulator only. Production would need `POST /api/v1/events` or a message queue (Kafka, SQS).
- **Single-node:** No horizontal scaling. Production needs read replicas, Redis Cluster, and Socket.IO sticky sessions or Redis adapter.
- **Simple JWT + localStorage auth:** Fine for a demo, but I would move to HTTP-only cookies and refresh tokens for production.
- **No rate limiting:** Auth endpoints have no brute-force protection.
- **TypeORM `synchronize: true`:** Convenient for development, but should be replaced with migrations in production.

## With More Time

- Event ingestion API with rate limiting
- Incremental aggregation for top products and richer KPI slices
- Refresh token rotation
- TimescaleDB or partitioned rollup tables for much larger event volume
- Redis adapter for Socket.IO horizontal scaling
- Dashboard widget customization (drag-and-drop)
- CSV/PDF export
- Email alerts on anomalous metrics
- E2E tests with Playwright

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, TypeORM, Socket.io |
| Frontend | Next.js (App Router), Tremor, Tailwind CSS |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (Passport.js) |
| Infra | Docker Compose |

## Project Structure

```
amboras-analytics/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   └── src/
│       ├── auth/          # JWT auth (login, register, guard)
│       ├── analytics/     # Endpoints + WebSocket gateway
│       ├── simulator/     # Background event generator
│       ├── entities/      # TypeORM entities
│       └── database/seeds # Seed script
└── frontend/
    └── src/
        ├── app/           # Pages (login, dashboard)
        ├── components/    # Dashboard UI components
        ├── hooks/         # Data fetching + WebSocket hooks
        └── lib/           # API client, auth, socket
```

## Video Walkthrough

Add your Loom/YouTube link here before submission.

Suggested walkthrough structure:

1. Demo the login flow and dashboard.
2. Show tenant isolation and the seeded demo accounts.
3. Walk through the analytics aggregation path and caching strategy.
4. Show the live activity / websocket behavior.
5. End with trade-offs, limitations, and what you would improve with more time.

## Time Spent

Approximately 4 hours
