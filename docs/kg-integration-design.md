# KG Integration Design — Tech Tree ↔ Fusion Knowledge Graph

**Status:** proposal
**Scope:** enrich the Vercel-hosted tech tree (`gaia-tt`) with literature/findings from the Neo4j fusion KG (`fusion_kg_builder`) and back the chat with GraphRAG on that KG, using self-hosted open models instead of Gemini.

---

## 1. Goals & constraints

- Clicking a tech tree node (e.g. *tokamak*) shows additional nodes/edges from the KG — papers, devices, findings — with metadata and references.
- Chat answers are grounded in the KG (papers, experiments, measurements, findings) via graph traversal, not just the static tech tree context.
- Chat can drive the UI: zoom to / filter / highlight nodes based on conversation context.
- A "science mode" provides a second, tech-tree-independent canvas where the chat maps claims, papers and contradictions as a live evidence graph.
- **Split by access pattern:**
  - **Overlay → materialized projection.** A builder job precomputes per-node enrichment docs into MongoDB via Cypher traversal. Click latency ~ single-digit ms, zero runtime dependency on the uni server. Rebuilt incrementally when the KG changes.
  - **Chat → live KG.** GraphRAG needs real traversal (vector search, multi-hop, agentic cypher). Goes through the tunnel to the fat service.
- The KG lives on a university server reachable only via a tunnel; the app must degrade gracefully when it is unreachable.
- Move chat off Gemini → open models (qwen3:27b or similar, via Ollama on the uni server — the same host that already serves embeddings for KG construction).

## 2. Architecture overview

