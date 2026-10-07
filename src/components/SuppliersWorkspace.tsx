import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  fetchSupplierImportPublicationHistory,
  type SupplierImportPublicationHistoryRow,
} from '../services/supplierImportPublisher';
import {
  createSupplierProfile,
  fetchSupplierProfiles,
  trackDiscoveredSupplier,
  upsertSupplierProfile,
} from '../services/supplierProfiles';
import {
  fetchSupplierActivities,
  fetchSupplierCommitments,
} from '../services/supplierRelationship';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import type { StockMaterial } from '../types/settings';
import type { SupplierActivity, SupplierCommitment, SupplierProfile } from '../types/supplier';
import { SupplierRelationshipPanels } from './SupplierRelationshipPanels';

type SupplierFreshness = 'missing' | 'stale' | 'due-soon' | 'current' | 'inactive';

interface SupplierRollup {
  key: string;
  name: string;
  profile?: SupplierProfile;
  materials: StockMaterial[];
  brands: string[];
  publications: SupplierImportPublicationHistoryRow[];
  latestPublication?: SupplierImportPublicationHistoryRow;
  latestEffectiveDate?: string;
  nextReviewDate?: string;
  freshness: SupplierFreshness;
}

const statusLabels: Record<SupplierFreshness, string> = {
  missing: 'No pricing',
  stale: 'Pricing due',
  'due-soon': 'Due soon',
  current: 'Current',
  inactive: 'Inactive',
};

