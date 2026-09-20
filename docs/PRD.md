# Product Requirements Document

## Product
AquaRoute — a live AI infrastructure dashboard, not a chatbot.

## Problem
AI applications default to routing every query through the largest available model, regardless of whether the query needs it. Newer reasoning-heavy models can use up to 20x more energy per query than earlier generations, and that energy mostly becomes heat that data centers remove using large volumes of water. Nobody currently sees this cost, and nobody sees the *decision* being made on their behalf — routing, caching, and resource cost all happen invisibly inside a black box.

## Target Users
Primary: developers/teams building on LLM APIs who want lower cost and resource use without manually picking a model per request.
Demo framing: a dashboard the user directly operates — every visual element reacts to what the router is actually doing on their specific request, in real time. The product is the visibility into the pipeline, not just the chat answers it produces.

## Goal
Make an AI request's full lifecycle — classification, cache check, model selection, resource cost — visible and interactive, so the user directly experiences *why* a decision was made and *what it cost*, rather than being told a summary number after the fact.

## Design Principle
Every feature must react to a real, current pipeline event. Nothing is decorative. If a visual element doesn't change based on what just happened in `/generate`, it doesn't belong in this product.

---

## Feature List — by Build Priority

### Tier 1 — Core Dashboard (must-build for submission)
These make the product feel like infrastructure, not a chat box. Build these first, in roughly this order.

1. **Query classifier** *(built)* — heuristic complexity scoring
2. **Model routing** *(built)* — small/large tier via Gemini
3. **Semantic caching** *(built)* — embedding similarity check
4. **Resource estimator** *(built)* — real token counts → mL water / Wh energy
5. **Live routing visualization** — pipeline diagram (`Prompt → Cache → Classifier → Small/Large Model → Resource Estimator`), current stage highlighted per request
6. **Model decision card** — "Routed to Small" (or Large) + the specific signal that triggered it (prompt length / matched keyword)
7. **Cache status per request** — `MISS → COMPUTED` or `HIT → 0 new computation`, shown inline with the response, not buried
8. **Live resource meter** — water/energy/tokens for the *current* request specifically, separate from running session totals
9. **Savings comparison** — AquaRoute session total vs. always-large baseline, using the pre-measured `compare.js` numbers (see ADR-005), never a live-guessed figure
10. **"What just happened?" expandable** — one expandable per response combining routing reason + cache status + resource math into a single readable trace
11. **Example/demo prompt chips** — one-click prompts spanning simple / complex / cache-hit, for a reliable live demo
12. **Status indicators** — API online, cache active, estimator active (small persistent header strip)
13. **Dark, developer-tool visual aesthetic** — replaces the earlier light-primary direction (see ADR-007 in DECISIONS.md)

### Tier 2 — Session Intelligence (build if Tier 1 is solid with time left)
14. **Session analytics** — request count, small/large ratio, cache hit rate, cumulative savings
15. **Recent request timeline** — scrollable log of every prompt this session with model, tokens, water, cache status
16. **Reset session button** — clears timeline/analytics/live meter, does not affect Benchmark Mode's separate numbers
17. **Animated processing state** — driven by real backend pipeline events over Server-Sent Events, not a timed guess (see ARCHITECTURE.md, ADR-011)
18. **Resource methodology panel** — static panel explaining the per-token rate assumptions and their real limitations

### Tier 3 — Stretch Polish (only with time to spare after Tier 1 + 2 are solid and tested)
19. **Session export** — download the session (timeline + analytics) as JSON/CSV
20. **Benchmark Mode** — shows the 18.1%-style experimental result from `compare.js`, in a clearly separate panel labeled "Measured Benchmark" — never blended into live session numbers
21. **Settings panel** — cache on/off toggle, unit display switch (mL/L, Wh/kWh)
22. **Compare Mode** — send one prompt to both tiers, view both receipts side by side (optional now that the Model Decision Card + Live Resource Meter already justify the routing choice in real time; build only if 1-20 are done)

---

## Out of Scope (unchanged)
- User accounts, authentication, multi-user support
- Payments or pricing tiers
- Multi-user/production database (local SQLite cache persistence is in scope — see ADR-010; this refers to shared/hosted data storage)
- Mobile app
- AI providers beyond Gemini
- Production-scale rate limiting beyond what Gemini's free tier already provides plus basic self-protection (see ARCHITECTURE.md Recommended tier)

## Success Criteria
A user should be able to, without narration:
1. Watch a prompt visibly move through the pipeline diagram as it's processed
2. See a decision card explaining why this specific prompt was routed small or large
3. See the current request's exact resource cost, separately from the running session total
4. See a cache HIT visibly cost 0 on a repeated prompt, immediately, with no explanation needed
5. Open "What just happened?" and get the full trace for any single response
6. See session-wide analytics (ratio, hit rate, savings) updating as they use it
7. Trigger a demo reliably via prompt chips without typing, in under 60 seconds
8. Distinguish, without confusion, between "this session's live numbers" and "the separately measured benchmark result"

## What "Done" Looks Like
Tier 1 fully working end-to-end, tested against `docs/TEST_PLAN.md`, is a complete, honest, interactive hackathon submission. Tier 2 makes it stronger. Tier 3 is credit, not a requirement — don't let it eat time Tier 1 polish and demo rehearsal need.