```
┌─────────────┐   HTTPS    ┌──────────────────────────┐
│   Browser    │ ────────► │  Vercel (Next.js app)     │
│              │           │                           │
│  React Flow  │ ◄──────── │  /api/chat  ──────────────┼──► live tunnel ──► kg-service
│  + overlay   │           │  /api/kg    ──────────────┼──► MongoDB (materialized)
│              │           │  /api/kg/paper ───────────┼──► MongoDB (materialized)
└─────────────┘            └──────────────────────────┘
                                        ▲
                                        │ pymongo upsert
┌───────────────────────────────────────────────────────────────────────────┐
│  University server                                                        │
│                                                                            │
│  ┌──────────────────┐   hook    ┌──────────────────┐                      │
│  │  main.py (ingest) │ ───────► │  enrich.py        │ ──► MongoDB Atlas    │
│  │  KG builder       │ paperIds │  (materializer)   │     kg_node_enrich…  │
│  └──────────────────┘          └────────┬─────────┘     kg_papers         │
│                                         │                                 │
│  ┌──────────────────┐          ┌────────▼─────────┐   ┌───────────┐       │
│  │  kg-service       │ ◄──bolt──│  Neo4j 5          │   │  Ollama   │       │
│  │  (FastAPI, chat)  │          │  + vector index   │   │ qwen3 +   │       │
│  │  /chat /search …  │ ◄─http───│                   │   │ embedder  │       │
│  └──────────────────┘          └──────────────────┘   └───────────┘       │
│         ▲                                                                 │
│  cloudflared (named tunnel → kg.yourdomain.org)                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key decisions**

| Decision | Choice | Why |
|---|---|---|
| Overlay data path | **Materialized Mongo docs** (`kg_node_enrichment`, `kg_papers`) | Literature data is static; clicks must be instant; overlay keeps working when the server/tunnel is down. |
| Chat data path | **Live via tunnel → kg-service** | Agentic traversal, vector search, multi-hop queries can't be flattened; freshness matters. |
| Where the agent loop lives | **On the uni server** ("fat service") | Model, embeddings and graph are colocated. Small models produce chattier loops; per-iteration tunnel round-trips + Vercel timeouts are pure cost. |
| Rebuild trigger | **Post-ingest hook** emitting changed `paperId`s → partial rebuild | KG only mutates during `main.py` ingestion → no CDC needed; the pipeline knows exactly what changed. Manual + scheduled diff as backstops. |
| Tunnel | **Cloudflare Tunnel** (`cloudflared`) | Free stable hostname (`kg.yourdomain.org`), no URL churn (ngrok free rotates). Only needed for chat + admin rebuild triggers — the overlay no longer depends on it. |
| Expansion logic | **One implementation, two callers** | `enrich.py` and `kg-service /expand` share the same resolution+cypher module → live mode = free fallback/dev tool. |
| Neo4j exposure | **Never directly** | Only the FastAPI service talks bolt; dedicated read-only user. Builder can use the same read-only user. |
| LLM | qwen3:27b via Ollama (existing) | Already deployed for KG building/chat. Swap later without API changes (vLLM/llama.cpp if throughput becomes an issue). |

## 3. Components

### 3.1 kg-service (FastAPI — lives in `fusion_kg_builder` or its own repo)

Service wrapping the retrieval logic from `chat.py`. Runs in Docker on the uni server. With the overlay materialized, this service only needs to serve **chat** + admin/debug tooling — `/expand` remains as a live fallback and the shared implementation used by the builder.

#### Endpoints

| Method | Path | Purpose | Used by |
|---|---|---|---|
| GET | `/healthz` | Neo4j + Ollama connectivity check | monitoring, Vercel proxy guard |
| POST | `/resolve` | Entity linking: free text → KG entity candidates | builder, chat tools |
| GET | `/expand?entity=<name>&depth=` | Enrichment subgraph for one entity | **builder internals / live fallback** |
| GET | `/paper/{paperId}` | Full paper dossier (bibliography + findings) | **builder internals / live fallback** |
| POST | `/search` | Deterministic GraphRAG retrieval (vector → chunks → entities → facts) | chat |
| POST | `/cypher` | Execute read-only Cypher `{query, params}` | chat agent tool |
| GET | `/neighbors?label=&name=` | 1-hop neighborhood expansion | chat agent tool |
| POST | `/chat` | Full pipeline: retrieve → (bounded agent loop) → stream answer | chat via `/api/chat` |
| POST | `/admin/rebuild` | Trigger partial/full materialization `{paperIds?|nodeIds?|all?}` | ops, post-ingest hook |

Auth on everything except `/healthz`: `Authorization: Bearer <KG_SERVICE_TOKEN>`.

#### `/resolve` — entity linking

```json
// request
{ "text": "tokamak", "limit": 5 }
// response
{ "candidates": [
    { "name": "tokamak", "labels": ["MagneticConfiguration"], "score": 0.94 },
    { "name": "T-3",     "labels": ["FusionDevice"],          "score": 0.71 } ] }
```

Implementation: embed all entity `name` properties once into a second Neo4j vector index (or in-memory index), cosine-match the query, plus exact/prefix string match. Curated overrides can still live in Mongo (`kg_entity_map`, see §6).

#### `/expand` — enrichment subgraph (shared with builder)

```json
// GET /expand?entity=tokamak
{ "entities": [
    { "id": "paper:IAEA-CN-28-H-1", "kind": "paper", "name": "…",
      "paper": { "paperId": "IAEA-CN-28-H-1", "title": "…", "year": 1971,
                 "conference": "4th IAEA Conf., Madison", "authors": ["…"],
                 "institute": "…", "studyKind": "experimental" },
      "relation": "evidenced_by" },
    { "id": "device:tuman-2", "kind": "device", "name": "Tuman-2",
      "device": { "majorRadius": "…", "configurationType": "stellarator" },
      "relation": "instance_of" } ],
  "meta": { "resolved_entity": "tokamak", "labels": ["MagneticConfiguration"], "truncated": false } }
