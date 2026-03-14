'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

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

export default function MemoPage() {
  const params = useParams();
  const id = params.id as string;

  const [memo, setMemo] = useState<MemoData>({ segments: [], participants: [] });
  const [userName, setUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [inputText, setInputText] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const userColor = memo.participants.find((p) => p.name === userName)?.color ?? '#888';

  const fetchMemo = useCallback(async () => {
    try {
      const res = await fetch(`/api/memo/${id}`, { cache: 'no-store' });
      const data = await res.json();
      setMemo(data);
    } catch {}
  }, [id]);

  // Restore name from localStorage on load
  useEffect(() => {
    const stored = localStorage.getItem(`memo-name-${id}`);
    if (stored) setUserName(stored);
  }, [id]);

  // Poll for updates every 5 seconds after joining
  useEffect(() => {
    if (!userName) return;
    fetchMemo();
    const interval = setInterval(fetchMemo, 5000);
    return () => clearInterval(interval);
  }, [userName, fetchMemo]);

  // Auto-scroll to bottom on new segments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [memo.segments.length]);

  const handleJoin = async () => {
    const name = nameInput.trim();
    if (!name) return;
    await fetch(`/api/memo/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    localStorage.setItem(`memo-name-${id}`, name);
    setUserName(name);
  };

  const handleSave = async () => {
    if (!inputText.trim() || !userName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/memo/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: userName, text: inputText }),
      });
      const data = await res.json();
      setMemo(data);
      setInputText('');
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Name input screen
  if (!userName) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">共有メモ帳に参加</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            メモ帳に表示される名前を入力してください
          </p>
          <input
            type="text"
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="名前"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button
            onClick={handleJoin}
            disabled={!nameInput.trim()}
            className="w-full py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            参加する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
          共有メモ帳
        </h1>
        <div className="flex-1 flex items-center gap-2 overflow-x-auto min-w-0">
          {memo.participants.map((p) => (
            <span
              key={p.name}
              className="text-xs px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
              style={{ backgroundColor: p.color }}
            >
              {p.name}
            </span>
          ))}
        </div>
        <button
          onClick={copyUrl}
          className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity shrink-0"
        >
          {copied ? 'コピー済み!' : 'リンクをコピー'}
        </button>
      </header>

      {/* Segments */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {memo.segments.length === 0 && (
          <p className="text-center text-zinc-400 mt-16 text-sm">
            まだ内容がありません。最初のメモを書いてみましょう！
          </p>
        )}
        {memo.segments.map((seg, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: seg.color }}>
                {seg.author}
              </span>
              <span className="text-xs text-zinc-400">
                {new Date(seg.savedAt).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div
              className="rounded-lg p-3 text-sm whitespace-pre-wrap text-zinc-900 dark:text-zinc-100"
              style={{
                backgroundColor: seg.color + '18',
                borderLeft: `3px solid ${seg.color}`,
              }}
            >
              {seg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
        <span className="text-xs font-semibold" style={{ color: userColor }}>
          {userName} として入力中
        </span>
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400"
            rows={3}
            placeholder="メモを入力してください..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={!inputText.trim() || saving}
            className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
