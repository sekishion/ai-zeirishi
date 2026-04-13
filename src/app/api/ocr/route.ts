import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { INDUSTRY_RULES } from '@/lib/grounding';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    const { image, industry } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
    }

    // base64 data URL から raw base64 を抽出
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const industryRules = INDUSTRY_RULES[industry || '建設業'] || INDUSTRY_RULES['建設業'];

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      `このレシート・領収書を読み取り、以下の業種ルールに基づいて仕訳分類してください。

## 業種ルール
${industryRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 出力（JSONのみ返すこと）
{
  "amount": 税込金額（数値。読めなければnull）,
  "store": "店名",
  "date": "YYYY-MM-DD（読めなければnull）",
  "items": "主な品目（短く）",
  "category": "勘定科目（上記ルールに従う）",
  "categoryLabel": "表示名",
  "confidence": 0.0〜1.0
}`,
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: '読み取りに失敗しました' }, { status: 400 });
  } catch (error) {
    console.error('[OCR API] Error:', error);
    return NextResponse.json({ error: 'レシートの読み取りに失敗しました' }, { status: 500 });
  }
}
