import type { AppView } from '../store/navigationStore';

export type MobileDrawerChoice =
  | { kind: 'toggle-catalog'; expanded: boolean }
  | { kind: 'navigate'; view: Exclude<AppView, 'catalog'> };

/** Catalog requires a second-level choice; other destinations navigate immediately. */
export function resolveMobileDrawerChoice(view: AppView, catalogExpanded: boolean): MobileDrawerChoice {
  if (view === 'catalog') return { kind: 'toggle-catalog', expanded: !catalogExpanded };
  return { kind: 'navigate', view };
}
