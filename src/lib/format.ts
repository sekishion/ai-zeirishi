export function formatAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '¥0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100000000) {
    const oku = Math.floor(abs / 100000000);
    const man = Math.round((abs % 100000000) / 10000);
    return sign + (man > 0 ? `${oku}億${man.toLocaleString()}万円` : `${oku}億円`);
  }
  if (abs >= 10000) {
    const man = abs / 10000;
    return sign + (man % 1 === 0 ? `${man.toLocaleString()}万円` : `${man.toFixed(1)}万円`);
  }
  return `${sign}¥${abs.toLocaleString()}`;
}

export function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'おはようございます';
  if (hour >= 11 && hour < 17) return 'こんにちは';
  return 'お疲れさまです';
}

export function getDaysUntil(deadline: string): number {
  const now = new Date();
  const target = new Date(deadline);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function groupByDate<T extends { date: string }>(transactions: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const tx of transactions) {
    const group = map.get(tx.date) || [];
    group.push(tx);
    map.set(tx.date, group);
  }
  return map;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}
