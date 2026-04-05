import { NextRequest, NextResponse } from 'next/server';
import { deepseek } from '@/lib/deepseek';
import { buildGroundedPrompt } from '@/lib/grounding';

interface TransactionInput {
  description: string;
  amount: number;
  type: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transactions, industry = '建設業' } = await req.json() as {
      transactions: TransactionInput[];
      industry?: string;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: '取引データが必要です' }, { status: 400 });
    }

    const txList = transactions.map((tx, i) =>
      `${i + 1}. ${tx.type === 'income' ? '入金' : '出金'} ¥${tx.amount.toLocaleString()} 「${tx.description}」`
    ).join('\n');

    // グラウンディング付きプロンプト（業種別ルール + 現行税法 + 実例）
    const systemPrompt = buildGroundedPrompt(industry);

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `以下の${transactions.length}件の取引を分類してください。JSON配列のみ返してください。\n\n${txList}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
    });

    const raw = response.choices[0]?.message?.content || '[]';

    // JSON部分を抽出（マークダウンコードブロック対応）
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON array');
    }

    const results = JSON.parse(jsonMatch[0]);

    // 件数が合わない場合のフォールバック
    if (results.length < transactions.length) {
      for (let i = results.length; i < transactions.length; i++) {
        results.push({
          category: '未分類',
          categoryLabel: '未分類',
          counterparty: '',
          confidence: 0,
          reason: 'AI応答が不完全でした',
          needsReview: true,
          reviewQuestion: 'この取引の分類を教えてください',
          reviewChoices: [
            { label: '経費', value: '雑費' },
            { label: '売上', value: '売上高' },
          ],
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Categorize API error:', error);
    return NextResponse.json(
      { error: 'AI分類に失敗しました' },
      { status: 500 }
    );
  }
}
