# System Design

This document explains how the current Amboras analytics assignment works as a system.

It is intentionally written from the codebase outward, so it describes the design that is actually implemented in this repo, not a hypothetical design.

## 1. Goal of the System

The product is a multi-tenant analytics dashboard for store owners.

Each authenticated store owner should be able to:

- sign in
- view only their own store's analytics
- see overview KPIs
- see top products
- see recent activity
- receive live updates for recent events and visitor counts

The system is optimized for a dashboard workload:

- reads should feel fast
- recent activity should feel live
- aggregate analytics should remain reasonably cheap as data volume grows

## 2. High-Level Architecture

The system has 4 runtime components:

1. Next.js frontend
2. NestJS backend
3. PostgreSQL database
4. Redis cache

There is also one internal background generator:

- a simulator that creates fake store events continuously

At a high level:

```text
Browser
  -> Next.js frontend
  -> NestJS REST API
  -> PostgreSQL / Redis

Browser
  <-> Socket.IO websocket
  <-> NestJS gateway

NestJS simulator
  -> PostgreSQL events table
  -> Redis live visitor state
  -> WebSocket broadcast
```

## 3. Deployment Topology

The repo uses Docker Compose for local development.

Defined services:

- `frontend`
- `backend`
- `postgres`
- `redis`

All services run on the same Compose network.

Important ports:

- frontend: `3000`
- backend: `3001`
- postgres: internal only
- redis: internal only

Why this setup:

- frontend and backend are exposed to the browser
- postgres and redis are intentionally private to the application network
- backend refers to infrastructure by service name: `postgres`, `redis`

## 4. Backend Module Design

The NestJS app is composed of 3 main domains in [app.module.ts](backend/src/app.module.ts):

- `AuthModule`
- `AnalyticsModule`
- `SimulatorModule`

There is also shared infrastructure:

- `ConfigModule`
- `ScheduleModule`
- `TypeOrmModule`

### 4.1 Auth Module

Files:

- [auth.module.ts](backend/src/auth/auth.module.ts)
- [auth.controller.ts](backend/src/auth/auth.controller.ts)
- [auth.service.ts](backend/src/auth/auth.service.ts)
- [jwt.strategy.ts](backend/src/auth/jwt.strategy.ts)

Responsibilities:

- user login
- user registration
- JWT issuance
- JWT validation for protected routes

Design choice:

- authentication is stateless
- the signed JWT carries `sub`, `email`, and `store_id`

Why it matters:

- downstream analytics requests do not need a session lookup
- tenant context is available directly from the token

### 4.2 Analytics Module

Files:

- [analytics.module.ts](backend/src/analytics/analytics.module.ts)
- [analytics.controller.ts](backend/src/analytics/analytics.controller.ts)
- [analytics.service.ts](backend/src/analytics/analytics.service.ts)
- [analytics.gateway.ts](backend/src/analytics/analytics.gateway.ts)

Responsibilities:

- serve analytics REST endpoints
- serve websocket events
- cache dashboard responses
- refresh aggregated analytics periodically

Design split:

- controller handles HTTP entrypoints
- service handles queries, aggregation, caching
- gateway handles websocket connections and fanout

### 4.3 Simulator Module

Files:

- [simulator.module.ts](backend/src/simulator/simulator.module.ts)
- [simulator.service.ts](backend/src/simulator/simulator.service.ts)

Responsibilities:

- generate demo traffic
- create a continuous stream of events
- update live visitor state
- push new events into websocket clients

Why it exists:

- this assignment needs a dashboard that feels active
- the simulator stands in for a real event ingestion pipeline

## 5. Data Model

The database has four main entities:

### 5.1 Stores

File:

- [store.entity.ts](backend/src/entities/store.entity.ts)

Represents a tenant.

Important fields:

- `id`
- `name`
- `slug`

### 5.2 Users

File:

- [user.entity.ts](backend/src/entities/user.entity.ts)

Represents an authenticated dashboard user.

Important fields:

- `email`
- `password_hash`
- `store_id`

Key idea:

- every user belongs to exactly one store
- that `store_id` becomes the tenant boundary for analytics

### 5.3 Products

File:

- [product.entity.ts](backend/src/entities/product.entity.ts)

Represents catalog items within a store.

Important fields:

- `store_id`
- `name`
- `price`

### 5.4 Events

File:

- [event.entity.ts](backend/src/entities/event.entity.ts)

This is the core analytics fact table.

Important fields:

- `store_id`
- `product_id`
- `event_type`
- `revenue`
- `session_id`
- `metadata`
- `created_at`

Supported event types:

- `page_view`
- `add_to_cart`
- `remove_from_cart`
- `checkout_started`
- `purchase`

