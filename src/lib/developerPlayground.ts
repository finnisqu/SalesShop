/** Strictly local, browser-owned development preview. Never grants tenant rights. */
export function isDeveloperPlaygroundRoute(): boolean {
  return typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('studio') === 'playground';
}

/** All persisted local workspace data receives a distinct sandbox namespace. */
export function scopedStorageKey(original: string): string {
  return isDeveloperPlaygroundRoute() ? `salesshop-playground-v1:${original}` : original;
}

export function playgroundUrl(): string {
  const url = new URL(window.location.href);
  url.search = '?studio=playground';
  url.hash = '';
  return url.toString();
}

export function leavePlaygroundUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('studio');
  url.hash = '';
  return url.toString();
}

/** Never clear normal client workspace state or Supabase Auth session. */
export function resetPlaygroundStorage(): void {
  if (!isDeveloperPlaygroundRoute()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith('salesshop-playground-v1:')) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
