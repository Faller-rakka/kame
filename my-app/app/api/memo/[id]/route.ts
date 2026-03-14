import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

const ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#16a085',
];

interface Segment {
  author: string;
  text: string;
  color: string;
  savedAt: string;
}

interface Participant {
  name: string;
  color: string;
}

interface MemoData {
  segments: Segment[];
  participants: Participant[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const memo = await kv.get<MemoData>(`memo:${id}`);
  return NextResponse.json(memo ?? { segments: [], participants: [] });
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
  const author = String(body.author ?? '').trim();
  const text = String(body.text ?? '').trim();

  if (!author || !text) {
    return NextResponse.json({ error: 'Missing author or text' }, { status: 400 });
  }

  const existing = await kv.get<MemoData>(`memo:${id}`) ?? { segments: [], participants: [] };

  let participant = existing.participants.find((p) => p.name === author);
  if (!participant) {
    const color = COLORS[existing.participants.length % COLORS.length];
    participant = { name: author, color };
    existing.participants.push(participant);
  }

  existing.segments.push({
    author,
    text,
    color: participant.color,
    savedAt: new Date().toISOString(),
  });

  await kv.set(`memo:${id}`, existing);
  return NextResponse.json(existing);
}
