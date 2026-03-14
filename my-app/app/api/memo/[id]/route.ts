import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const memo = await kv.get<{ content: string; updatedAt: string }>(`memo:${id}`);
  return NextResponse.json(memo ?? { content: '', updatedAt: null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const body = await request.json();
  const memo = {
    content: String(body.content ?? ''),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`memo:${id}`, memo);
  return NextResponse.json(memo);
}
