# Technology-Tree Dataset and Visibility Audit

Audit date: 2026-10-20

Policy basis: [Technology-Tree Node Scope](NODE_SCOPE.md)

## Executive finding

The repository contains a curated set of energy-pathway graphs, not an
exhaustive map of every upstream technology. Existing data consistently includes
digital technologies when they are expressed as plant, control, maintenance, or
design capabilities. It does not model generic computing hardware or the full
supply chain beneath those capabilities.

That explains the apparent asymmetry:

- AI/ML can be a pathway-level enabling capability with its own sector-specific
  TRL, funding program, and downstream dependencies.
- A generic GPU or transistor is normally an implementation detail shared with
  many industries, so it is represented implicitly or within a broader
  electronics node.
- A sector-specific hardware capability can still qualify. Radiation-hardened
  electronics is already represented because qualification in a nuclear
  environment is a distinct bottleneck.

This boundary was previously implicit. `docs/NODE_SCOPE.md` now makes it an
explicit admission policy.

## Method

This report covers every JSON graph in `data/`, including active, alternate,
legacy, and currently unwired sector files. The executable
`npm run audit:data` promotion gate checks the two active sources plus the
nuclear company dataset:

- graph shape, duplicate IDs and source-target dependencies;
- missing edge endpoints, isolated nodes, TRLs, and references;
- company ID and ISO country-code validity;
- primary/all company mapping consistency and parallel mapping-array lengths;
  and
- company mapping referential integrity against active nuclear node IDs.

The script does not decide strategic importance and does not edit data.

## Company and geography coverage

`data/tt-companies.csv` contains 355 nuclear-sector companies. Of these, 301
map to 45 nuclear technology-tree nodes through 491 company-to-technology
relationships. The Company and World views intentionally exclude the 54
unmapped records while reporting them in coverage metadata.

- 328 of all records, and 295 of the 301 mapped records, have a headquarters
  country.
- 64 mapped records have one or more manufacturing countries.
- 58 mapped records have headquarters text detailed enough to attempt city
  resolution. The offline GeoNames generation step resolves 44 to verified
  coordinates; 14 inconsistent or ambiguous records remain unresolved. The
  other 243 mapped companies remain country-level only.
- Headquarters and manufacturing are separate map layers; they are not summed
  into one presence metric.
- The current CSV has no fossil-fuel node mappings. Company and World views
  therefore return a typed unavailable state for the fossil topic.

The seed path is `scripts/add-tt-companies.ts` → `tt_companies` and
`company_tech_tree_edges` in `nuclear_tt_db`. The runtime projection is exposed
by `GET /api/company-view?topic=nuclear`; full company records are fetched only
when selected.

`npm run generate:company-locations` regenerates
`data/company_locations.json`. The map never assigns synthetic coordinates:
verified records receive city pins, while every unresolved record remains in
the country count and drawer.

## Baseline inventory

Seven JSON files contain 466 node records and 529 authored edge records. Fan-out
normalization in the legacy nuclear file expands the total to 570
source-target dependencies. These totals include multiple versions of the same
sector and must not be interpreted as 466 unique runtime technologies.

Only two datasets are active:

- `nuclear_tt_v2.json`: 45 nodes and 77 dependencies, seeded by
  `scripts/add-nuclear-data.ts` into the registered `nuclear` topic.
- `fossil_fuel_tt_v2.json`: 104 nodes and 132 dependencies, seeded by
  `scripts/add-fossil-fuel-data.ts` into the registered `fossil_fuels` topic.

The active runtime sources therefore contain 149 nodes and 209 dependencies.

Five files are not active runtime sources:

- `nuclear_tt.json`: legacy nuclear source with 45 nodes, 36 authored edges, 77
  normalized dependencies, no node references, and 10 fan-out edges.
- `fossil_fuel_tt_v3.json`: alternate fossil source with 123 nodes and 131
  dependencies; no seed script or topic selects it.
- `hydro_tech_tree.json`: 58 nodes and 68 dependencies; no seed script or topic.
- `solar_tech_tree.json`: 27 nodes and 32 dependencies; no seed script or topic.
- `wind_tech_tree.json`: 64 nodes and 53 dependencies; no seed script or topic.

## Structural findings by dataset

### Nuclear

`nuclear_tt_v2.json` passes the structural audit. It uses the three runtime node
roles, gives every node references, and stores each dependency as one
source-target edge.

`nuclear_tt.json` is correctly treated as legacy. All 45 nodes lack references,
and 10 authored `targets` edges require seed-time normalization. It should not
be restored as the source of truth.

### Fossil fuels

`fossil_fuel_tt_v2.json` has no broken dependencies, but it has three review
items:

- `ammonia_cofiring_50` and `coal_ammonia_cofiring_50` use the same label with
  different TRLs, so they are a likely merge or rename candidate.
- `milestone_bouchain_62pct` is isolated.
- `scgt_peaking` is isolated.

`fossil_fuel_tt_v3.json` has seven structural errors and must not be promoted
until they are resolved:

- `c10` and `c11` reference missing source `esp_fgd_scr`.
- `c42` references missing source `eddystone_station`.
- `g08` references missing source `h2_combustion_dynamics`.
- `g09` references missing target `h2_combustion_dynamics`.
- `g20` references missing source `early_gas_pipeline`.
- `o43` references missing source `electrified_reforming`.

### Hydropower

The file is structurally connected except for three isolated nodes:
`bulb_tubular_turbine`, `crossflow_banki_turbine`, and `otec`.

