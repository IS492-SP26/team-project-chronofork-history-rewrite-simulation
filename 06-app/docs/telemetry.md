# ChronoFork — Telemetry & Observability

## 1. Event Logging (Server-Side)

### Log Format

Every session writes a TSV file to `Chrono-Server/logs/{MM-DD_HH-MM}.tsv`.

Columns:

| Column | Type | Description |
|--------|------|-------------|
| `Timestamp` | `HH:MM:SS` | Wall-clock time of event |
| `Component` | string | Emitting module (see below) |
| `Event` | string | Event type (see below) |
| `Summary` | string | Human-readable one-line description |
| `Payload` | JSON string | Full machine-readable data |

Example rows:

```
Timestamp	Component	Event	Summary	Payload
09:12:03	CastEngine	StateChange	Node advanced to 2.0	{"node_id": "2.0", "stage": 1}
09:12:05	Agent	LLM_Input	Kennedy prompt sent	{"messages": [...], "model": "gpt-5.1"}
09:12:07	Agent	LLM_Output	Kennedy response received	{"content": "We must not...", "tokens": 84}
09:12:08	StoryEngine	FunctionCall	backtrack_to called	{"target_id": "1.0", "perspective": "Khrushchev"}
09:12:10	CastEngine	StateChange	Divergence branch created	{"branch_id": "2.1", "plausibility": "high"}
```

### Component Tags

| Component | What it covers |
|-----------|---------------|
| `CastEngine` | Orchestration: node start/end, stage transitions, divergence |
| `StoryEngine` | Graph mutations: backtrack, branch creation, path updates |
| `Agent` | Per-character LLM input/output |
| `Facilitator` | Facilitator LLM input/output |
| `ReflectionWorker` | Reflection report generation |
| `LLMCache` | Cache hit/miss, API calls |
| `WebSocket` | Connection, disconnect, message receipt |

### Event Types

| Event | Meaning |
|-------|---------|
| `StateChange` | Engine or graph state mutation |
| `LLM_Input` | Prompt sent to OpenAI (messages array + model) |
| `LLM_Output` | Full response received |
| `CacheHit` | Prompt served from disk cache |
| `CacheMiss` | Cache miss → API call initiated |
| `FunctionCall` | Internal method invoked |
| `Error` | Exception caught |

---

## 2. LLM Request Caching

The `LLMCache` layer (`server/utilities/llm_cache.py`) provides transparent caching:

- **Key:** MD5 hash of `{model, messages}` JSON (sorted keys)
- **Store:** `diskcache.Cache("./cache")` — SQLite-backed, persists across restarts
- **Hit rate indicator:** printed to stdout as `⚡ [Cache Hit] <key_prefix>` or `🌐 [API Call] <key_prefix>`

This doubles as a development observability tool: watching stdout shows exactly which prompts are being called vs. served from cache.

---

## 3. How to Debug a Test Case

### Step 1 — Reproduce with cache enabled

Run the server normally. The cache ensures identical prompts return identical responses, making bugs reproducible:

```bash
python server_app.py --lang en
```

### Step 2 — Locate the log file

```bash
ls -lt Chrono-Server/logs/
# newest file = most recent session
```

### Step 3 — Filter for a specific component

```bash
grep -P "^[^\t]+\tAgent\t" logs/04-08_09-12.tsv
```

Or open in any spreadsheet tool (Excel, Numbers, Google Sheets) — it's tab-separated.

### Step 4 — Inspect LLM inputs/outputs

Look for `LLM_Input` rows — the `Payload` column contains the exact `messages` array sent to OpenAI. Paste into a Python script or the OpenAI playground to replay.

### Step 5 — Check cache hits

If the same prompt always hits the cache, clear it to force a fresh API call:

```bash
rm -rf Chrono-Server/cache/
```

### Step 6 — Trace a divergence failure

Search for `StateChange` events with `"divergence"` in the payload:

```bash
grep "divergence" logs/04-08_09-12.tsv
```

If no `divergence_complete` appears after a `divergence_in_progress`, check the `Agent` `Error` rows around the same timestamp.

---

## 4. Key Metrics to Watch

| Metric | Where to find it | Why it matters |
|--------|-----------------|---------------|
| Cache hit rate | stdout `⚡` vs `🌐` lines | High miss rate → unexpected prompt variation or cache cleared |
| LLM response time | Timestamp diff between `LLM_Input` and `LLM_Output` | Latency spikes affect streaming UX |
| Divergence rate | Count of `divergence_complete` events per session | Proxy for user engagement depth |
| Backtrack count | Count of `backtrack_to` `FunctionCall` events | Indicates replays / exploration depth |
| Error rate | `Error` event rows | Any non-zero value needs investigation |

---

## 5. Frontend Observability

The Next.js frontend does not persist its own logs. For browser-side debugging:

- **WebSocket frames**: Open DevTools → Network → WS → filter by `/ws` — all frames are visible in real time
- **React state**: Redux DevTools equivalent via React Context — add `console.log` to `state/reducer.ts` or use React DevTools browser extension
- **Phase transitions**: Add `console.log(action.type, state.phase)` in the reducer for flow tracing

---

## 6. Production Logging Gaps & Recommendations

Currently missing from the production setup (improvements for future work):

| Gap | Recommendation |
|----|---------------|
| No centralized log aggregation | Add stdout → Loki / CloudWatch / Papertrail export |
| No request ID correlation | Assign a `session_id` per WebSocket connection; include in all log rows |
| No latency metrics exported | Wrap `cached_chat_create` with a timing decorator; emit to Prometheus or log |
| Frontend has no error boundary telemetry | Add Sentry or equivalent for unhandled React exceptions |
| Logs are local to server process | Mount `logs/` as a persistent volume or stream to object storage in production |
