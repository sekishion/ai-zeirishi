import { NextResponse } from 'next/server';

export async function GET() {
  const check = (v: string | undefined) => v ? 'set' : 'MISSING';
  return NextResponse.json({
    ok: true,
    env: {
      DEEPSEEK_API_KEY: check(process.env.DEEPSEEK_API_KEY),
      LINE_CHANNEL_SECRET: check(process.env.LINE_CHANNEL_SECRET),
      LINE_CHANNEL_ACCESS_TOKEN: check(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      GEMINI_API_KEY: check(process.env.GEMINI_API_KEY),
      NEXT_PUBLIC_SUPABASE_URL: check(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: check(process.env.SUPABASE_SERVICE_ROLE_KEY),
      NEXT_PUBLIC_APP_URL: check(process.env.NEXT_PUBLIC_APP_URL),
      CRON_SECRET: check(process.env.CRON_SECRET),
      LIFF_TOKEN_SECRET: check(process.env.LIFF_TOKEN_SECRET),
    },
  });
}
