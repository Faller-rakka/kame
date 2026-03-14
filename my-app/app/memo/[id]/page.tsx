'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

const CHARS_PER_LINE = 23;

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
  directions: string[]; // 'h' | 'v' | 'd'
}

interface MemoData {
  segments: Segment[];
  participants: Participant[];
  keywords: Keyword[];
}

interface HighlightInfo {
  hTop: boolean;
  hBottom: boolean;
  hLeft: boolean;
  hRight: boolean;
  vd: boolean;
}

function getHighlightInfo(
  fullText: string,
  keywords: Keyword[],
  charsPerLine: number
): Map<number, HighlightInfo> {
  const map = new Map<number, HighlightInfo>();
  const get = (p: number): HighlightInfo =>
    map.get(p) ?? { hTop: false, hBottom: false, hLeft: false, hRight: false, vd: false };

  const totalChars = fullText.length;
  const totalRows = Math.ceil(totalChars / charsPerLine);

  for (const kw of keywords) {
    if (!kw.word) continue;
    const word = kw.word;
    const kLen = word.length;
    const dirs = kw.directions ?? ['h'];
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (dirs.includes('h')) {
      for (let row = 0; row < totalRows; row++) {
        const lineStart = row * charsPerLine;
        const lineEnd = Math.min(lineStart + charsPerLine, totalChars);
        const line = fullText.slice(lineStart, lineEnd);
        const regex = new RegExp(escaped, 'gi');
        let m;
        while ((m = regex.exec(line)) !== null) {
          const start = lineStart + m.index;
          const end = start + kLen - 1;
          for (let p = start; p <= end; p++) {
            const info = get(p);
            map.set(p, {
              ...info,
              hTop: true,
              hBottom: true,
              hLeft: info.hLeft || p === start,
              hRight: info.hRight || p === end,
            });
          }
        }
      }
    }

    if (dirs.includes('v')) {
      for (let row = 0; row + kLen <= totalRows; row++) {
        for (let col = 0; col < charsPerLine; col++) {
          let match = true;
          for (let j = 0; j < kLen; j++) {
            const pos = (row + j) * charsPerLine + col;
            if (pos >= totalChars || fullText[pos].toLowerCase() !== word[j].toLowerCase()) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let j = 0; j < kLen; j++) {
              const pos = (row + j) * charsPerLine + col;
              map.set(pos, { ...get(pos), vd: true });
            }
          }
        }
      }
    }

    if (dirs.includes('d')) {
      // ↘
      for (let row = 0; row + kLen <= totalRows; row++) {
        for (let col = 0; col + kLen <= charsPerLine; col++) {
          let match = true;
          for (let j = 0; j < kLen; j++) {
            const pos = (row + j) * charsPerLine + (col + j);
            if (pos >= totalChars || fullText[pos].toLowerCase() !== word[j].toLowerCase()) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let j = 0; j < kLen; j++) {
              const pos = (row + j) * charsPerLine + (col + j);
              map.set(pos, { ...get(pos), vd: true });
            }
          }
        }
      }
      // ↙
      for (let row = 0; row + kLen <= totalRows; row++) {
        for (let col = kLen - 1; col < charsPerLine; col++) {
          let match = true;
          for (let j = 0; j < kLen; j++) {
            const pos = (row + j) * charsPerLine + (col - j);
            if (pos >= totalChars || fullText[pos].toLowerCase() !== word[j].toLowerCase()) {
              match = false;
              break;
            }
          }
          if (match) {
            for (let j = 0; j < kLen; j++) {
              const pos = (row + j) * charsPerLine + (col - j);
              map.set(pos, { ...get(pos), vd: true });
            }
          }
        }
      }
    }
  }

  return map;
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
  const [newKeywordDirs, setNewKeywordDirs] = useState<string[]>(['h']);

  const userColor = memo.participants.find((p) => p.name === userName)?.color ?? '#888';

  // Build grid data
  const fullText = memo.segments.map((s) => s.text).join('');
  const charColors: string[] = [];
  for (const seg of memo.segments) {
    for (let i = 0; i < seg.text.length; i++) charColors.push(seg.color);
  }
  const highlightInfo = getHighlightInfo(fullText, memo.keywords ?? [], CHARS_PER_LINE);
  const gridRows: { char: string; color: string; pos: number }[][] = [];
  for (let i = 0; i < fullText.length; i += CHARS_PER_LINE) {
    const row: { char: string; color: string; pos: number }[] = [];
    for (let j = i; j < Math.min(i + CHARS_PER_LINE, fullText.length); j++) {
      row.push({ char: fullText[j], color: charColors[j], pos: j });
    }
    gridRows.push(row);
  }

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
        e.preventDefault();
      }
    }
  };

  const toggleDir = (dir: string) => {
    setNewKeywordDirs((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    );
  };

  const handleAddKeyword = async () => {
    const word = keywordInput.trim();
    if (!word || newKeywordDirs.length === 0) return;
    const res = await fetch(`/api/memo/${id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, word, action: 'add', directions: newKeywordDirs }),
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
      {/* Header row 1: title + buttons */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 pt-3 pb-1 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
          共有メモ帳
        </h1>
        <div className="flex-1" />
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
      </div>
      {/* Header row 2: participants */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 pb-2 flex items-center gap-2 overflow-x-auto">
        {memo.participants.length === 0 && (
          <span className="text-xs text-zinc-400">参加者なし</span>
        )}
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

      {/* Config panel */}
      {showConfig && (
        <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">強調キーワード設定</h2>
          <div className="flex gap-3 items-center">
            <span className="text-xs text-zinc-500">方向:</span>
            {[['h', '横'], ['v', '縦'], ['d', '斜め']].map(([dir, label]) => (
              <label key={dir} className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newKeywordDirs.includes(dir)}
                  onChange={() => toggleDir(dir)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
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
              disabled={!keywordInput.trim() || newKeywordDirs.length === 0}
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
                <span className="text-zinc-400">
                  ({k.addedBy} / {(k.directions ?? ['h']).map(d => d === 'h' ? '横' : d === 'v' ? '縦' : '斜').join('・')})
                </span>
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

      {/* Grid content */}
      <main className="flex-1 overflow-auto p-4 flex justify-center">
        {fullText.length === 0 ? (
          <p className="text-center text-zinc-400 mt-16 text-sm self-start w-full">
            まだ内容がありません。最初のメモを書いてみましょう！
          </p>
        ) : (
          <div
            style={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '16px',
              columns: 'auto',
              columnWidth: '23ch',
              columnGap: '0',
              columnRule: '1px solid #9ca3af',
              columnFill: 'auto',
              height: 'calc(100vh - 220px)',
            }}
          >
            {gridRows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                style={{ breakInside: 'avoid', lineHeight: '1.8', padding: '0 8px', width: '23ch' }}
              >
                {row.map((cell, colIdx) => {
                  const info = highlightInfo.get(cell.pos);
                  const style: React.CSSProperties = { color: cell.color };
                  if (info?.vd) {
                    style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    style.borderRadius = '2px';
                  }
                  if (info?.hTop) {
                    style.display = 'inline-block';
                    style.borderTop = '2px solid #ef4444';
                    style.borderBottom = '2px solid #ef4444';
                    style.lineHeight = 'inherit';
                    if (info.hLeft) style.borderLeft = '2px solid #ef4444';
                    if (info.hRight) style.borderRight = '2px solid #ef4444';
                  }
                  return (
                    <span key={colIdx} style={style}>
                      {cell.char}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