```

Resolution logic per entity kind (ontology-aware, not just name matching):

- `MagneticConfiguration` (e.g. "tokamak", "stellarator") → `FusionDevice -[:HAS_CONFIGURATION]->` it → `Experiment -[:PERFORMED_ON]->` device → `Paper -[:REPORTS_ON]->` experiment.
- `HeatingMethod` subclass (e.g. "UHF heating") → `Experiment -[:USES_HEATING_METHOD]->` → papers; also `-[:USES_WAVE]-> PlasmaWave`.
- `PlasmaParameter`/`ConfinementTime` → `Measurement -[:MEASURES_PARAMETER]->` → experiments → papers.
- `OscillationOrInstability`/`PlasmaWave`/`TheoreticalMechanism` → papers via `OBSERVED_INSTABILITY`/`PREDICTED_INSTABILITY`/`EXPLAINED_BY`.
- `FusionDevice` name → the device itself + all papers reporting on it.
- `Diagnostic`, `PlasmaProductionMethod` → analogous.

Cap results (e.g. 10 papers) and set `meta.truncated` so the UI can offer "show all in panel". This code lives in a shared module (`service/expansion.py`) imported by both `kg-service` and `enrich.py`.

#### `/paper/{paperId}` — dossier

```json
{ "paperId": "IAEA-CN-28-H-1", "title": "…", "authors": ["…"], "presenter": "…",
  "institute": { "name": "…", "city": "Kharkov" },
  "conference": { "name": "…", "year": 1971, "location": "Madison", "session": "H" },
  "studyKind": "experimental",
  "experiments": [{
      "device": "Tuman-2",
      "heatingMethods": [{ "name": "UHF heating", "frequency": "10 and 40 Gc/s",
                           "power": "…", "pulseDuration": "Δt ~ 2 ms" }],
      "findings": ["decay time is 5–10 times Bohm", "…"],
      "measurements": [{ "parameter": "electron density", "value": "3-5 x 10^12",
                          "unit": "cm^-3", "diagnostic": "microwave interferometer" }],
      "scalabilityClaims": [{ "statement": "…", "limit": "…" }],
      "constraints": ["power coupling limited to ~10 W/cm^2"],
      "instabilities": [{ "name": "drift instability", "observed": true }] }],
  "excerpts": ["…top-3 chunk texts ≤ ~500 chars each…"] }
```

Note the heating-method relation attributes (`frequency`, `power`, `pulseDuration`) — they live on `USES_HEATING_METHOD` edges, fetch them there.

#### `/search` — deterministic GraphRAG (port of `chat.py` graph mode)

```json
// request
{ "query": "which stellarators reported confinement better than Bohm?",
  "top_k": 8, "max_facts": 40 }
// response
{ "chunks": [{ "text": "…", "paperId": "IAEA-CN-28-H-1", "score": 0.83 }],
  "facts":  [{ "subject": "Experiment X", "predicate": "REPORTS_FINDING",
               "object": "decay time 5–10× Bohm", "paperId": "…" }],
  "entities": [{ "name": "…", "labels": ["…"] }] }
```

Steps: embed query (Ollama `nomic-embed-text-v2-moe`) → `Chunk.embedding` vector index top-k → `FROM_CHUNK` → entities → all edges linking those entities (same traversal as `chat.py`).

#### `/cypher` — bounded agent tool

```json
// request  { "query": "MATCH …", "params": {}, "timeout_ms": 5000 }
// response { "rows": [...], "rowCount": 12, "truncated": false }
```

Safety: dedicated **read-only** Neo4j role + server-side rejection of write clauses (`CREATE|MERGE|DELETE|SET|DROP|CALL dbms|apoc` writes) + `LIMIT` injection/clamping + hard timeout. Never expose raw bolt.

#### `/chat` — the fat pipeline (streaming)

```json
// request
{ "message": "…", "sessionId": "abc",
  "techTreeContext": { "selectedNodeIds": ["tokamak"], "nodes": [...] },
  "mode": "instant" | "deep" }
