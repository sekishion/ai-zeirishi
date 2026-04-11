'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppProvider } from '@/components/AppProvider';
import { useApp } from '@/lib/store';
import { BottomNavConnected } from '@/components/shared/BottomNavConnected';

const NO_NAV_PAGES = ['/line', '/onboarding', '/login'];

// これらのページはAppProvider不要（認証・状態管理をバイパス）
function isPublicPage(pathname: string): boolean {
  return pathname === '/lp'
    || pathname === '/login'
    || pathname === '/terms'
    || pathname === '/privacy'
    || pathname.startsWith('/liff/');
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useApp();
  const hideNav = NO_NAV_PAGES.includes(pathname);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!state.setupCompleted && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [state.setupCompleted, pathname, router]);

  if (hideNav) {
    return <main>{children}</main>;
  }

  return (
    <>
      <main className="pb-[68px] px-4 pt-6 max-w-2xl mx-auto">
        {children}
      </main>
      <BottomNavConnected />
    </>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 公開ページはAppProvider（認証・状態管理）をスキップして直接レンダリング
  if (isPublicPage(pathname)) {
    return <>{children}</>;
  }

  return (
    <AppProvider>
      <LayoutInner>{children}</LayoutInner>
    </AppProvider>
  );
}
