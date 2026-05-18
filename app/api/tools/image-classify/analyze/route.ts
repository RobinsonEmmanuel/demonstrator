import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { runImageClassificationPipeline } from '@/lib/server/image-pipeline';
import type { ImageClassifyContext, UploadedImageInput } from '@/types/image-classify';

const MAX_IMAGES = 20;
const MAX_DATA_URL_LENGTH = 12_000_000; // ~9 Mo base64

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    const body = await request.json();
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const context: ImageClassifyContext | undefined =
      body.context && typeof body.context === 'object'
        ? {
            poiName:
              typeof body.context.poiName === 'string'
                ? body.context.poiName.trim()
                : undefined,
            destination:
              typeof body.context.destination === 'string'
                ? body.context.destination.trim()
                : undefined,
          }
        : undefined;

    if (rawImages.length === 0) {
      return NextResponse.json({ error: 'Aucune image fournie' }, { status: 400 });
    }
    if (rawImages.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images par analyse` },
        { status: 400 }
      );
    }

    const images: UploadedImageInput[] = [];
    for (const item of rawImages) {
      if (!item?.id || !item?.dataUrl) continue;
      const dataUrl = String(item.dataUrl);
      if (!dataUrl.startsWith('data:image/')) continue;
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        return NextResponse.json(
          { error: `Image trop volumineuse : ${item.name || item.id}` },
          { status: 400 }
        );
      }
      images.push({
        id: String(item.id),
        name: String(item.name || item.id),
        mimeType: dataUrl.match(/^data:(image\/[^;]+);/)?.[1] || 'image/jpeg',
        dataUrl,
      });
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'Images invalides' }, { status: 400 });
    }

    const result = await runImageClassificationPipeline(images, context);
    return NextResponse.json(result);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[image-classify/analyze]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur analyse images' },
      { status: 500 }
    );
  }
}
