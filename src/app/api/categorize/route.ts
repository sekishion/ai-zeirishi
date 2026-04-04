import { NextRequest, NextResponse } from 'next/server';
import { deepseek } from '@/lib/deepseek';

const CATEGORIZE_PROMPT = `あなたは中小企業の経理仕訳AIです。銀行明細の取引を勘定科目に分類してください。

## 使用可能な勘定科目
【収益】売上高, 受取利息, 雑収入
【売上原価】材料仕入高, 外注費
【人件費】役員報酬, 給料手当, 賞与, 法定福利費, 福利厚生費
【経費】地代家賃, 水道光熱費, 通信費, 旅費交通費, 交際費, 会議費, 消耗品費, 車両費, 保険料, リース料, 支払手数料, 荷造運賃, 広告宣伝費, 新聞図書費, 修繕費, 雑費
【税金】租税公課, 減価償却費

## ルール
- 入金(income)は基本「売上高」。利息は「受取利息」
- 出金(expense)は摘要文から最も適切な勘定科目を選ぶ
- 判断に迷う場合はneedsReview: trueにして、社長にわかりやすい質問を添える
- counterpartyは取引先名を摘要文から抽出（不明なら空文字）
- confidenceは0.0〜1.0（0.7未満ならneedsReview: true）

## 出力フォーマット（JSON配列）
各取引について:
{
  "category": "勘定科目の正式名称",
  "categoryLabel": "社長向け表示名",
  "counterparty": "取引先名",
  "confidence": 0.85,
  "reason": "分類理由（1文）",
  "needsReview": false,
  "reviewQuestion": "確認が必要な場合の質問文",
  "reviewChoices": [{"label": "選択肢", "value": "勘定科目名"}]
}`;

interface TransactionInput {
  description: string;
  amount: number;
  type: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transactions } = await req.json() as { transactions: TransactionInput[] };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: '取引データが必要です' }, { status: 400 });
    }

    const txList = transactions.map((tx, i) =>
      `${i + 1}. ${tx.type === 'income' ? '入金' : '出金'} ¥${tx.amount.toLocaleString()} 「${tx.description}」`
    ).join('\n');

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: CATEGORIZE_PROMPT },
        { role: 'user', content: `以下の${transactions.length}件の取引を分類してください。JSON配列のみ返してください。\n\n${txList}` },
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