Why this design works:

- event history is append-heavy
- analytics can be computed from a single fact stream
- product and store dimensions are joined only when needed

## 6. Multi-Tenant Security Model

This is the most important system boundary in the app.

The design is:

1. user logs in
2. backend validates credentials
3. backend issues JWT containing `store_id`
4. protected analytics routes require JWT
5. route handlers derive `store_id` from the authenticated request
6. every analytics query filters by that `store_id`

Relevant files:

- [jwt.strategy.ts](backend/src/auth/jwt.strategy.ts)
- [auth.guard.ts](backend/src/auth/auth.guard.ts)
- [store-id.decorator.ts](backend/src/common/decorators/store-id.decorator.ts)

Why this is good:

- the frontend never chooses the store being queried
- tenant isolation is enforced in the backend
- accidental cross-tenant reads are much harder

Trade-off:

- authorization is simple and coarse-grained
- there are no roles beyond “a user for one store”

## 7. Request Flow

## 7.1 Login Flow

Frontend:

- user submits credentials on [login/page.tsx](frontend/src/app/login/page.tsx)
- frontend calls `POST /api/v1/auth/login`
- frontend stores JWT and user object in localStorage

Backend:

- `AuthService.login()` loads user by email
- password is verified with bcrypt
- JWT is signed and returned

Why this works:

- simple for a take-home
- no session store required

Trade-off:

- localStorage is easy but not the most secure browser storage model for production

## 7.2 Overview Flow

Endpoint:

- `GET /api/v1/analytics/overview`

Flow:

1. request arrives with Bearer token
2. JWT guard authenticates it
3. `store_id` is extracted from the request
4. service checks Redis cache
5. if not cached, service queries PostgreSQL
6. service returns:
   - revenue today
   - revenue this week
   - revenue this month
   - event counts by type
   - conversion rate
   - live visitors
7. response is cached in Redis

Data strategy:

- aggregate revenue and event counts come from the materialized view `event_aggregates_hourly`
- live visitor count comes from Redis

Why this is important:

- overview cards are the hottest read path
- pre-aggregating them avoids scanning raw events repeatedly

## 7.3 Top Products Flow

Endpoint:

- `GET /api/v1/analytics/top-products`

Flow:

1. authenticate request
2. extract `store_id`
3. check Redis cache
4. query events joined to products
5. filter to purchase events
6. group by product
7. sum revenue and count units sold
8. return top 10

Why this query stays direct:

- it is more specific than the overview cards
- for this project scale, direct indexed reads are simple and good enough

Trade-off:

- at much larger scale, this would probably need its own precomputed table or incremental aggregation pipeline

## 7.4 Recent Activity Flow

Endpoint:

- `GET /api/v1/analytics/recent-activity`

Flow:

1. authenticate request
2. query the latest 20 events for the store
3. left join products to show product names where available
4. return the newest items first

Why this is a direct table read:

- freshness is more important than aggregation
- the query is small and bounded

## 8. Real-Time System Design

The real-time layer uses Socket.IO.

Relevant files:

- [analytics.gateway.ts](backend/src/analytics/analytics.gateway.ts)
- [socket.ts](frontend/src/lib/socket.ts)
- [use-socket.ts](frontend/src/hooks/use-socket.ts)

### 8.1 Connection Model

The frontend opens a websocket connection to:

- `/analytics`

The frontend sends the JWT during socket auth.

The backend:

- verifies the token
- extracts `store_id`
- joins the client to a room named `store:{storeId}`

Why rooms matter:

- live traffic is broadcast only to the correct tenant
- clients for different stores do not see each other’s events

### 8.2 Event Types Pushed Over WebSocket

The backend emits:

- `new-event`
- `live-visitors`
- `metrics-update`

How they are used:

- `new-event`: populates recent activity
- `live-visitors`: updates the badge/count
- `metrics-update`: refreshes overview cards

### 8.3 UI Rate Limiting for Recent Activity

The simulator can emit events very quickly.

To keep the dashboard readable, the frontend now buffers incoming `new-event` messages and releases them into the activity feed at a controlled pace.

Why this is a UI-level design decision:

- the backend can keep generating realistic traffic
- the user sees a readable stream instead of a chaotic ticker

Trade-off:

- displayed recent activity is slightly delayed compared to raw arrival time
- but the UX is much better

## 9. Analytics Aggregation Strategy

This repo uses a hybrid approach.

### 9.1 Raw Events

All simulator events are written to the `events` table.

This is the source of truth.

### 9.2 Materialized View

The seed and scheduled job create and refresh:

- `event_aggregates_hourly`

This view groups events by:

- `store_id`
- `event_type`
- hourly time bucket

Stored metrics:

- `event_count`
- `total_revenue`

