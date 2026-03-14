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

interface Keyword {
  word: string;
  addedBy: string;
}

interface MemoData {
  segments: Segment[];
  participants: Participant[];
  keywords: Keyword[];
}

// セグメント全体を結合した文字列でキーワードを検索し、
// 各セグメントのオフセットを考慮してハイライト位置を計算する
function buildKeywordedPositions(segments: { text: string }[], keywords: string[]): Set<number> {
  const positions = new Set<number>();
  if (keywords.length === 0) return positions;
  const fullText = segments.map((s) => s.text).join('');
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(escaped.join('|'), 'gi');
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    for (let i = match.index; i < match.index + match[0].length; i++) {
      positions.add(i);
    }
  }
  return positions;
}

function renderSegmentWithHighlights(
  seg: { text: string; color: string },
  offset: number,
  keywordedPositions: Set<number>
): React.ReactNode {
  const spans: { text: string; highlighted: boolean }[] = [];
  let i = 0;
  while (i < seg.text.length) {
    const highlighted = keywordedPositions.has(offset + i);
    let j = i;
    while (j < seg.text.length && keywordedPositions.has(offset + j) === highlighted) j++;
    spans.push({ text: seg.text.slice(i, j), highlighted });
    i = j;
  }
  return (
    <span style={{ color: seg.color }}>
      {spans.map((span, idx) =>
        span.highlighted ? (
          <span key={idx} style={{ outline: '2px solid red', borderRadius: '2px', padding: '0 1px' }}>
            {span.text}
          </span>
        ) : (
          span.text
        )
      )}
    </span>
  );
}

export default function MemoPage() {
  const params = useParams();
  const id = params.id as string;

  const [memo, setMemo] = useState<MemoData>({ segments: [], participants: [], keywords: [] });
  const [userName, setUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [inputText, setInputText] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const userColor = memo.participants.find((p) => p.name === userName)?.color ?? '#888';
  const allKeywords = (memo.keywords ?? []).map((k) => k.word);
  const keywordedPositions = buildKeywordedPositions(memo.segments, allKeywords);

  const fetchMemo = useCallback(async () => {
    try {
      const res = await fetch(`/api/memo/${id}?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      setMemo(data);
    } catch {}
  }, [id]);

  useEffect(() => {
    const stored = localStorage.getItem(`memo-name-${id}`);
    if (stored) setUserName(stored);
  }, [id]);

  useEffect(() => {
    if (!userName) return;
    fetchMemo();
    const interval = setInterval(fetchMemo, 2000);
    return () => clearInterval(interval);
  }, [userName, fetchMemo]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSave();
      } else {
        e.preventDefault(); // 改行禁止
      }
    }
  };

  const handleAddKeyword = async () => {
    const word = keywordInput.trim();
    if (!word) return;
    const res = await fetch(`/api/memo/${id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, word, action: 'add' }),
    });
    const data = await res.json();
    setMemo(data);
    setKeywordInput('');
  };

  const handleRemoveKeyword = async (word: string) => {
    const res = await fetch(`/api/memo/${id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, word, action: 'remove' }),
    });
    const data = await res.json();
    setMemo(data);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          onClick={() => setShowConfig(!showConfig)}
          className="text-sm px-3 py-1.5 rounded-md bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:opacity-80 transition-opacity shrink-0"
        >
          設定
        </button>
        <button
          onClick={copyUrl}
          className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity shrink-0"
        >
          {copied ? 'コピー済み!' : 'リンクをコピー'}
        </button>
      </header>

      {/* Config panel */}
      {showConfig && (
        <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">強調キーワード設定</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="キーワードを入力"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            />
            <button
              onClick={handleAddKeyword}
              disabled={!keywordInput.trim()}
              className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(memo.keywords ?? []).map((k) => (
              <span
                key={`${k.word}-${k.addedBy}`}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"
              >
                {k.word}
                <span className="text-zinc-400">({k.addedBy})</span>
                {k.addedBy === userName && (
                  <button
                    onClick={() => handleRemoveKeyword(k.word)}
                    className="ml-1 text-red-500 hover:text-red-700 font-bold leading-none"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {(memo.keywords ?? []).length === 0 && (
              <p className="text-xs text-zinc-400">キーワードはまだありません</p>
            )}
          </div>
        </div>
      )}

      {/* Inline text content */}
      <main className="flex-1 overflow-y-auto p-4">
        {memo.segments.length === 0 && (
          <p className="text-center text-zinc-400 mt-16 text-sm">
            まだ内容がありません。最初のメモを書いてみましょう！
          </p>
        )}
        <p className="text-sm leading-relaxed break-words">
          {(() => {
            let offset = 0;
            return memo.segments.map((seg, i) => {
              const segOffset = offset;
              offset += seg.text.length;
              return (
                <span key={i}>
                  {i > 0 && ' '}
                  {renderSegmentWithHighlights(seg, segOffset, keywordedPositions)}
                </span>
              );
            });
          })()}
        </p>
        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
        <span className="text-xs font-semibold" style={{ color: userColor }}>
          {userName} として入力中
        </span>
        <div className="flex gap-2 items-center">
          <textarea
            className="flex-1 border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400"
            rows={1}
            placeholder="メモを入力 (PC: Ctrl+Enter で保存)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
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
