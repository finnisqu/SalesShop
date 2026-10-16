import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import type {SignedShopOutcome} from './shopOutcomeProjection';
import {sanitizeSignedShopOutcomes} from './shopOutcomesReader';

type OutcomeResponse = {outcomes?: unknown;limit?: number;error?: string};

/**
 * This does NOT derive results from the client's quote store or local admin
 * cache. The server verifies the signed-in user's organization membership and
 * projects only immutable signed customer commitments.
 *
 * Unavailable until shop-outcomes is deployed and the privacy release gate
 * has passed. This service is intentionally not mounted in Team Quotes yet.
 */
export async function loadSignedShopOutcomes():Promise<SignedShopOutcome[]> {
  const auth=useAuthStore.getState();
  if(!supabase || auth.mode!=='cloud' || !auth.session || !auth.organizationId)
    throw new Error('Sign in to your cloud workspace to view shop outcomes.');
  if(auth.teamRole!=='owner'&&auth.teamRole!=='admin')
    throw new Error('This workspace role cannot access company shop outcomes.');

  const {data,error}=await supabase.functions.invoke<OutcomeResponse>('shop-outcomes',{
    body:{organizationId:auth.organizationId},
  });
  if(error)throw new Error('Could not load shop outcomes.');
  if(data?.error)throw new Error(data.error);
  return sanitizeSignedShopOutcomes(data?.outcomes);
}
