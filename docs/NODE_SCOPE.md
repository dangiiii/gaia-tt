# Technology-Tree Node Scope

## Purpose

The Investment Tech Tree is a curated dependency map for energy-sector investment
decisions. It shows which concepts could reach deployment, which milestones gate
them, and which enabling capabilities can change their schedule, risk, or
readiness.

It is not:

- an exhaustive scientific taxonomy;
- a bill of materials for every plant;
- a complete supply-chain map; or
- a list of every technology mentioned by a source.

Omission is therefore not a claim that a technology is unimportant. It means the
technology is either outside the tree's decision level, represented by a broader
node, or has not yet met the evidence requirements below.

## Unit of representation

A node is a **pathway investment unit**: a concept, demonstrated outcome, or
sector-specific capability that can be assessed and acted on independently.

Every proposed node must satisfy all of these admission gates:

1. **Pathway leverage** — completing or advancing it materially changes the
   schedule, risk, or readiness of at least one deployment concept.
2. **Distinct decision** — investors, operators, researchers, or policymakers
   can direct a meaningful program or budget to it independently.
3. **Sector-specific readiness** — its TRL can be assessed in the environment
   represented by the dataset. The maturity of a generic commercial product is
   not a substitute for readiness in a reactor, turbine, grid, or reservoir.
4. **Appropriate granularity** — it is a deployment concept, program milestone,
   integrated subsystem, or capability. Commodity parts and foundational
   scientific ideas normally remain in descriptions.
5. **Dependency value** — it has at least one specific prerequisite or dependent
   in the graph. A vague “related to” relationship is insufficient.
6. **Evidence** — its role, readiness, and dependency are supported by at least
   one traceable reference.

If a candidate fails a gate, record it in an existing node's description or
reference set rather than creating a standalone node.

## Node roles

The shared conceptual roles are:

- **Deployment concept** — a plant, reactor, conversion, or generation pathway
  whose commercial progress is evaluated. `ReactorConcept` is the current
  runtime name for this role, although some unwired datasets use names such as
  `SolarConcept`, `WindConcept`, and `HydroConcept`.
- **Milestone** — a verifiable outcome, demonstration, qualification, regulatory
  approval, or deployment event. It should describe an achieved state, not a
  broad field of work.
- **Enabling technology** — a reusable sector-specific capability or subsystem
  that gates one or more deployment concepts.

Node type describes a graph role, while `category` and `subtype` describe the
sector taxonomy. Categories and subtypes must not be used to compensate for an
incorrect node role.

## Granularity and aggregation

Prefer the highest level that still preserves a distinct investment decision and
a meaningful dependency.

Keep candidates aggregated when they:

- share the same fundable program and TRL evidence;
- affect the same downstream concepts through the same dependency;
- cannot be ranked or accelerated independently; or
- would expose ordinary implementation details rather than pathway bottlenecks.

Split an existing node only when each proposed child:

- passes every admission gate independently;
- has materially different readiness, evidence, or downstream dependencies; and
- would change an investment ranking, simulation result, or policy decision.

Do not create both a parent and its children as peers with duplicate edges. If a
hierarchy is needed, define its semantics before adding it to the data model.

## Edge semantics

An edge is directed:

`prerequisite → dependent`

For example, a component qualification milestone points to the concept that
requires it. Edges must represent a credible gating or enabling relationship,
not similarity, co-occurrence, or a generic association.

Rules:

- both endpoints must exist in the same dataset;
- every node must have at least one edge;
- duplicate source-target pairs are not allowed;
- fan-out relationships may be authored as `targets`, but must be normalized to
  one source-target edge per dependency before runtime use;
- cross-sector dependencies belong in each affected sector dataset until the
  product defines shared cross-topic nodes; and
- edge direction must agree with the scheduler and simulation semantics.

## Inclusion examples

### AI and machine learning

Application-level AI/ML can be a node when it is a fundable capability with
sector-specific readiness and a direct effect on plant control, design,
maintenance, or deployment. Nuclear's `tech_ai_ml_control` follows this pattern.

“Machine learning” as a general computing field does not qualify. Individual
algorithms, libraries, and model architectures normally belong in the broader
node's description.

### GPUs and transistors

Generic GPUs and transistors are commodity implementation layers and do not
normally pass the granularity, sector-readiness, or distinct-decision gates.
Their absence does not imply that AI systems can operate without hardware.

A narrower candidate can qualify when the energy-sector constraint is itself a
pathway bottleneck. Examples could include radiation-qualified control
electronics or a separately funded real-time compute platform for plasma
control, provided its readiness and dependencies differ from existing AI/ML or
radiation-hardened-electronics nodes.

### Digital twins and edge computing

These qualify only when phrased and assessed as an operational energy capability,
such as turbine grid services or predictive maintenance. Generic cloud,
networking, and datacenter infrastructure remain out of scope.

### Materials and components

Specialized materials or components qualify when their performance or
qualification gates deployment and they constitute a distinct development
program. Standard fasteners, wiring, commercial processors, and raw commodities
remain in descriptions unless a sector-specific shortage or qualification
program changes pathway risk.

## Review outcomes

Every semantic audit or node proposal should receive one outcome:

- **In scope** — keep or add at the current level.
- **Aggregate/merge candidate** — represent within a broader existing node.
- **Split candidate** — separate capabilities may pass the gates independently.
- **Out of scope** — retain only as descriptive or supply-chain context.
- **Needs evidence** — plausible, but readiness, references, or dependencies are
  not established.

Scope review is a human decision. Automated checks can identify missing fields,
invalid edges, inconsistent types, and review candidates, but must not declare a
technology strategically important or unimportant.

## Proposal checklist

A data change should state:

1. the sector and node role;
2. the decision that becomes possible because the node is separate;
3. current and projected sector-specific TRL with references;
4. every prerequisite and dependent, with edge direction justified;
5. why an existing node cannot represent it; and
6. whether it changes simulations, company mappings, chat context, or grouping.

Run `npm run audit:data` before review. Do not seed a database until structural
errors are resolved and the semantic review outcome is approved.

## Scope versus visibility

A node can be in scope and still be absent from the canvas. Diagnose visibility
separately:

1. confirm the node exists in the intended JSON dataset;
2. confirm that version was seeded into the selected MongoDB topic;
3. confirm the topic is registered by the application;
4. reset category, search, and type-grouping filters; and
5. leave connected-only mode, which intentionally shows only direct neighbors.

These states do not change the node's semantic scope.