Why this design is useful:

- overview analytics are repetitive aggregate queries
- aggregating them ahead of time makes reads cheaper
- hourly granularity is enough for dashboard KPI summaries

### 9.3 Scheduled Refresh

The backend refreshes the materialized view every 5 minutes.

This is handled in [analytics.service.ts](backend/src/analytics/analytics.service.ts) using Nest schedule/cron.

Trade-off:

- metrics are not perfectly real-time
- read performance is improved substantially

This is a deliberate dashboard trade-off:

- “fast enough and slightly stale” is often better than “perfectly fresh but expensive”

## 10. Caching Strategy

Redis is used for two different purposes.

### 10.1 Response Cache

Cached endpoints:

- overview: 60 seconds
- top products: 300 seconds

Why:

- dashboard traffic often repeats the same queries
- TTL-based caching is simple and effective

Trade-off:

- cached data can lag behind the database briefly
- but response times improve and database load drops

### 10.2 Live Visitors Store

Redis also tracks live visitors using sorted sets.

Model:

- key: `live_visitors:{storeId}`
- member: `session_id`
- score: current timestamp

How it works:

- every new simulator event refreshes the session timestamp
- old entries are trimmed using a 5-minute window
- current live visitor count is `zcount` over the recent range

Why Redis is a good fit:

- fast ephemeral state
- natural support for sliding windows
- avoids pushing this logic into PostgreSQL

## 11. Database Index Strategy

The events table has composite indexes in [event.entity.ts](backend/src/entities/event.entity.ts):

- `(store_id, created_at)`
- `(store_id, event_type, created_at)`
- `(store_id, product_id, event_type)`

Why these matter:

- recent activity filters by store and time
- top products filters by store and purchase event type
- most analytics are tenant-scoped first

This index design reflects the actual query patterns.

## 12. Frontend System Design

The frontend is a client-rendered dashboard built with Next.js App Router.

Main parts:

- login page
- dashboard page
- fetch hooks
- socket hook
- presentational components

### 12.1 Auth State

Files:

- [auth.ts](frontend/src/lib/auth.ts)
- [api.ts](frontend/src/lib/api.ts)

Design:

- JWT and user are stored in localStorage
- `apiFetch()` automatically attaches the token
- `401` clears auth and redirects to login

### 12.2 Dashboard Composition

File:

- [dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)

The dashboard is assembled from independent widgets:

- header
- KPI cards
- revenue chart
- events chart
- top products table
- recent activity feed
- date range picker

Why this is a good UI design:

- each widget is easy to reason about
- failures are easier to isolate
- the page composes data concerns cleanly

### 12.3 Data Fetching

File:

- [use-analytics.ts](frontend/src/hooks/use-analytics.ts)

Design:

- each analytics domain has its own hook
- hooks manage loading, error, data, and refetch
- socket updates are layered on top

Why this is appropriate here:

- simpler than introducing React Query or SWR
- enough for the scope of a take-home

Trade-off:

- less sophisticated cache management on the client
- more manual state wiring

## 13. Seed Data Design

The seed script in [seed.ts](backend/src/database/seeds/seed.ts) creates:

- 3 stores
- 60 products
- 3 users
- 500,000 historical events
- the materialized view

Why this matters:

- the dashboard needs meaningful data immediately
- realistic event distribution makes the UI believable
- demo credentials are available out of the box

This is effectively the “demo dataset bootstrapping” part of the system design.

## 14. Simulator Design

The simulator is a simplified stand-in for a production event ingestion system.

Current behavior:

- runs on module init when enabled by env
- loads stores and products into memory
- generates weighted random event types
- persists each event
- updates live visitor state
- emits the event to websocket subscribers

Why this approach is acceptable here:

- it keeps the project self-contained
- there is no need for Kafka, queues, or external producers in a take-home

Trade-off:

- it is not production-grade ingestion
- it couples event generation and write path tightly inside the API service

## 15. Performance Story

The system uses several layers to stay responsive:

1. tenant-scoped queries reduce scan size
2. materialized view reduces aggregate query cost
3. Redis caches repeat dashboard reads
4. composite indexes support common filters
5. recent activity is bounded to 20 rows
6. websocket pushes avoid full page polling for every live update

This is not “infinite scale”, but it is a coherent design for the assignment.

## 16. Bottlenecks and Limits

These are the main current system limits.

### 16.1 Top Products Still Reads Raw Events

Good enough now, but this becomes expensive at very large scale.

Future improvement:

- maintain a pre-aggregated product revenue table per store and time bucket

### 16.2 Materialized View Refresh Is Batch-Based

Overview data is not truly real-time.

Future improvement:

- incremental aggregation pipeline
- event bus + projection workers
- streaming counters

