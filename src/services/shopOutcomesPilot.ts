/**
 * Rollout gate: the signed-only Edge Function and owner-private RLS must be
 * authenticated-tested and deployed together BEFORE enabling this UI.
 * This flag controls navigation only; server JWT/membership checks enforce access.
 */
export const signedShopOutcomesEnabled = import.meta.env.VITE_SIGNED_SHOP_OUTCOMES === '1';
