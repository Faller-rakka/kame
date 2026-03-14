import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

const ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Keyword {
  word: string;
  addedBy: string;
}

interface MemoData {
  segments: unknown[];
  participants: unknown[];
  keywords: Keyword[];
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
  const name = String(body.name ?? '').trim();
  const word = String(body.word ?? '').trim();
  const action = body.action;

  if (!name || !word) {
    return NextResponse.json({ error: 'Missing name or word' }, { status: 400 });
  }

  const existing = await kv.get<MemoData>(`memo:${id}`) ?? { segments: [], participants: [], keywords: [] };
  if (!existing.keywords) existing.keywords = [];

  if (action === 'add') {
    const alreadyExists = existing.keywords.some(
      (k) => k.word.toLowerCase() === word.toLowerCase() && k.addedBy === name
    );
    if (!alreadyExists) {
      existing.keywords.push({ word, addedBy: name });
    }
  } else if (action === 'remove') {
    existing.keywords = existing.keywords.filter(
      (k) => !(k.word.toLowerCase() === word.toLowerCase() && k.addedBy === name)
    );
  }

  await kv.set(`memo:${id}`, existing);
  return NextResponse.json(existing, { headers: { 'Cache-Control': 'no-store' } });
}