```

Response: **Server-Sent Events**:

```
event: status      data: {"stage":"retrieving"}
event: tool_call   data: {"tool":"cypher","summary":"MATCH (e:Experiment)…"}
event: token       data: {"text":"Experiments"}
event: sources     data: {"papers":[{"paperId":"IAEA-CN-28-H-1","title":"…"}]}
event: ui_action   data: {"action":"zoom_to_node","params":{"nodeId":"tokamak"}}
event: artifact    data: {"type":"claim","payload":{…}}      // science-mode graph deltas
event: done        data: {"sessionId":"abc","usage":{…}}
event: error       data: {"message":"…"}
```

Pipeline inside `/chat`:

1. Load session history (Session/Message nodes in Neo4j — port from `chat.py`), summarize + merge into query.
2. Deterministic retrieval: `/resolve` for entity mentions + `/search` for chunks/facts.
3. **Escalation policy**: if retrieval is thin (< N facts / no entities resolved) or `mode=deep`, enter a bounded tool loop (max ~4 steps): the LLM may call `cypher`/`neighbors`/`paper` via Ollama tool-calling; each call is *internal* — no tunnel round-trips.
4. Synthesize answer with qwen3, citing `paperId`s inline; stream tokens.
5. Emit `sources` event → UI renders clickable citations that open the paper dossier (from Mongo — always available).
6. Persist message pair to session.

Why hybrid (deterministic-first) instead of pure ReAct: 27B models are workable but flaky at tool *selection*. Deterministic retrieval covers ~80% of questions; the loop handles the long tail.

### 3.2 Enrichment builder — `enrich.py` (the materialization job)

The component that makes the overlay instant. Python script on the uni server (same venv as `fusion_kg_builder`: neo4j driver + pymongo). Shares `service/expansion.py` with `kg-service` so live and materialized output are identical in shape.

**What it does per tech tree node:**

```
node (from Mongo `nodes`, per kgEnabled topic)
  → resolve(node.label, kg_entity_map overrides) → KG entity
  → expansion cypher (shared expansion.py) → entities[] + dossier refs
  → upsert kg_node_enrichment doc
and per referenced paper → upsert kg_papers dossier doc
```

**Collections it writes** (details in §6): `kg_node_enrichment`, `kg_papers`, `kg_entity_map` (read + auto-cache), `kg_paper_hashes` (change detection).

**CLI:**

```bash
uv run enrich.py --all                      # full rebuild
uv run enrich.py --node tokamak             # one node
uv run enrich.py --papers IAEA-CN-28-H-1 …  # rebuild nodes affected by papers
uv run enrich.py --stale                    # docs older than schema/KV version
uv run enrich.py --diff                     # hash-diff papers → partial rebuild
```

See §5 for the incremental algorithm.

### 3.3 Vercel API routes (gaia-tt)

#### `src/app/api/chat/route.ts` — becomes a proxy

- Accepts the existing body `{message, history?, topic, fileData?, mode}` + adds `sessionId`, `selectedNodeIds`.
- Forwards `{message, sessionId, techTreeContext}` to `${KG_SERVICE_URL}/chat`, streams SSE → browser.
- Fallback when `KG_SERVICE_URL` unset / service unhealthy: tree-only answer (or legacy Gemini path behind `KG_CHAT_ENABLED` flag until qwen quality is validated).
- `export const maxDuration = 300` — local-model inference is slow; SSE keeps the connection alive. If plan limits can't cover worst case, switch to a job pattern (`POST /chat` → `{jobId}`, `GET /chat/{jobId}/events`).

#### `src/app/api/kg/route.ts` — reads Mongo, not the tunnel

```
GET /api/kg?nodeId=tokamak&topic=fusion
  → db.kg_node_enrichment.findOne({topic, techTreeNodeId})
  → { entities, meta }   // same shape as live /expand
