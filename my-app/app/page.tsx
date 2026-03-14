import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';

export default function Home() {
  async function createMemo() {
    'use server';
    const id = randomUUID();
    redirect(`/memo/${id}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          共有メモ帳
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
          リンクを知っている人だけがアクセスできる、
          <br />
          プライベートなメモを作成します。
        </p>
        <form action={createMemo}>
          <button
            type="submit"
            className="px-6 py-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-full font-medium hover:opacity-80 transition-opacity"
          >
            新しいメモを作成
          </button>
        </form>
      </div>
    </div>
  );
}
