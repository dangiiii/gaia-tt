import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { TOPICS, TopicKey } from '@/lib/topicConfig';

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

    const [docs, curations] = await Promise.all([
      db
        .collection('kg_node_enrichment')
        .find(
          { $or: [{ 'entities.0': { $exists: true } }, { 'meta.rejected.0': { $exists: true } }] },
          { projection: { techTreeNodeId: 1, nodeLabel: 1, entities: 1, 'meta.rejected': 1, _id: 0 } },
        )
        .toArray(),
      db.collection('kg_curations').find({}).toArray(),
    ]);

    const verdicts = new Map(
      curations.map((c) => [`${c.techTreeNodeId}::${c.entityId}`, c]),
    );

    const nodes = docs.map((doc) => {
      const items: any[] = [];
      for (const e of doc.entities ?? []) {
        const c = verdicts.get(`${doc.techTreeNodeId}::${e.id}`);
        items.push({
          ...toItem(e),
          status: c?.verdict === 'reject' ? 'rejected' : 'accepted',
          curated: !!c,
          curatedAt: c?.updatedAt ?? null,
        });
      }
      for (const e of doc.meta?.rejected ?? []) {
        const c = verdicts.get(`${doc.techTreeNodeId}::${e.id}`);
        items.push({
          ...toItem(e),
          status: c?.verdict === 'accept' ? 'accepted' : 'rejected',
          curated: !!c,
          curatedAt: c?.updatedAt ?? null,
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