function supplierKey(value?: string) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function displayDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return undefined;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue?: string) {
  if (!dateValue) return undefined;
  const target = new Date(`${dateValue.slice(0, 10)}T12:00:00`).valueOf();
  if (!Number.isFinite(target)) return undefined;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function freshnessFor(profile: SupplierProfile | undefined, latestEffectiveDate?: string, nextReviewDate?: string): SupplierFreshness {
  if (profile?.active === false) return 'inactive';
  if (!latestEffectiveDate) return 'missing';
  const remaining = daysUntil(nextReviewDate);
  if (remaining === undefined) return 'current';
  if (remaining < 0) return 'stale';
  if (remaining <= 45) return 'due-soon';
  return 'current';
}

function pricingAgeLabel(value?: string) {
  if (!value) return 'No published pricing';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return 'Pricing date unknown';
  const days = Math.max(0, Math.floor((Date.now() - date.valueOf()) / 86_400_000));
  if (days < 45) return `${days} day${days === 1 ? '' : 's'} old`;
  const months = Math.round(days / 30.44);
  return `about ${months} month${months === 1 ? '' : 's'} old`;
}

function publicationIdentity(publication: SupplierImportPublicationHistoryRow) {
  return publication.effectiveDate ?? publication.publishedAt.slice(0, 10);
}

export function SuppliersWorkspace() {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [publications, setPublications] = useState<SupplierImportPublicationHistoryRow[]>([]);
  const [activities, setActivities] = useState<SupplierActivity[]>([]);
  const [commitments, setCommitments] = useState<SupplierCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SupplierProfile>>({});

  const refresh = async () => {
    setLoadError(null);
    try {
      const [nextProfiles, nextPublications, nextActivities, nextCommitments] = await Promise.all([
        fetchSupplierProfiles(),
        fetchSupplierImportPublicationHistory(100),
        fetchSupplierActivities(),
        fetchSupplierCommitments(),
      ]);
      setProfiles(nextProfiles);
      setPublications(nextPublications);
      setActivities(nextActivities);
      setCommitments(nextCommitments);
      setDrafts(Object.fromEntries(nextProfiles.map((profile) => [profile.id, profile])));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const rollups = useMemo(() => {
    const names = new Map<string, string>();

    profiles.forEach((profile) => names.set(supplierKey(profile.name), profile.name));
    materials.forEach((material) => {
      if (material.supplier?.trim()) names.set(supplierKey(material.supplier), material.supplier.trim());
    });
    publications.forEach((publication) => {
      const name = publication.supplier.trim();
      if (name && !/^\d+\s+suppliers?$/i.test(name)) names.set(supplierKey(name), name);
    });

    return [...names.entries()].map(([key, name]): SupplierRollup => {
      const profile = profiles.find((candidate) => supplierKey(candidate.name) === key);
      const supplierMaterials = materials.filter((material) => supplierKey(material.supplier) === key);
      const supplierPublications = publications
        .filter((publication) => supplierKey(publication.supplier) === key)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      const latestPublication = supplierPublications[0];
      const latestEffectiveDate = supplierPublications
        .map(publicationIdentity)
        .sort((a, b) => b.localeCompare(a))[0];
      const cadenceMonths = profile?.pricingCadenceMonths ?? 12;
      const nextReviewDate = profile?.nextPricingReviewDate
        ?? (latestEffectiveDate ? addMonths(latestEffectiveDate, cadenceMonths) : undefined);
      const brands = [...new Set(supplierMaterials
        .map((material) => material.brand?.trim())
        .filter((value): value is string => Boolean(value)))]
        .sort();

      return {
        key,
        name: profile?.name ?? name,
        profile,
        materials: supplierMaterials,
        brands,
        publications: supplierPublications,
        latestPublication,
        latestEffectiveDate,
        nextReviewDate,
        freshness: freshnessFor(profile, latestEffectiveDate, nextReviewDate),
      };
    }).sort((a, b) => {
      const rank: Record<SupplierFreshness, number> = { missing: 0, stale: 1, 'due-soon': 2, current: 3, inactive: 4 };
      return rank[a.freshness] - rank[b.freshness] || a.name.localeCompare(b.name);
    });
  }, [profiles, materials, publications]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rollups.filter((supplier) => !needle
      || `${supplier.name} ${supplier.brands.join(' ')} ${statusLabels[supplier.freshness]}`.toLowerCase().includes(needle));
  }, [rollups, query]);

  const counts = useMemo(() => ({
    total: rollups.filter((supplier) => supplier.freshness !== 'inactive').length,
    current: rollups.filter((supplier) => supplier.freshness === 'current').length,
    due: rollups.filter((supplier) => supplier.freshness === 'due-soon' || supplier.freshness === 'stale').length,
    missing: rollups.filter((supplier) => supplier.freshness === 'missing').length,
  }), [rollups]);

  const addSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name || adding) return;
    setAdding(true);
    setLoadError(null);
    try {
      const created = await createSupplierProfile(name);
      setNewSupplierName('');
      await refresh();
      setExpandedKey(supplierKey(created.name));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier could not be added.');
    } finally {
      setAdding(false);
    }
  };

  const trackSupplier = async (supplier: SupplierRollup) => {
    setSavingId(supplier.key);
    setLoadError(null);
    try {
      const profile = await trackDiscoveredSupplier(supplier.name);
      setProfiles((current) => [...current.filter((item) => item.id !== profile.id), profile].sort((a, b) => a.name.localeCompare(b.name)));
      setDrafts((current) => ({ ...current, [profile.id]: profile }));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier could not be tracked.');
    } finally {
      setSavingId(null);
    }
  };

  const saveProfile = async (profile: SupplierProfile) => {
    const draft = drafts[profile.id] ?? profile;
    setSavingId(profile.id);
    setLoadError(null);
    try {
      const saved = await upsertSupplierProfile(profile, draft);
      setProfiles((current) => current.map((item) => item.id === saved.id ? saved : item));
      setDrafts((current) => ({ ...current, [saved.id]: saved }));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier changes could not be saved.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="supplier-directory-empty">Opening supplier directory…</div>;

  return (
    <div className="supplier-directory">
      <section className="supplier-directory-summary">
        <div><span>Tracked / discovered</span><strong>{counts.total}</strong></div>
        <div className="is-current"><span>Current</span><strong>{counts.current}</strong></div>
        <div className="is-due"><span>Due / stale</span><strong>{counts.due}</strong></div>
        <div className="is-missing"><span>Missing pricing</span><strong>{counts.missing}</strong></div>
      </section>

      <section className="supplier-directory-controls">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search suppliers or brands…"
          aria-label="Search suppliers"
        />
        <div className="supplier-add-control">
          <input
            value={newSupplierName}
            onChange={(event) => setNewSupplierName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void addSupplier(); }}
            placeholder="Track a missing supplier…"
            aria-label="New supplier name"
          />
          <button type="button" onClick={() => void addSupplier()} disabled={!newSupplierName.trim() || adding}>
            {adding ? 'Adding…' : 'Add supplier'}
          </button>
        </div>
      </section>

      {loadError && <div className="supplier-directory-error">{loadError}</div>}

      <section className="supplier-directory-card">
        <header>
          <div>
            <span className="board-eyebrow">Purchasing relationship directory</span>
            <strong>Supplier pricing health</strong>
            <small>Published pricing history rolls up automatically. Track a supplier manually to flag missing pricing before the first import.</small>
          </div>
        </header>
        <div className="supplier-directory-table-scroll">
          <table className="supplier-directory-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Brands</th>
                <th>Materials</th>
                <th>Latest pricing effective</th>
                <th>Latest publish</th>
                <th>Next review</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => {
                const expanded = expandedKey === supplier.key;
                const draft = supplier.profile ? drafts[supplier.profile.id] ?? supplier.profile : undefined;
                const latestRules = supplier.latestPublication?.supplierRules ?? [];
                const supplierActivities = supplier.profile ? activities.filter((activity) => activity.supplierId === supplier.profile!.id) : [];
                const supplierCommitments = supplier.profile ? commitments.filter((commitment) => commitment.supplierId === supplier.profile!.id) : [];
                const openCommitmentCount = supplierCommitments.filter((commitment) => ['proposed', 'negotiating', 'confirmed'].includes(commitment.status)).length;
                return (
                  <Fragment key={supplier.key}>
                    <tr className={`supplier-directory-row freshness-${supplier.freshness}`}>
                      <td>
                        <strong>{supplier.name}</strong>
                        <small>{supplier.profile ? 'Tracked supplier' : 'Discovered from Materials / imports'}{openCommitmentCount ? ` · ${openCommitmentCount} open commitment${openCommitmentCount === 1 ? '' : 's'}` : ''}</small>
                      </td>
                      <td>
                        <strong>{supplier.brands.length ? supplier.brands.slice(0, 3).join(', ') : '—'}</strong>
                        {supplier.brands.length > 3 && <small>+ {supplier.brands.length - 3} more</small>}
                      </td>
                      <td className="number">{supplier.materials.length}</td>
                      <td>
                        <strong>{displayDate(supplier.latestEffectiveDate)}</strong>
                        <small>{pricingAgeLabel(supplier.latestEffectiveDate)}</small>
                      </td>
                      <td>
                        <strong>{displayDate(supplier.latestPublication?.publishedAt)}</strong>
                        <small>{supplier.latestPublication?.priceListLabel || supplier.latestPublication?.sourceFileName || 'No publication'}</small>
                      </td>
                      <td>
                        <strong>{displayDate(supplier.nextReviewDate)}</strong>
                        <small>{supplier.profile?.nextPricingReviewDate ? 'Manual review date' : supplier.latestEffectiveDate ? `${supplier.profile?.pricingCadenceMonths ?? 12}-month cadence` : 'Starts after first price list'}</small>
                      </td>
                      <td><span className={`supplier-freshness-badge freshness-${supplier.freshness}`}>{statusLabels[supplier.freshness]}</span></td>
                      <td><button type="button" onClick={() => setExpandedKey((current) => current === supplier.key ? null : supplier.key)}>{expanded ? 'Close' : 'Details'}</button></td>
                    </tr>
                    {expanded && (
                      <tr className="supplier-directory-detail-row">
                        <td colSpan={8}>
                          <div className="supplier-directory-detail">
                            <section className="supplier-profile-panel">
                              <header>
                                <div><span className="board-eyebrow">Supplier profile</span><strong>{supplier.name}</strong></div>
                                {!supplier.profile && <button type="button" onClick={() => void trackSupplier(supplier)} disabled={savingId === supplier.key}>{savingId === supplier.key ? 'Tracking…' : 'Track supplier'}</button>}
                              </header>
                              {supplier.profile && draft ? (
                                <div className="supplier-profile-form">
                                  <label><span>Supplier name</span><input value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [draft.id]: { ...draft, name: event.target.value } }))} /></label>
                                  <label><span>Pricing cadence</span><select value={draft.pricingCadenceMonths ?? 12} onChange={(event) => setDrafts((current) => ({ ...current, [draft.id]: { ...draft, pricingCadenceMonths: Number(event.target.value) } }))}><option value={3}>Every 3 months</option><option value={6}>Every 6 months</option><option value={12}>Annual</option><option value={18}>Every 18 months</option><option value={24}>Every 24 months</option></select></label>
                                  <label><span>Next pricing review</span><input type="date" value={draft.nextPricingReviewDate ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [draft.id]: { ...draft, nextPricingReviewDate: event.target.value || undefined } }))} /></label>
                                  <label className="supplier-profile-active"><span>Status</span><select value={draft.active ? 'active' : 'inactive'} onChange={(event) => setDrafts((current) => ({ ...current, [draft.id]: { ...draft, active: event.target.value === 'active' } }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                                  <label className="supplier-profile-notes"><span>Relationship / pricing notes</span><textarea value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [draft.id]: { ...draft, notes: event.target.value } }))} placeholder="High-level supplier notes. Detailed activity log and commitments are the next layer." /></label>
                                  <div className="supplier-profile-save"><button type="button" onClick={() => void saveProfile(supplier.profile!)} disabled={savingId === supplier.profile.id}>{savingId === supplier.profile.id ? 'Saving…' : 'Save supplier'}</button></div>
                                </div>
                              ) : (
                                <p>SalesShop discovered this supplier automatically. Track it to set a pricing cadence, next-review date, and relationship notes.</p>
                              )}
                            </section>

                            <section className="supplier-pricing-overview">
                              <header><span className="board-eyebrow">Pricing record</span><strong>{supplier.publications.length} publication{supplier.publications.length === 1 ? '' : 's'}</strong></header>
                              {latestRules.length > 0 && (
                                <div className="supplier-latest-rules">
                                  <strong>Latest published supplier rules</strong>
                                  {latestRules.slice(0, 6).map((rule) => <span key={rule}>{rule}</span>)}
                                  {latestRules.length > 6 && <small>+ {latestRules.length - 6} more in the publication record</small>}
                                </div>
                              )}
                              <div className="supplier-publication-timeline">
                                {supplier.publications.slice(0, 8).map((publication) => (
                                  <article key={publication.id}>
                                    <div>
                                      <strong>{publication.priceListLabel || publication.sourceFileName}</strong>
                                      <span>Effective {displayDate(publication.effectiveDate)} · published {displayDate(publication.publishedAt)}</span>
                                    </div>
                                    <small>{publication.summary.publishedCount ?? 0} published · {publication.summary.newCount ?? 0} new · {publication.summary.updatedCount ?? 0} updated</small>
                                  </article>
                                ))}
                                {!supplier.publications.length && <div className="supplier-directory-empty compact">No supplier pricing has been published yet. This supplier will remain flagged until the first price list is imported.</div>}
                              </div>
                            </section>
                            {supplier.profile ? (
                              <SupplierRelationshipPanels
                                supplier={supplier.profile}
                                activities={supplierActivities}
                                commitments={supplierCommitments}
                                publications={supplier.publications}
                                onActivityCreated={(activity) => setActivities((current) => [activity, ...current])}
                                onCommitmentChanged={(commitment) => setCommitments((current) => [
                                  commitment,
                                  ...current.filter((item) => item.id !== commitment.id),
                                ])}
                              />
                            ) : (
                              <section className="supplier-relationship-track-prompt">
                                <strong>Track this supplier to use the relationship log.</strong>
                                <span>Activity notes and commercial commitments attach to a durable supplier profile, so they stay separate from catalog data.</span>
                                <button type="button" onClick={() => void trackSupplier(supplier)} disabled={savingId === supplier.key}>
                                  {savingId === supplier.key ? 'Tracking…' : 'Track supplier'}
                                </button>
                              </section>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={8}><div className="supplier-directory-empty compact">No suppliers match this search.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
