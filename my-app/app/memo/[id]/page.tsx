'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

type SaveStatus = 'loading' | 'saved' | 'saving' | 'error';

export default function MemoPage() {
  const params = useParams();
  const id = params.id as string;
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [copied, setCopied] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/memo/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content ?? '');
        setStatus('saved');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  const saveMemo = useCallback(
    async (text: string) => {
      setStatus('saving');
      try {
        await fetch(`/api/memo/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [id]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveMemo(text), 1000);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel: Record<SaveStatus, string> = {
    loading: '読み込み中...',
    saving: '保存中...',
    saved: '保存済み ✓',
    error: 'エラー',
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          共有メモ帳
        </h1>
        <div className="flex-1" />
        <span
          className={`text-sm ${
            status === 'error'
              ? 'text-red-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {statusLabel[status]}
        </span>
        <button
          onClick={copyUrl}
          className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
        >
          {copied ? 'コピー済み!' : 'リンクをコピー'}
        </button>
      </header>

      <main className="flex-1 p-4">
        <textarea
          className="w-full h-full min-h-[calc(100vh-4rem)] p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none font-mono text-base text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          value={content}
          onChange={handleChange}
          placeholder="ここにメモを入力してください..."
          disabled={status === 'loading'}
        />
      </main>
    </div>
  );
}
