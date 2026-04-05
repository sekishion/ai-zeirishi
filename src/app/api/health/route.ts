import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? '✅ set (' + process.env.DEEPSEEK_API_KEY.substring(0, 6) + '...)' : '❌ missing',
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || '❌ missing',
      LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET ? '✅ set' : '❌ missing',
      LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ set (' + process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 10) + '...)' : '❌ missing',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ set' : '❌ missing',
    },
  });
}
