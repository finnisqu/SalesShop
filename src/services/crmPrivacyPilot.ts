/**
 * Must stay off until Stage 14E CRM owner columns, RLS and related RPCs have
 * passed authenticated multi-role testing and the coordinated cloud release.
 * No UI flag can replace actual server-side authorization.
 */
export const privateCrmRlsEnabled=import.meta.env.VITE_PRIVATE_CRM_RLS==='1';