### 16.3 Single Backend Process

Websocket room state and simulator logic are process-local.

Future improvement:

- scale Socket.IO horizontally using Redis adapter
- move simulator / ingestion to separate workers

### 16.4 localStorage Auth

Simple, but not ideal for production security.

Future improvement:

- HTTP-only cookies
- refresh tokens
- CSRF protection strategy

### 16.5 `synchronize: true`

Convenient for development, risky for production.

Future improvement:

- TypeORM migrations

## 17. Summary

The design is built around one core idea:

- raw events are the source of truth
- different dashboard widgets read from different serving layers depending on what they need

That split looks like this:

- overview KPIs: PostgreSQL materialized view + Redis cache
- top products: direct indexed SQL + Redis cache
- recent activity: latest raw events
- live visitors: Redis sorted set
- live UI updates: Socket.IO rooms
- tenant isolation: JWT-derived `store_id`

## 18. Architecture Diagram

```text
                         +----------------------+
                         |      Browser         |
                         |  Next.js dashboard   |
                         +----------+-----------+
                                    |
                     HTTP /api/v1   |   WebSocket /analytics
                                    |
                +-------------------+-------------------+
                |                                       |
                v                                       v
      +----------------------+               +----------------------+
      |   NestJS REST API    |               | Socket.IO Gateway    |
      | auth + analytics     |               | per-store rooms      |
      +----------+-----------+               +----------+-----------+
                 |                                      |
                 |                                      |
                 +------------------+-------------------+
                                    |
                    +---------------+----------------+
                    |                                |
                    v                                v
          +----------------------+         +----------------------+
          |     PostgreSQL       |         |        Redis         |
          | stores/users/        |         | cache + live visitor |
          | products/events      |         | sliding window       |
          +----------+-----------+         +----------------------+
                     |
                     v
          +----------------------+
          | event_aggregates_    |
          | hourly materialized  |
          | view                 |
          +----------------------+


          +-----------------------------------------------+
          |           Simulator Service                   |
          | generates events -> writes DB -> updates      |
          | Redis live state -> emits websocket events    |
          +-----------------------------------------------+
```

## 19. Scaling Considerations: 100M Events

At 100M events, the current design would start to show stress, especially around:

- direct raw-event queries for top products
- refresh cost of the materialized view
- single-process websocket fanout
- database write/read contention if ingestion grows a lot

Here is how I would evolve it.

### 19.1 Ingestion Architecture

Current:

- simulator writes directly into PostgreSQL

Next step:

- introduce an ingestion API or event producer
- publish events into a queue or log such as Kafka, SQS, or Redis Streams
- process them asynchronously with worker services

Why:

- decouples write spikes from API latency
- allows replay and backpressure handling
- makes aggregation pipelines cleaner

### 19.2 Aggregation Strategy

Current:

- hourly materialized view for overview only

At 100M events:

- move from refresh-based materialized views to incremental rollups
- maintain aggregate tables like:
  - `store_hourly_metrics`
  - `store_product_hourly_metrics`
  - `store_daily_metrics`

Why:

- refreshing a large materialized view becomes expensive
- incremental updates spread the cost across ingestion time

### 19.3 Database Layout

Current:

- one PostgreSQL instance with indexed fact table

At larger scale:

- partition `events` by time
- possibly partition by tenant for large enterprise stores
- use read replicas for analytics-heavy workloads

Why:

- reduces scan ranges
- improves retention and archiving
- isolates operational and analytical load better

### 19.4 Caching and Serving Layer

Current:

- Redis TTL caching

At larger scale:

- keep Redis for hot cache
- consider a dedicated analytical serving layer for frequently accessed metrics
- possibly add per-tenant cache invalidation or event-driven cache warming

Why:

- TTL-only caching is simple, but not always enough when query cost becomes high

### 19.5 Real-Time Architecture

Current:

- one backend process keeps socket room state in memory

At larger scale:

- use Socket.IO Redis adapter
- run multiple backend instances
- publish live updates via Redis pub/sub or streaming infrastructure

Why:

- in-memory room membership does not scale across instances by itself

### 19.6 Auth and Tenant Model

Current:

- JWT includes `store_id`

At larger scale:

- keep the same tenant propagation model
- add role-based permissions within a store
- support organization-level users with access to multiple stores

Why:

- the current store-scoped model is good, but product requirements usually grow

### 19.7 What I Would Keep

Even at 100M events, some current decisions are still correct:

- tenant context derived from auth
- Redis for ephemeral real-time state
- separating fresh activity reads from aggregate KPI serving
- websocket room-based fanout

So the scaling plan is not “throw everything away” — it is “keep the boundaries, replace the heavy internals”.
