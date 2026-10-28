import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { TOPICS, TopicKey } from '@/lib/topicConfig';
import { experimentKeys, PAPER_PART_SCOPE } from '@/lib/kgKeys';

// GET /api/kg/review?topic=... — every enriched node with its accepted and
// rejected entities, with human curations (kg_curations) applied on top.
// Feeds the LiteratureReview curation UI.
export async function GET(request: NextRequest) {
  try {
    const topic = request.nextUrl.searchParams.get('topic') as TopicKey;
    if (!topic || !TOPICS[topic]) {
      return NextResponse.json({ error: 'Invalid or missing topic' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(TOPICS[topic].dbName);

    const [docs, curations, voteRows] = await Promise.all([
      db
        .collection('kg_node_enrichment')
        .find(
          { $or: [{ 'entities.0': { $exists: true } }, { 'meta.rejected.0': { $exists: true } }] },
          { projection: { techTreeNodeId: 1, nodeLabel: 1, entities: 1, 'meta.rejected': 1, _id: 0 } },
        )
        .toArray(),
      db.collection('kg_curations').find({}).toArray(),
      db
        .collection('kg_votes')
        .aggregate([
          {
            $group: {
              _id: '$targetId',
              up: { $sum: { $cond: [{ $eq: ['$vote', 'up'] }, 1, 0] } },
              down: { $sum: { $cond: [{ $eq: ['$vote', 'down'] }, 1, 0] } },
            },
          },
        ])
        .toArray(),
    ]);

    const verdicts = new Map(
      curations.map((c) => [`${c.techTreeNodeId}::${c.entityId}`, c]),
    );
    const tallies = new Map(voteRows.map((v) => [v._id as string, { up: v.up, down: v.down }]));

    // Paper parts: each referenced paper's experiments, keyed like /api/kg/paper.
    const paperIds = new Set<string>();
    for (const doc of docs) {
      for (const e of [...(doc.entities ?? []), ...(doc.meta?.rejected ?? [])]) {
        if (e.kind === 'paper' && e.paper?.paperId) paperIds.add(e.paper.paperId);
      }
    }
    const dossiers = await db
      .collection('kg_papers')
      .find(
        { paperId: { $in: [...paperIds] } },
        { projection: { _id: 0, paperId: 1, 'experiments.name': 1, 'experiments.device': 1 } },
      )
      .toArray();
    const partsByPaper = new Map<string, any[]>();
    for (const d of dossiers) {
      const exps = d.experiments ?? [];
      const keys = experimentKeys(d.paperId, exps);
      partsByPaper.set(
        d.paperId,
        exps.map((e: any, i: number) => {
          const c = verdicts.get(`${PAPER_PART_SCOPE}::${keys[i]}`);
          return {
            partId: keys[i],
            label: `${e.name || `Experiment ${i + 1}`}${e.device ? ` — ${e.device}` : ''}`,
            status: c?.verdict === 'reject' ? 'rejected' : 'accepted',
            curated: !!c,
            curatedAt: c?.updatedAt ?? null,
            votes: tallies.get(keys[i]) ?? { up: 0, down: 0 },
          };
        }),
      );
    }
    const partsFor = (e: any) =>
      e.kind === 'paper' ? partsByPaper.get(e.paper?.paperId) ?? [] : [];

    const nodes = docs.map((doc) => {
      const items: any[] = [];
      for (const e of doc.entities ?? []) {
        const c = verdicts.get(`${doc.techTreeNodeId}::${e.id}`);
        items.push({
          ...toItem(e),
          status: c?.verdict === 'reject' ? 'rejected' : 'accepted',
          curated: !!c,
          curatedAt: c?.updatedAt ?? null,
          votes: tallies.get(e.id) ?? { up: 0, down: 0 },
          parts: partsFor(e),
        });
      }
      for (const e of doc.meta?.rejected ?? []) {
        const c = verdicts.get(`${doc.techTreeNodeId}::${e.id}`);
        items.push({
          ...toItem(e),
          status: c?.verdict === 'accept' ? 'accepted' : 'rejected',
          curated: !!c,
          curatedAt: c?.updatedAt ?? null,
          votes: tallies.get(e.id) ?? { up: 0, down: 0 },
          parts: partsFor(e),
        });
      }
      return { nodeId: doc.techTreeNodeId, nodeLabel: doc.nodeLabel, items };
    });

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error('Error fetching review data:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function toItem(e: any) {
  return {
    entityId: e.id,
    kind: e.kind,
    title: e.kind === 'paper' ? e.paper?.title ?? e.name : e.name,
    summary: e.summary ?? e.paper?.title ?? null,
    meta: e.kind === 'paper'
      ? [e.paper?.year, e.paper?.institute].filter(Boolean).join(' · ')
      : e.kind === 'device'
        ? e.device?.configurationType ?? null
        : null,
    llmReason: e.verification?.reason ?? null,
    llmVerdict: e.verification ? (e.verification.keep ? 'keep' : 'drop') : null,
  };
}
