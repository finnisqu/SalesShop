import { create } from 'zustand';
import type {
  SupplierImportCandidate,
  SupplierImportPriceEvidence,
  SupplierImportReviewDecision,
  SupplierImportSession,
} from '../types/supplierImport';

interface SupplierImportState {
  session: SupplierImportSession | null;
  history: SupplierImportSession[];
  hydrated: boolean;
  hydrate: () => void;
  setSession: (session: SupplierImportSession) => void;
  setEffectiveDate: (effectiveDate?: string) => void;
  setCandidateDecision: (candidateId: string, decision: SupplierImportReviewDecision) => void;
  setVariantDecision: (candidateId: string, variantId: string, decision: SupplierImportReviewDecision) => void;
  setPriceDecision: (candidateId: string, optionId: string, decision: SupplierImportReviewDecision) => void;
  setCandidateNote: (candidateId: string, note: string) => void;
  openHistorySession: (sessionId: string) => void;
  clearSession: () => void;
}

const LOCAL_KEY = 'salesshop-supplier-import-staging-v2';
const LEGACY_KEY = 'salesshop-supplier-import-staging-v1';
const HISTORY_LIMIT = 5;

function allPriceIds(candidate: SupplierImportCandidate) {
  return (candidate.material.variants ?? []).flatMap((variant) => variant.purchaseOptions.map((option) => option.id));
}

function inferredEvidence(candidate: SupplierImportCandidate): Record<string, SupplierImportPriceEvidence> {
  const evidence: Record<string, SupplierImportPriceEvidence> = {};
  (candidate.material.variants ?? []).forEach((variant) => {
    variant.purchaseOptions.forEach((option) => {
      const sfListed = typeof option.costPerSf === 'number';
      const unitListed = typeof option.costPerUnit === 'number';
      evidence[option.id] = {
        optionId: option.id,
        effectiveCostPerSf: sfListed ? 'supplier-listed' : 'derived-from-listed-unit',
        costPerSfListed: sfListed,
        costPerUnitListed: unitListed,
        note: sfListed
          ? 'The $/SF value appears explicitly in the supplier price sheet.'
          : 'The effective $/SF is arithmetic only: supplier-listed unit price divided by supplier-listed slab/sheet size.',
      };
    });
  });
  return evidence;
}

function normalizeCandidate(raw: SupplierImportCandidate): SupplierImportCandidate {
  const variantDecisions = { ...(raw.variantDecisions ?? {}) };
  const priceDecisions = { ...(raw.priceDecisions ?? {}) };
  (raw.material.variants ?? []).forEach((variant) => {
    if (!variantDecisions[variant.id]) variantDecisions[variant.id] = 'pending';
    variant.purchaseOptions.forEach((option) => {
      if (!priceDecisions[option.id]) priceDecisions[option.id] = 'pending';
    });
  });
  return {
    ...raw,
    reviewDecision: raw.reviewDecision ?? 'pending',
    variantDecisions,
    priceDecisions,
    priceEvidence: { ...inferredEvidence(raw), ...(raw.priceEvidence ?? {}) },
  };
}

function normalizeSession(raw: unknown): SupplierImportSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<SupplierImportSession> & { schemaVersion?: number };
  if (!value.source || !Array.isArray(value.candidates) || !value.id || !value.createdAt) return null;
  return {
    schemaVersion: 2,
    id: value.id,
    createdAt: value.createdAt,
    source: { ...value.source, rulesReferenceOnly: true },
    candidates: value.candidates.map((candidate) => normalizeCandidate(candidate)),
  };
}

function readState(): { session: SupplierImportSession | null; history: SupplierImportSession[] } {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { session?: unknown; history?: unknown[] };
      const session = normalizeSession(parsed.session);
      const history = (Array.isArray(parsed.history) ? parsed.history : [])
        .map(normalizeSession)
        .filter((item): item is SupplierImportSession => Boolean(item))
        .slice(0, HISTORY_LIMIT);
      return { session, history };
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return { session: null, history: [] };
    const legacy = normalizeSession(JSON.parse(legacyRaw));
    return { session: legacy, history: legacy ? [legacy] : [] };
  } catch {
    return { session: null, history: [] };
  }
}