```

- No tunnel dependency at all — the overlay works even if the uni server is off for weeks.
- Optional `?live=1` param → proxy to `${KG_SERVICE_URL}/expand` for debugging/previewing unrebuilt KG state.
- Missing doc → `{entities: [], meta: {enriched: false}}` → icon shows empty/disabled state rather than an error.

#### `src/app/api/kg/paper/[paperId]/route.ts` — dossier from Mongo

```
GET /api/kg/paper/IAEA-CN-28-H-1 → db.kg_papers.findOne({paperId})
```

Used by the details panel and by chat citation chips — always available, even when chat itself is in degraded mode.

#### Env vars (Vercel)

```
KG_SERVICE_URL=https://kg.yourdomain.org     # chat only now
KG_SERVICE_TOKEN=<long random>
KG_CHAT_ENABLED=true
```

Never `NEXT_PUBLIC_*` — browser must never see URL or token. (No CORS concerns: all calls are server-to-server.)

### 3.4 Frontend (overlay)

Clone the companies overlay pattern (`handleShowCompanies` → `handleShowLiterature`):

- Third icon on `CustomNode` (book/scroll icon) — **only for kgEnabled topics** (`TOPICS[topic].kgEnabled` flag in `topicConfig`); icon disabled/greyed when `meta.enriched === false`.
- New state in `TechTree.tsx`: `literatureNodes`, `literatureEdges`, `expandedLiteratureNodeIds` — same toggle/collapse semantics as companies; render on the **right** side of the parent (companies are left).
- Node types → `literature` (paper), `kgDevice`, `kgFinding` — distinct colors (e.g. paper = indigo, device = teal, finding = amber), dashed edges labeled with `relation` (`evidenced_by`, `instance_of`, `studied_in`).
- Clicking a literature node → details panel tab showing the `/api/kg/paper/{paperId}` dossier (reuse `NodeDetails` patterns).
- `meta.truncated` → "+N more" node like `MoreCompaniesNode`, opening a list sub-view.

### 3.5 Chat → UI action protocol

The chat can drive the visualization, not just answer. The server-side model emits structured `ui_action` events (either a dedicated `ui_action` tool call or a post-pass extraction); the frontend runs them through a dispatcher that maps each action onto existing `TechTree.tsx` handlers — so this costs almost nothing, the handler surface already exists.

```json
{ "action": "zoom_to_node",     "params": { "nodeId": "tokamak" } }                    // fitView on node
{ "action": "filter",           "params": { "category": "Magnets", "searchTerm": "" } } // setSelectedCategory + setSearchTerm
{ "action": "highlight",        "params": { "nodeIds": ["a","b"] } }                    // orange highlight set
{ "action": "show_connected",   "params": { "nodeId": "tokamak" } }                     // existing handler
{ "action": "show_details",     "params": { "nodeId": "tokamak" } }                     // existing handler
{ "action": "show_literature",  "params": { "nodeId": "tokamak" } }                     // expand overlay
{ "action": "reset",            "params": {} }                                          // handleReset
```

Rules: read-only/UX actions only — the LLM can never mutate data. Actions are idempotent and batched (one message may emit several). Frontend dispatcher lives in `TechTree.tsx` (or a small event bus) since that's where the state setters are.

### 3.6 Science mode — chat-grounded evidence canvas

A second React Flow canvas (own route `/science`, split view: chat left, canvas right) where conversation content becomes a graph independent of the tech tree.

**Node/edge types:** `Paper`, `Claim` (a statement from chat + grounding verdict), `Concept`, `Hypothesis`; edges: `supports`, `contradicts`, `mentions`, `derived_from`.

**How the map gets built — deterministic post-pass, not tool-emission:** after each answer, a small extraction pass (server-side) turns the answer + retrieved facts into artifacts emitted as SSE `artifact` events:

```json
{ "type": "claim",       "payload": { "text": "…", "grounding": "supported", "evidence": ["paper:IAEA-CN-28-H-1"] } }
{ "type": "relation",    "payload": { "kind": "contradicts", "from": "claim:3", "to": "claim:7" } }
{ "type": "paper_node",  "payload": { "paperId": "IAEA-CN-28-H-1" } }
```

Same philosophy as the retrieval pipeline: 27B models are flaky at free-form structured emission mid-reasoning, so artifacts come from a bounded extraction prompt over the finished answer — not from the model calling canvas tools.

**Grounding check — new service endpoint `/verify`:** `{claim}` → embed → retrieve evidence (`/search` facts + findings) → verdict `{supported | contradicted | unverifiable}` + evidence edges to `kg_papers` dossiers. Verdict colors the claim node (green/red/grey) and clicking it shows the evidence list.

**Contradiction handling — be careful with semantics:** reliable automated contradiction detection is hard even for frontier models. v1 should surface **conflicting evidence** ("paper A reports τ_E ~ a², paper B reports Bohm-like scaling for similar configs") as amber `tensions` edges, not assert "contradiction". A stricter `contradicts` label can come later with an entailment check.

**Persistence:** `science_sessions` collection in Mongo (`{sessionId, nodes, edges, chatSessionRef, updatedAt}`) → sessions resumable, canvas restorable. Layout: ELK again, or simple columnar-by-type (papers left, claims center, questions right).

**Reuse:** SSE protocol, dossier endpoint, `/search`, React Flow + node component patterns, session model. This is why the SSE channel is designed as typed events rather than raw token streaming — science mode is "just" new event types.

### 3.7 Chat UI

- Keep `Chat.tsx`; switch `fetch('/api/chat')` to SSE consumption (POST + `ReadableStream` parsing).
- Render `status`/`tool_call` events as subtle activity indicators ("searching IAEA papers…") — helps perceived latency of a local model.
- Render `sources` as citation chips; clicking a chip → opens the dossier from Mongo (works even in degraded mode) and can spawn the overlay nodes.

## 4. Data flow walkthroughs

**Overlay (steady state, no tunnel):** click 📖 on *tokamak* → `/api/kg?nodeId=tokamak` → Mongo findOne → `{papers, devices, findings}` → frontend renders ~10 paper nodes right of the parent + labeled dashed edges → click a paper node → `/api/kg/paper/IAEA-CN-28-H-1` → dossier in side panel. Total: 2 Mongo reads, no external calls.

**Materialization (when KG changes):** `main.py` ingests new paper `IAEA-CN-10-205` → post-ingest hook calls `enrich.py --papers IAEA-CN-10-205` → expands the paper's neighbor entity set → finds affected `kg_node_enrichment` docs → re-runs expansion for those nodes only → upserts + writes the new paper's dossier to `kg_papers`.

**Chat:** user asks "which stellarators beat Bohm diffusion?" + `sessionId` + selected-node context → `/api/chat` → `POST /chat` via tunnel → session history loaded → qwen rewrites query → `/resolve` finds "Bohm", "stellarator" → `/search` returns chunks + `REPORTS_FINDING` facts → qwen synthesizes → SSE tokens → `sources` event with 3 papers → persisted to session. Citations resolve via Mongo.

## 5. Enrichment materialization — incremental rebuild

### 5.1 Change detection

The KG only changes when `main.py` runs → three trigger levels, cheapest first:

1. **Post-ingest hook (primary):** `main.py` already knows exactly which documents it processed → emit `{paperIds: [...]}` → call `enrich.py --papers …` (or `POST /admin/rebuild`). Precise, zero diffing cost.
2. **Scheduled hash-diff (backstop):** `enrich.py --diff` nightly — compute a hash per Paper of its reachable subgraph (entities + rel types + relevant props within 2 hops); compare with `kg_paper_hashes`; rebuild where hashes differ. Catches KG edits made outside `main.py` (manual cypher, entity-resolution merges).
3. **Full rebuild (rare):** `--all`, or automatic when `ENRICHMENT_SCHEMA_VERSION` bumps (expansion logic changed) — a few hundred nodes × a few cypher queries each ≈ minutes.

### 5.2 Partial rebuild algorithm

```
changed paperIds P
  → affectedEntityIds = all entities within P's neighborhoods
      (devices, configs, methods, findings, experiments, phenomena)
  → affectedDocs = kg_node_enrichment where
        sourcePaperIds ∩ P ≠ ∅
     OR kgEntityIds   ∩ affectedEntityIds ≠ ∅     # shared-entity ripple
  → for each affected node: re-resolve → re-expand → upsert
  → upsert dossier docs for papers in P
  → also re-resolve nodes whose doc has entities: []   # new papers may now match
