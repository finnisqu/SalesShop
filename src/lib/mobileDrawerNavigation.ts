import type {AppView} from '../store/navigationStore';

/** Every top-level destination, including Catalog, opens directly.
 * Nested Catalog navigation belongs to the Catalog workspace header. */
export type MobileDrawerChoice={kind:'navigate';view:AppView};

export function resolveMobileDrawerChoice(view:AppView):MobileDrawerChoice{
 return {kind:'navigate',view};
}
