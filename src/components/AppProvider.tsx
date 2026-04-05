'use client';

import { useReducer, useEffect, useState } from 'react';
import { AppContext, appReducer, getInitialState, getEmptyState, loadFromStorage } from '@/lib/store';
import { loadAllFromSupabase } from '@/lib/supabase-db';
import { createSupabaseBrowserClient } from '@/lib/auth';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // 認証済み → Supabaseから読み込み（mockデータは使わない）
        const dbData = await loadAllFromSupabase();
        if (dbData) {
          const base = getEmptyState();
          dispatch({
            type: 'LOAD_STATE',
            state: {
              ...base,
              companyId: dbData.companyId,
              transactions: dbData.transactions,
              pendingItems: dbData.pendingItems,
              companyName: dbData.companyName,
              ownerName: dbData.ownerName,
              setupCompleted: dbData.setupCompleted,
              companyInfo: dbData.companyInfo,
            },
          });
        }
      } else {
        // 未認証 → localStorageのみ
        const saved = loadFromStorage();
        if (saved) {
          dispatch({ type: 'LOAD_STATE', state: saved });
        }
      }

      setHydrated(true);
    }

    init();
  }, []);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
