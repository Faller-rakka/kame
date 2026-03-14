import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#16a085',
];

interface Participant {
  name: string;
  color: string;
}

interface MemoData {
  segments: unknown[];
  participants: Participant[];
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
  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  const existing = await kv.get<MemoData>(`memo:${id}`) ?? { segments: [], participants: [] };

  let participant = existing.participants.find((p) => p.name === name);
  if (!participant) {
    const color = COLORS[existing.participants.length % COLORS.length];
    participant = { name, color };
    existing.participants.push(participant);
    await kv.set(`memo:${id}`, existing);
  }

  return NextResponse.json(participant);
}
