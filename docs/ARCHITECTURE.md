# Architecture

Tiered the same way as PRD.md — **Core** is what makes the dashboard actually work well; **Recommended** is genuine best practice that's cheap enough to include; **Stretch** is real engineering that only belongs here if Core and Recommended are done and tested with time to spare. Do not start Stretch items before Core is finished 
---



---

## Architecture Diagram (Core)

``` 
User
  ↓
Frontend (dashboard: pipeline viz, decision card, live meter, timeline, analytics)
  ↓
POST /generate  ──opens──▶  GET /generate/stream (SSE, same request id)
  ↓
[stage: received]        → pushed over SSE immediately
  ↓
Classifier (length + keyword signals) → routingReason
[stage: classified]      → pushed over SSE
  ↓
Cache check (embedding similarity, SQLite-backed store)
  ├── HIT  → [stage: cache_hit]  → pushed, skip to response
  └── MISS → [stage: cache_miss] → pushed
              ↓
        Gemini API call (small or large model), with retry/backoff (Recommended)
        [stage: model_call_start] → pushed
        [stage: model_call_done]  → pushed
              ↓
        Resource estimate (rate table × real token count)
        [stage: estimated] → pushed
              ↓
        Store in cache (SQLite)
  ↓
Final response body: { tier, response, tokens, cached, cacheStatus, estimate, routingReason, requestId }
[stage: complete] → pushed over SSE, stream closes
  ↓
Frontend: pipeline diagram highlights each stage live, decision card + resource meter
           populate as data arrives, session analytics/timeline update on completion
```

**Why SSE, not WebSockets:** the data only ever flows server → client (pipeline stage updates); the client never needs to push anything mid-request. SSE is simpler to implement and debug than a WebSocket connection for a one-directional stream, and works over plain HTTP.

**Why the request is split into POST + SSE stream:** the POST kicks off the pipeline and returns a `requestId` immediately; the frontend opens `GET /generate/stream?id=requestId` to receive staged updates as they actually happen, then reads the final result either from the last SSE event or a final POST response — pick one pattern and use it consistently (recommend: SSE carries everything, POST just triggers).

---

## Core (build first)

1. **Modular backend structure**
   ```
   server/
   ├── index.js           # app setup, middleware, route mounting
   ├── routes/
   │   └── generate.js    # POST /generate + GET /generate/stream
   ├── services/
   │   ├── classify.js
   │   ├── callModel.js
   │   ├── cache.js
   │   └── estimate.js
   ├── middleware/
   │   ├── errorHandler.js
   │   └── validateRequest.js
   └── config/
       └── index.js       # loads + validates env vars once, fails fast if missing
   ```
   Reason: keeps route handling, business logic, and cross-cutting concerns (errors, validation) separated — makes it possible for an AI coding tool (or you) to change one piece without touching the others, per RULES.md's "don't modify unrelated files" principle.

2. **Fail-fast config validation** — on server start, check `GEMINI_API_KEY` exists and is non-empty; exit with a clear error immediately if not, rather than failing on the first request.

3. **Centralized error handling middleware** — every route's errors flow to one Express error handler that logs the error and returns a clean JSON error shape (`{ error: string, code: string }`), never a raw stack trace to the client.

4. **Input validation middleware** — reject empty/non-string/oversized (`>2000` char) prompts with a 400 before they reach the classifier or cost an API call.

5. **`/health` endpoint** — returns `{ apiReachable: bool, cacheActive: bool }`. This is what the frontend's Status Indicators (PRD Tier 1, feature 12) should actually poll — real backend state, not a hardcoded "online" badge.

6. **SSE pipeline streaming** — see diagram above. This is what makes the Animated Processing State (PRD Tier 2, feature 17) real instead of a timed guess, and directly powers the Live Routing Visualization (PRD Tier 1, feature 5).

---

## Recommended (build if Core is solid)

7. **Retry with exponential backoff on Gemini calls** — a 429 or transient 5xx from Gemini should retry (e.g. 2 retries, exponential delay) before surfacing an error to the user. Directly protects your live demo from the free-tier rate limit killing a request mid-pipeline.

8. **SQLite-backed cache** (`better-sqlite3`) — replaces the in-memory array from ADR-003 so the cache survives a server restart mid-hackathon (crash, dependency change, accidental Ctrl+C). Still a single local file, still not a "real database" in the production sense — this is resilience, not scale.

9. **Structured logging** — use `console.log` with a consistent shape (`{ timestamp, requestId, stage, durationMs }`) for each pipeline stage server-side. Cheap to add, makes debugging a broken demo run far faster than scattered `console.log("here")` calls.

10. **Basic request rate limiting on your own `/generate` endpoint** (`express-rate-limit`) — protects your own Gemini quota from being accidentally exhausted by, e.g., a judge mashing the send button or a runaway frontend retry loop.

11. **Security headers** (`helmet`) — cheap, standard, no reason to skip it.

12. **Node's built-in test runner** (`node:test`, no extra dependency) for unit tests on `classify.js` and `estimate.js`, matching TEST_PLAN.md's classifier/estimate checks. Keep it to the pure-logic files — don't try to unit-test the Gemini API calls themselves; that's what your manual TEST_PLAN.md checks are for.

---

## Stretch (only with real time left, after Core + Recommended are tested)

13. **Graceful shutdown handling** — on `SIGINT`/`SIGTERM`, close the SQLite connection and in-flight SSE streams cleanly rather than hard-killing them.

14. **Response compression** (`compression` middleware) — negligible benefit at this traffic scale; include only if you're already adding other middleware and want the checklist-complete version.

15. **Deployment beyond localhost** (Render/Railway free tier, or similar) — only relevant if you want the demo reachable outside your own laptop. Requires moving `GEMINI_API_KEY` into the host's environment variable config (never in a committed file) and re-testing rate-limit behavior on a fresh environment. Not required for an in-person hackathon demo.

---

## Folder Structure (Core)

```
aquaroute/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── TEST_PLAN.md
│   ├── SECURITY.md
│   ├── DECISIONS.md
│   └── MEMORY.md
├── public/
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── api.js          # fetch + SSE connection handling
│       ├── pipeline.js      # pipeline diagram rendering/animation
│       ├── dashboard.js     # decision card, live meter, analytics, timeline
│       └── app.js           # wires the above together
├── server/
│   ├── index.js
│   ├── routes/
│   │   └── generate.js
│   ├── services/
│   │   ├── classify.js
│   │   ├── callModel.js
│   │   ├── cache.js
│   │   └── estimate.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validateRequest.js
│   └── config/
│       └── index.js
├── tests/
│   ├── classify.test.js
│   └── estimate.test.js
├── experiments/
│   ├── prompts.json
│   └── compare.js
├── data/
│   └── cache.sqlite         # gitignored — local only
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Architectural Rules

- The API key never reaches the frontend — all Gemini calls happen server-side in `server/services/callModel.js` and `cache.js`.
- The frontend never talks to the Gemini API directly — only to local `/generate`, `/generate/stream`, and `/health`.
- Resource-rate assumptions live in exactly one place (`estimate.js`) — never hardcode a water/energy number elsewhere, frontend included.
- The classifier stays a pure function (prompt in, tier + reason out) — no API calls inside it, no side effects.
- Route handlers stay thin — business logic lives in `services/`, not inline in `routes/generate.js`.
- Every new backend error path goes through the central error handler — no ad hoc `res.status(500).send(...)` scattered in route files.
- `data/cache.sqlite` is gitignored, same as `.env` — it's local state, not source.
