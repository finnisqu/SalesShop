import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useSignatureStore } from '../store/signatureStore';
import type { CrmBrokenLink } from './crmIdentity';

function hydrateIdentityStores() {
  useCrmStore.getState().hydrate();
  useQuoteStore.getState().hydrate();
  useSignatureStore.getState().hydrate();
}

async function cloudMerge(rpc: 'merge_crm_company_identity' | 'merge_crm_contact_identity', primaryId: string, duplicateId: string) {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) return;
  const { error } = await supabase.rpc(rpc, {
    p_organization_id: auth.organizationId,
    p_primary_id: primaryId,
    p_duplicate_id: duplicateId,
  });
  if (error) throw new Error(error.message);
}

export async function mergeCompanyIdentity(primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) return;
  hydrateIdentityStores();
  const crm = useCrmStore.getState();
  if (!crm.companies.some((company) => company.id === primaryId) || !crm.companies.some((company) => company.id === duplicateId)) {
    throw new Error('One of these account records changed. Refresh the cleanup review before merging.');
  }

  await cloudMerge('merge_crm_company_identity', primaryId, duplicateId);
  useCrmStore.getState().mergeCompanyRecords(primaryId, duplicateId);
  const primary = useCrmStore.getState().companies.find((company) => company.id === primaryId);
  if (!primary) throw new Error('The primary account could not be resolved after merge.');
  useQuoteStore.getState().relinkCompanyIdentity(primary, duplicateId);
  useSignatureStore.getState().relinkCompanyIdentity(primaryId, duplicateId);
}

export async function mergeContactIdentity(primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) return;
  hydrateIdentityStores();
  const crm = useCrmStore.getState();
  const primaryBefore = crm.contacts.find((contact) => contact.id === primaryId);
  const duplicateBefore = crm.contacts.find((contact) => contact.id === duplicateId);
  if (!primaryBefore || !duplicateBefore) {
    throw new Error('One of these contact records changed. Refresh the cleanup review before merging.');
  }
  if (primaryBefore.companyId && duplicateBefore.companyId && primaryBefore.companyId !== duplicateBefore.companyId) {
    throw new Error('These contacts belong to different accounts. Reassign the contact or merge the accounts first.');
  }

  await cloudMerge('merge_crm_contact_identity', primaryId, duplicateId);
  useCrmStore.getState().mergeContactRecords(primaryId, duplicateId);
  const primary = useCrmStore.getState().contacts.find((contact) => contact.id === primaryId);
  if (!primary) throw new Error('The primary contact could not be resolved after merge.');
  useQuoteStore.getState().relinkContactIdentity(primary, duplicateId);
  useSignatureStore.getState().relinkContactIdentity(primaryId, duplicateId);
}

export function repairCrmBrokenLink(issue: CrmBrokenLink) {
  hydrateIdentityStores();
  const crm = useCrmStore.getState();
  if (issue.kind === 'project-company' && issue.projectId && issue.suggestedCompanyId) {
    crm.relinkProjectCompany(issue.projectId, issue.suggestedCompanyId);
    return;
  }
  if (issue.kind === 'quote-company' && issue.quoteId && issue.suggestedCompanyId) {
    const company = crm.companies.find((candidate) => candidate.id === issue.suggestedCompanyId);
    if (!company) throw new Error('Suggested account no longer exists.');
    useQuoteStore.getState().linkQuoteCompany(issue.quoteId, company);
    return;
  }
  if (issue.kind === 'quote-contact' && issue.quoteId && issue.suggestedContactId) {
    const contact = crm.contacts.find((candidate) => candidate.id === issue.suggestedContactId);
    if (!contact) throw new Error('Suggested contact no longer exists.');
    useQuoteStore.getState().linkQuoteContact(issue.quoteId, contact);
    return;
  }
  throw new Error('This broken link needs manual review before SalesShop can repair it safely.');
}