function writeState(session: SupplierImportSession | null, history: SupplierImportSession[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ session, history: history.slice(0, HISTORY_LIMIT) }));
  } catch {
    // Review staging is convenience state. Storage quota must never block parsing.
  }
}

function updateHistory(history: SupplierImportSession[], session: SupplierImportSession) {
  return [session, ...history.filter((item) => item.id !== session.id)].slice(0, HISTORY_LIMIT);
}

function summarizeDecision(values: SupplierImportReviewDecision[]): SupplierImportReviewDecision {
  if (!values.length) return 'pending';
  if (values.every((value) => value === 'approved')) return 'approved';
  if (values.every((value) => value === 'ignored')) return 'ignored';
  if (values.some((value) => value === 'needs-review')) return 'needs-review';
  return 'pending';
}

function recomputeCandidate(candidate: SupplierImportCandidate): SupplierImportCandidate {
  const variants = candidate.material.variants ?? [];
  const variantDecisions = { ...(candidate.variantDecisions ?? {}) };
  variants.forEach((variant) => {
    const priceValues = variant.purchaseOptions.map((option) => candidate.priceDecisions?.[option.id] ?? 'pending');
    if (priceValues.length) variantDecisions[variant.id] = summarizeDecision(priceValues);
  });
  const reviewDecision = summarizeDecision(variants.map((variant) => variantDecisions[variant.id] ?? 'pending'));
  return { ...candidate, variantDecisions, reviewDecision };
}

function mutateCurrent(
  set: (patch: Partial<SupplierImportState>) => void,
  get: () => SupplierImportState,
  updater: (session: SupplierImportSession) => SupplierImportSession,
) {
  const current = get().session;
  if (!current) return;
  const session = updater(current);
  const history = updateHistory(get().history, session);
  writeState(session, history);
  set({ session, history });
}

export const useSupplierImportStore = create<SupplierImportState>((set, get) => ({
  session: null,
  history: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const saved = readState();
    set({ ...saved, hydrated: true });
  },
  setSession: (rawSession) => {
    const session = normalizeSession(rawSession);
    if (!session) return;
    const history = updateHistory(get().history, session);
    writeState(session, history);
    set({ session, history });
  },
  setEffectiveDate: (effectiveDate) => {
    mutateCurrent(set, get, (current) => ({
      ...current,
      source: { ...current.source, effectiveDate: effectiveDate || undefined },
    }));
  },
  setCandidateDecision: (candidateId, decision) => {
    mutateCurrent(set, get, (current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        const variantDecisions = Object.fromEntries((candidate.material.variants ?? []).map((variant) => [variant.id, decision]));
        const priceDecisions = Object.fromEntries(allPriceIds(candidate).map((optionId) => [optionId, decision]));
        return { ...candidate, reviewDecision: decision, variantDecisions, priceDecisions };
      }),
    }));
  },
  setVariantDecision: (candidateId, variantId, decision) => {
    mutateCurrent(set, get, (current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        const variant = (candidate.material.variants ?? []).find((item) => item.id === variantId);
        const priceDecisions = { ...(candidate.priceDecisions ?? {}) };
        variant?.purchaseOptions.forEach((option) => { priceDecisions[option.id] = decision; });
        return recomputeCandidate({
          ...candidate,
          variantDecisions: { ...(candidate.variantDecisions ?? {}), [variantId]: decision },
          priceDecisions,
        });
      }),
    }));
  },
  setPriceDecision: (candidateId, optionId, decision) => {
    mutateCurrent(set, get, (current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === candidateId
        ? recomputeCandidate({ ...candidate, priceDecisions: { ...(candidate.priceDecisions ?? {}), [optionId]: decision } })
        : candidate),
    }));
  },
  setCandidateNote: (candidateId, note) => {
    mutateCurrent(set, get, (current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === candidateId ? { ...candidate, reviewNote: note } : candidate),
    }));
  },
  openHistorySession: (sessionId) => {
    const session = get().history.find((item) => item.id === sessionId) ?? null;
    if (!session) return;
    writeState(session, get().history);
    set({ session });
  },
  clearSession: () => {
    writeState(null, get().history);
    set({ session: null });
  },
}));
