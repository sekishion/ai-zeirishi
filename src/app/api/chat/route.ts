import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { deepseek, SYSTEM_PROMPT } from '@/lib/deepseek';

export async function POST(req: NextRequest) {
  // 認証必須（コスト爆発・DoS防止）
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => { /* read-only */ },
      },
    }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { messages, context } = await req.json();

    const systemMessage = context
      ? `${SYSTEM_PROMPT}\n\n## 現在の経営データ\n${context}`
      : SYSTEM_PROMPT;

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      temperature: 0.2,  // 経理回答の一貫性のため低めに（旧0.7）
      max_tokens: 1500,
      stream: false,
    });

    const content = response.choices[0]?.message?.content || 'すみません、回答を生成できませんでした。';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('DeepSeek API error:', error);
    return NextResponse.json(
      { error: 'AIへの接続に失敗しました。しばらく待ってから再度お試しください。' },
      { status: 500 }
    );
  }
}