Its 31 deployment concepts use `HydroConcept`. The runtime type union, legend,
group selector, and color mapping do not support that type, so registering the
topic alone would not be sufficient to integrate this dataset.

### Solar

The file has two isolated nodes: `milestone_topcon_market_dominance` and
`opv_concept`.

Its nine deployment concepts use `SolarConcept`, which is not supported by the
current runtime. The same integration decision required for hydro applies here.

### Wind

The file has two isolated nodes: `rare_earth_free_magnets` and `suction_bucket`.

Its 40 deployment concepts use `WindConcept`, which is not supported by the
current runtime. Several component and digital-capability records also use
`WindConcept`, so a future integration should review graph roles rather than
only adding the string to the type union.

## Semantic scope review

### In scope at the current level

- Nuclear `tech_ai_ml_control` represents AI/ML for control and design, has a
  sector-specific TRL, and directly enables reactor concepts.
- Nuclear `tech_rad_hard_electronics` represents environmental qualification,
  not generic electronics, and therefore passes the sector-specific bottleneck
  test.
- Fossil combustion optimization, autonomous tuning, predictive maintenance,
  digital twins, and gas-turbine edge computing are phrased as operational
  energy capabilities rather than generic software infrastructure.
- Hydro predictive maintenance and plant digital twins, solar tracking and
  heliostat optimization, and wind predictive maintenance and digital twins fit
  the same application-level pattern when their edges and TRLs support the
  stated role.

### Aggregate or merge candidates

- Keep generic algorithms, model architectures, cloud services, processors, and
  sensors within the corresponding application-level AI/ML or digital-twin node
  unless they pass the node admission gates independently.
- Review the duplicate fossil coal-ammonia concept before choosing a canonical
  ID and TRL.
- Treat the current nuclear AI/ML node as an aggregate. Split plasma control,
  design optimization, or predictive maintenance only if each has distinct
  readiness, evidence, and dependencies that change an investment decision.

### Split candidates

- Radiation-hardened electronics could be split only if a specific control,
  sensing, power-electronics, or compute platform is independently fundable and
  gates a different set of concepts.
- Wind's two digital-twin records may warrant separate enabling roles because
  data-driven operational monitoring and physics-based fatigue analysis can
  have different evidence and dependencies. Their current `WindConcept` role
  needs review first.

### Out of scope at the current level

- No dataset contains a transistor node or label. A generic transistor is below
  the graph's investment granularity.
- No dataset contains a graphics-processor hardware node. The only uppercase
  “GPU” occurrence is a gas permeation unit in a membrane description in the
  alternate fossil dataset, not a graphics processing unit.
- Generic datacenter, cloud, networking, semiconductor fabrication, and
  commodity processor nodes remain out of scope unless a sector-specific
  qualification or supply constraint becomes a distinct pathway bottleneck.

### Needs evidence

- Isolated nodes need a justified prerequisite or dependent before they satisfy
  the policy.
- Alternate fossil v3 nodes connected through missing endpoints need source
  evidence and corrected graph intent before the edges can be repaired.
- Renewable deployment-concept roles need an explicit shared type strategy
  before those datasets are seeded.

## Why an expected node may not appear

Semantic omission and runtime invisibility are separate problems.

### Semantic or source omission

The candidate may not pass the node policy, may be represented by a broader
node, or may not yet have evidence. GPUs and transistors currently fall in this
category.

### Dataset selection

A node can exist in a JSON file that the application never loads. Hydro, solar,
wind, fossil v3, and legacy nuclear currently have no active source-to-topic
path.

### Seed or database state

The live graph is read from MongoDB, not directly from JSON. A source change is
invisible until the intended seed or edit path updates the correct topic
database. A stale database or wrong topic can therefore omit a valid source
node. In a production build without `MONGODB_URI`, the tech-tree API returns an
empty graph.

### UI visibility state

Once a node reaches the client, it can still be intentionally hidden:

- a category filter requires an exact category match;
- search matches the displayed node label;
- type grouping shows only the selected node type;
- connected-only mode shows the selected node and its direct, one-hop
  neighbors; and
- edges are shown only when both endpoints are visible.

Reset to category `All`, empty search, `No Grouping`, and full-graph mode before
diagnosing a missing runtime node.

## Prioritized follow-up

1. **Block promotion of fossil v3** until its seven broken dependencies are
   reconciled against evidence.
2. **Resolve active fossil ambiguities** by reviewing the duplicate
   coal-ammonia concept and the two isolated nodes.
3. **Choose a shared deployment-concept strategy** before integrating hydro,
   solar, or wind. Decide whether the persisted role remains
   `ReactorConcept`, becomes a neutral type such as `DeploymentConcept`, or the
   runtime explicitly supports sector-specific concept types.
4. **Review renewable isolated nodes and role assignments** before adding seed
   scripts or topics.
5. **Keep generic GPU and transistor nodes out of the graph** unless a proposal
   demonstrates sector-specific readiness, independent funding, and a distinct
   pathway dependency.
6. **Re-run `npm run audit:data` for every active dataset or company-mapping
   change.** Broken endpoints, duplicate IDs/pairs, invalid TRLs/references,
   invalid country codes, and broken company mappings fail the command.
   Existing isolated active fossil nodes and unmapped companies remain visible
   warnings requiring human review.

This audit does not add, remove, merge, or rewire any graph node. Those changes
require a separate evidence-backed decision.
