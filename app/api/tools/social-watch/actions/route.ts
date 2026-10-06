import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { getMongoDb } from '@/lib/server/mongodb';
import type { SocialPickActionStatus } from '@/types/social-watch';

const COLLECTION = 'social_watch_actions';

type ActionDoc = {
  postId: string;
  status: SocialPickActionStatus;
  poiId?: string;
  poiName?: string;
  platform?: string;
  postUrl?: string;
  publishedAt?: string;
  recommendedReaction?: 'like' | 'comment';
  updatedAt: Date;
};

function isStatus(v: unknown): v is SocialPickActionStatus {
  return v === 'followed' || v === 'ignored';
}

/** Statuts déjà enregistrés pour des posts : GET ?ids=<json array> */
export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const raw = request.nextUrl.searchParams.get('ids');
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ actions: {} });

    const db = await getMongoDb();
    const docs = await db
      .collection<ActionDoc>(COLLECTION)
      .find({ postId: { $in: ids.filter((i): i is string => typeof i === 'string') } })
      .toArray();
    return NextResponse.json({
      actions: Object.fromEntries(docs.map((d) => [d.postId, d.status])),
    });
  } catch (e) {
    return errorResponse(e, 'Erreur lecture des suites données');
  }
}

/** Enregistre (ou efface avec status=null) la suite donnée à une recommandation. */
export async function PUT(request: NextRequest) {
  try {
    requireAuth(request);
    const body = (await request.json()) as Partial<ActionDoc> & { status?: unknown };
    if (!body.postId) {
      return NextResponse.json({ error: 'postId manquant' }, { status: 400 });
    }

    const col = (await getMongoDb()).collection<ActionDoc>(COLLECTION);
    await col.createIndex({ postId: 1 }, { unique: true });

    if (body.status == null) {
      await col.deleteOne({ postId: body.postId });
      return NextResponse.json({ ok: true, status: null });
    }
    if (!isStatus(body.status)) {
      return NextResponse.json({ error: 'status invalide' }, { status: 400 });
    }

    await col.updateOne(
      { postId: body.postId },
      {
        $set: {
          status: body.status,
          poiId: body.poiId,
          poiName: body.poiName,
          platform: body.platform,
          postUrl: body.postUrl,
          publishedAt: body.publishedAt,
          recommendedReaction: body.recommendedReaction,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, status: body.status });
  } catch (e) {
    return errorResponse(e, 'Erreur enregistrement');
  }
}

function errorResponse(e: unknown, fallback: string) {
  if ((e as Error).message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  console.error('[social-watch/actions]', e);
  const message = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}
