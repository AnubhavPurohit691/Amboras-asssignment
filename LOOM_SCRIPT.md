# Loom Script

## Intro

Hi, I’m Anubhav Purohit.

This project is a multi-tenant store analytics dashboard built with:

- Next.js for the frontend
- NestJS for the backend
- PostgreSQL for analytics data
- Redis for caching and live visitor tracking

I’ll quickly show the product, then explain how the system is designed.

## Demo

I’ll start on the login page and sign in with a demo account like `admin@techgear.com`.

After login, I land on the dashboard.

The dashboard shows:

- overview KPIs
- an activity chart
- top products
- recent activity
- live visitors

The key point is that this is not just a dashboard UI. Different widgets use different backend read paths depending on what they need.

## System Overview

The system has four main parts:

- frontend in Next.js
- backend in NestJS
- PostgreSQL for stored events and aggregates
- Redis for cache and live state

There is also a simulator in the backend that keeps generating demo traffic, so the dashboard stays active locally.

## Backend Structure

The backend is split into three modules:

- `AuthModule`
- `AnalyticsModule`
- `SimulatorModule`

`AuthModule` handles login and identifies the user’s store.

`AnalyticsModule` serves the dashboard APIs, caching, and websocket updates.

`SimulatorModule` generates events continuously for the demo.

So the flow is simple:

1. events are generated
2. events are stored
3. analytics are queried
4. live updates are pushed to the client

## Data Strategy

The main design decision is that not every widget reads data the same way.

For overview KPIs, the system uses PostgreSQL aggregates with Redis caching. These numbers are shown often, so they need to be fast.

For top products, the system uses direct SQL queries with indexes plus caching.

For recent activity, the system reads raw events directly because freshness matters most.

For live visitors, Redis keeps short-lived in-memory state, and websockets push updates to the dashboard.

So the read model is:

- pre-aggregated reads for summary metrics
- direct SQL for top products
- raw events for recent activity
- Redis for live counters

## Multi-Tenant Isolation

This is a multi-tenant system, so store isolation is important.

Each user belongs to one store. After login, the backend gets the `store_id` from the authenticated user context.

That means the client does not choose the store on every request. The backend enforces tenant scoping centrally.

This keeps the boundary simple and reduces the chance of cross-tenant access.

## Real-Time Behavior

The simulator creates new events continuously.

Those events update:

- PostgreSQL for stored analytics data
- Redis for live visitor state

Then the websocket gateway sends tenant-scoped updates to connected clients.

That is what makes the dashboard feel live without reloading the page.

## Trade-Offs

A few trade-offs were intentional.

Overview metrics are fast, but they are not perfectly real-time because they rely on aggregates and cache refreshes.

The simulator exists only for the demo. In a production system, I would replace it with a real ingestion API or a queue-based event pipeline.

This project is optimized for clarity and local setup, not for internet-scale analytics.

## Closing

The main value of this project is the system design:

- clear separation between frontend, backend, database, cache, and simulator
- tenant-aware analytics access
- different read strategies for different widgets
- real-time updates where they actually improve the experience

If I extended this further, I would add a proper ingestion pipeline, stronger production auth, and more scalable aggregation.