```

The `kgEntityIds` ripple check matters: entities are merged by `(label, name)` — if paper A adds a `USES_HEATING_METHOD` edge to a shared `UhfHeating` node, nodes that link via *other* papers see it too.

Deletions: a Paper removed from the KG → its `paperId` won't appear in any hook → the hash-diff pass catches it (hash set shrinks) → rebuild docs that referenced it; dossier docs in `kg_papers` get deleted when no remaining enrichment doc references them.

### 5.3 Versioning & consistency

- `ENRICHMENT_SCHEMA_VERSION` constant in `expansion.py`; stored per doc. Bump → `--stale` rebuilds everything.
- `builtAt` + `kgIngestRun` on each doc → UI can show "literature from KG snapshot of <date>"; ops can audit freshness.
- Overlay data may lag the KG until rebuild — acceptable for literature (hours–days), and the lag is explicit via `builtAt`.

## 6. MongoDB — collections

| Collection | Written by | Purpose |
|---|---|---|
| `kg_node_enrichment` | enrich.py | One doc per `(topic, techTreeNodeId)`: `{resolvedEntity, entities: [...], meta, sourcePaperIds: [], kgEntityIds: [], schemaVersion, builtAt}`. Unique index on `(topic, techTreeNodeId)`; indexes on `sourcePaperIds`, `kgEntityIds` for partial rebuild lookups. |
| `kg_papers` | enrich.py | Paper dossiers keyed by `paperId` (dedup across nodes — one paper can enrich many nodes). |
| `kg_entity_map` | enrich.py read/write | `{techTreeNodeId, entityName, labels, matchType: 'auto'\|'curated', score}` — curated overrides where `/resolve` is wrong + cache of auto-resolutions. |
| `kg_paper_hashes` | enrich.py | `{paperId, subgraphHash, computedAt}` — for `--diff` change detection. |
| existing (`nodes`, `edges`, `tt_companies`, …) | — | unchanged |

## 7. Docker / deployment (uni server)

Extend the existing `docker-compose.yml` in `fusion_kg_builder`:

```yaml
services:
  neo4j:            # existing — unchanged
    image: neo4j:5

  ollama:           # or keep host-native install
    image: ollama/ollama
    deploy: { resources: { reservations: { devices: [{ capabilities: [gpu] }] } } }

  kg-service:
    build: ./service            # FastAPI + uvicorn, neo4j driver, ollama client
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: kg_readonly
      NEO4J_PASSWORD: ${NEO4J_RO_PASSWORD}
      OLLAMA_HOST: http://ollama:11434
      KG_SERVICE_TOKEN: ${KG_SERVICE_TOKEN}
      MONGODB_URI: ${MONGODB_URI}          # for /admin/rebuild → enrich
    depends_on: [neo4j, ollama]
    # NO published ports — only reachable via cloudflared

  cloudflared:
    image: cloudflare/cloudflared
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARED_TOKEN}   # named tunnel → fixed hostname
    depends_on: [kg-service]
