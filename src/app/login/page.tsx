'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-[36px]">✉️</span>
        </div>
        <h1 className="text-[20px] font-black text-[#1A3A5C] mb-2">メールを送信しました</h1>
        <p className="text-[14px] text-gray-500 text-center leading-relaxed">
          <strong>{email}</strong> にログインリンクを送りました。<br />
          メールを開いてリンクをタップしてください。
        </p>
        <button
          onClick={() => { setSent(false); setEmail(''); }}
          className="mt-8 text-[13px] text-gray-400"
        >
          別のメールアドレスで試す
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1A3A5C] rounded-2xl mx-auto flex items-center justify-center mb-4">
            <span className="text-[28px]">📊</span>
          </div>
          <h1 className="text-[20px] font-black text-[#1A3A5C]">AI経理部長</h1>
          <p className="text-[13px] text-gray-400 mt-1">経理のことは全部おまかせ</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[12px] font-bold text-gray-500 block mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#1A3A5C]"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || loading}
            className="w-full py-3.5 bg-[#1A3A5C] text-white rounded-xl text-[15px] font-bold disabled:opacity-30"
          >
            {loading ? '送信中...' : 'ログインリンクを送信'}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed">
          パスワード不要。メールに届くリンクでログインできます。
        </p>
      </div>
    </div>
  );
}