```

- `enrich.py` runs in the same `kg-service` image (`docker compose exec kg-service uv run enrich.py --…`) or a one-shot `profile: tools` container — no separate deployment needed.
- **Named Cloudflare Tunnel** → `kg.yourdomain.org` → free TLS at the edge; optional Cloudflare Access on top. ngrok alternative needs a paid plan for a static domain.
- Rate limiting (`slowapi`), request-size limits, structured JSON logs, `X-Request-Id` propagation from Vercel.
- Atlas side: the builder needs write access to the same Mongo cluster the app reads — same credentials pattern as `MONGODB_URI` already in use.

## 8. Security checklist

- [ ] Neo4j user `kg_readonly` for service + builder:
  `CREATE USER kg_readonly SET PASSWORD '…'; GRANT ROLE reader TO kg_readonly;`
- [ ] `/cypher` rejects write keywords, clamps `LIMIT`, 5s timeout — read-only role is the backstop, not the only defense.
- [ ] Bearer token on all non-health endpoints; `/admin/*` additionally restricted (separate token or Cloudflare Access).
- [ ] cloudflared is the ONLY ingress — don't publish Neo4j/Ollama/service ports on the host.
- [ ] Mongo writes from the builder scoped to `kg_*` collections — dedicated Mongo user with `readWrite` on those collections only, not the whole DB.
- [ ] Paper content policy: serve metadata + findings + ≤ ~500-char excerpts in materialized docs. Full `localFile` texts only if licensing allows — decide before exposing.
- [ ] Keep `X-Request-Id` + access logs; alert on repeated 401s.

## 9. Failure modes

| Failure | Behavior |
|---|---|
| Tunnel down / server off | **Overlay: fully unaffected** (Mongo). Chat: fallback to tree-only context + banner "literature knowledge offline". |
| Ollama down | `/healthz` fails → chat degrades; overlay unaffected. |
| Builder fails mid-run | Partial upserts are idempotent → rerun `--stale`; old docs remain until replaced. |
| KG rebuilt, entity names change | Next `enrich.py` run re-resolves → docs self-heal; `--diff` catches anything missed. |
| Slow chat / big agent loop | `status` events stream; hard cap on agent steps; `maxDuration` ≥ 300s or job pattern. |
| Mongo down | Whole app degrades equally — same blast radius as today. |

## 10. Implementation phases

1. **Shared expansion module** — `service/expansion.py` (resolve + per-kind cypher + dossier builder), `enrich.py --all`, `kg_node_enrichment`/`kg_papers` schemas, indexes.
2. **Overlay** — `/api/kg` + `/api/kg/paper/[id]` routes reading Mongo; `LiteratureNode` + third icon + expand/collapse; dossier view in details panel. (Works end-to-end *before* any tunnel exists — easiest win.)
3. **Tunnel + service** — dockerize kg-service, cloudflared, auth, `/healthz`, `/resolve`, `/expand` live fallback.
4. **Chat migration** — `/search` + `/chat` deterministic path + SSE; Vercel proxy; Chat.tsx streaming UI; feature-flagged A/B vs Gemini.
5. **Incremental rebuild** — post-ingest hook in `main.py`, `kg_paper_hashes` diff pass, `/admin/rebuild` endpoint.
6. **Agentic escalation** — `/cypher` + `/neighbors` tools, bounded loop, session storage. **UI actions** in the same phase — the `ui_action` tool + frontend dispatcher (cheap: maps onto existing handlers).
7. **Science mode** — `/science` route, artifact extraction pass, `/verify` endpoint, `science_sessions` persistence.
8. **Hardening** — curated overrides UI, metrics, rate limits, fallback polish.

Phases 1–2 deliver visible value without touching the uni network at all — the builder can run inside the uni network and write to Atlas outbound-only.

## 11. Open questions

- **Licensing**: may full paper texts/chunks be stored in Atlas + served publicly, or metadata+short excerpts only? (Determines `excerpts` in `kg_papers` and chunk returns in `/search`.)
- **Model choice**: qwen3:27b confirmed? Throughput target → stays on Ollama or move to vLLM?
- **Topic gating**: is the KG fusion-only? `TOPICS[topic].kgEnabled` per topic.
- **Sessions**: Neo4j-stored sessions (portable, resumable) or localStorage?
- **Domain**: tunnel hostname; Cloudflare allowed by uni policy vs. ngrok?
- **Rebuild cadence**: hook-only, or nightly `--diff` as well? (Recommend both.)
- **Multi-KG future**: second KG later (e.g. STFC/KG-Explorer data) → `kg_node_enrichment.kgSource` field + per-graph expansion modules?
- **Science-mode semantics**: when is evidence "conflicting" vs. "contradicting"? Needs a definition before `/verify` ships verdicts — otherwise red nodes will be noisy.
- **Science-mode persistence**: Mongo `science_sessions` vs. storing the evidence graph inside Neo4j under the session (keeps graph data in the graph DB, but Mongo is simpler for app reads)?
