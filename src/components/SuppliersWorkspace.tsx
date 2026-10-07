import { useEffect, useMemo, useState } from 'react';
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
import { fetchSupplierActivities, fetchSupplierCommitments } from '../services/supplierRelationship';
import {
  createRulesFromPublished,
  deleteSupplierContact,
  deleteSupplierLocation,
  deleteSupplierRule,
  fetchSupplierContacts,
  fetchSupplierLocations,
  fetchSupplierRules,
  mergeSupplierProfiles,
  saveSupplierContact,
  saveSupplierLocation,
  saveSupplierRule,
} from '../services/supplierDirectory';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import type { StockMaterial } from '../types/settings';
import type {
  SupplierActivity,
  SupplierCommitment,
  SupplierContact,
  SupplierLocation,
  SupplierProfile,
  SupplierRule,
} from '../types/supplier';
import { SupplierRelationshipPanels } from './SupplierRelationshipPanels';

type SupplierFreshness = 'missing' | 'stale' | 'due-soon' | 'current' | 'inactive';
type SupplierFilter = 'all' | 'attention' | 'current' | 'missing';

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

const SELECTED_KEY = 'salesshop-selected-supplier-v1';
const statusLabels: Record<SupplierFreshness, string> = {
  missing: 'No pricing',
  stale: 'Pricing due',
  'due-soon': 'Due soon',
  current: 'Current',
  inactive: 'Inactive',
};

const supplierKey = (value?: string) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function displayDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayAddress(location: SupplierLocation) {
  return [
    location.addressLine1,
    location.addressLine2,
    [location.city, location.stateRegion].filter(Boolean).join(', '),
    location.postalCode,
  ].filter(Boolean).join(' · ');
}

function websiteHref(value?: string) {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return undefined;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function daysUntil(value?: string) {
  if (!value) return undefined;
  const target = new Date(`${value.slice(0, 10)}T12:00:00`).valueOf();
  return Number.isFinite(target) ? Math.ceil((target - Date.now()) / 86_400_000) : undefined;
}

function freshnessFor(profile: SupplierProfile | undefined, latestEffective?: string, nextReview?: string): SupplierFreshness {
  if (profile?.active === false) return 'inactive';
  if (!latestEffective) return 'missing';
  const remaining = daysUntil(nextReview);
  if (remaining === undefined) return 'current';
  if (remaining < 0) return 'stale';
  if (remaining <= 45) return 'due-soon';
  return 'current';
}

function publicationIdentity(publication: SupplierImportPublicationHistoryRow) {
  return publication.effectiveDate ?? publication.publishedAt.slice(0, 10);
}

function emptyContact(supplierId: string): SupplierContact {
  return { id: `supplier_contact_${crypto.randomUUID()}`, supplierId, name: '', isPrimary: false, notes: '' };
}
function emptyLocation(supplierId: string): SupplierLocation {
  return { id: `supplier_location_${crypto.randomUUID()}`, supplierId, label: 'Warehouse', addressLine1: '', notes: '' };
}
function emptyRule(supplierId: string, sortOrder: number): SupplierRule {
  return { id: `supplier_rule_${crypto.randomUUID()}`, supplierId, ruleType: 'General', ruleText: '', active: true, notes: '', sortOrder };
}

export function SuppliersWorkspace() {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const updateSettings = useCompanySettingsStore((state) => state.update);
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [publications, setPublications] = useState<SupplierImportPublicationHistoryRow[]>([]);
  const [activities, setActivities] = useState<SupplierActivity[]>([]);
  const [commitments, setCommitments] = useState<SupplierCommitment[]>([]);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [locations, setLocations] = useState<SupplierLocation[]>([]);
  const [rules, setRules] = useState<SupplierRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SupplierFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const [newSupplierName, setNewSupplierName] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<SupplierProfile | null>(null);
  const [contactDraft, setContactDraft] = useState<SupplierContact | null>(null);
  const [locationDraft, setLocationDraft] = useState<SupplierLocation | null>(null);
  const [ruleDraft, setRuleDraft] = useState<SupplierRule | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const refresh = async () => {
    setLoadError(null);
    try {
      const [p, pub, act, com, con, loc, ruleRows] = await Promise.all([
        fetchSupplierProfiles(),
        fetchSupplierImportPublicationHistory(200),
        fetchSupplierActivities(),
        fetchSupplierCommitments(),
        fetchSupplierContacts(),
        fetchSupplierLocations(),
        fetchSupplierRules(),
      ]);
      setProfiles(p);
      setPublications(pub);
      setActivities(act);
      setCommitments(com);
      setContacts(con);
      setLocations(loc);
      setRules(ruleRows);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

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
      const supplierPublications = publications.filter((publication) => supplierKey(publication.supplier) === key)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      const latestPublication = supplierPublications[0];
      const latestEffectiveDate = supplierPublications.map(publicationIdentity).sort((a, b) => b.localeCompare(a))[0];
      const nextReviewDate = profile?.nextPricingReviewDate
        ?? (latestEffectiveDate ? addMonths(latestEffectiveDate, profile?.pricingCadenceMonths ?? 12) : undefined);
      const brands = [...new Set(supplierMaterials.map((material) => material.brand?.trim())
        .filter((value): value is string => Boolean(value)))].sort();
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
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, materials, publications]);

  useEffect(() => {
    if (!rollups.length) return;
    if (!selectedKey || !rollups.some((supplier) => supplier.key === selectedKey)) setSelectedKey(rollups[0].key);
  }, [rollups, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    try { localStorage.setItem(SELECTED_KEY, selectedKey); } catch { /* best effort */ }
  }, [selectedKey]);

  const selected = rollups.find((supplier) => supplier.key === selectedKey) ?? rollups[0];
  const selectedProfile = selected?.profile;
  const selectedContacts = selectedProfile ? contacts.filter((item) => item.supplierId === selectedProfile.id) : [];
  const selectedLocations = selectedProfile ? locations.filter((item) => item.supplierId === selectedProfile.id) : [];
  const selectedRules = selectedProfile ? rules.filter((item) => item.supplierId === selectedProfile.id && item.active) : [];
  const selectedActivities = selectedProfile ? activities.filter((item) => item.supplierId === selectedProfile.id) : [];
  const selectedCommitments = selectedProfile ? commitments.filter((item) => item.supplierId === selectedProfile.id) : [];
  const latestPublishedRules = selected?.latestPublication?.supplierRules ?? [];
  const openCommitments = selectedCommitments.filter((item) => ['proposed', 'negotiating', 'confirmed'].includes(item.status)).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rollups.filter((supplier) => {
      if (filter === 'attention' && !['missing', 'stale', 'due-soon'].includes(supplier.freshness)) return false;
      if (filter === 'current' && supplier.freshness !== 'current') return false;
      if (filter === 'missing' && supplier.freshness !== 'missing') return false;
      return !needle || `${supplier.name} ${supplier.brands.join(' ')} ${statusLabels[supplier.freshness]}`.toLowerCase().includes(needle);
    });
  }, [rollups, query, filter]);

  const chooseSupplier = (key: string) => {
    setSelectedKey(key);
    setEditingProfile(false);
    setProfileDraft(null);
    setContactDraft(null);
    setLocationDraft(null);
    setRuleDraft(null);
    setMergeOpen(false);
  };

  const addSupplier = async () => {
    if (!newSupplierName.trim() || adding) return;
    setAdding(true); setLoadError(null);
    try {
      const created = await createSupplierProfile(newSupplierName);
      setProfiles((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSupplierName('');
      setSelectedKey(supplierKey(created.name));
      setProfileDraft(created);
      setEditingProfile(true);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier could not be added.');
    } finally { setAdding(false); }
  };

  const trackSelected = async () => {
    if (!selected) return;
    setSaving(true); setLoadError(null);
    try {
      const profile = await trackDiscoveredSupplier(selected.name);
      setProfiles((current) => [...current.filter((item) => item.id !== profile.id), profile].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedKey(supplierKey(profile.name));
      setProfileDraft(profile);
      setEditingProfile(true);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier could not be tracked.');
    } finally { setSaving(false); }
  };

  const saveProfile = async () => {
    if (!selectedProfile || !profileDraft || saving) return;
    setSaving(true); setLoadError(null);
    try {
      const oldKey = supplierKey(selectedProfile.name);
      const saved = await upsertSupplierProfile(selectedProfile, profileDraft);
      setProfiles((current) => current.map((item) => item.id === saved.id ? saved : item));
      if (supplierKey(saved.name) !== oldKey) {
        updateSettings({
          stockMaterials: materials.map((material) => supplierKey(material.supplier) === oldKey ? { ...material, supplier: saved.name } : material),
        });
      }
      setSelectedKey(supplierKey(saved.name));
      setProfileDraft(null);
      setEditingProfile(false);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Supplier changes could not be saved.');
    } finally { setSaving(false); }
  };

  const saveContact = async () => {
    if (!contactDraft || saving) return;
    setSaving(true); setLoadError(null);
    try {
      const saved = await saveSupplierContact(contactDraft);
      setContacts((current) => {
        const next = [saved, ...current.filter((item) => item.id !== saved.id)];
        return saved.isPrimary
          ? next.map((item) => item.supplierId === saved.supplierId && item.id !== saved.id ? { ...item, isPrimary: false } : item)
          : next;
      });
      setContactDraft(null);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Contact could not be saved.'); }
    finally { setSaving(false); }
  };

  const saveLocation = async () => {
    if (!locationDraft || saving) return;
    setSaving(true); setLoadError(null);
    try {
      const saved = await saveSupplierLocation(locationDraft);
      setLocations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setLocationDraft(null);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Location could not be saved.'); }
    finally { setSaving(false); }
  };

  const saveRule = async () => {
    if (!ruleDraft || saving) return;
    setSaving(true); setLoadError(null);
    try {
      const saved = await saveSupplierRule(ruleDraft);
      setRules((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setRuleDraft(null);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Rule could not be saved.'); }
    finally { setSaving(false); }
  };

  const importPublishedRules = async () => {
    if (!selectedProfile || !latestPublishedRules.length || saving) return;
    setSaving(true); setLoadError(null);
    try {
      const created = await createRulesFromPublished(
        selectedProfile.id,
        selected?.latestPublication?.priceListLabel || selected?.latestPublication?.sourceFileName || 'Published price list',
        latestPublishedRules,
      );
      setRules((current) => [...current, ...created]);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Published rules could not be copied.'); }
    finally { setSaving(false); }
  };

  const mergeSelected = async () => {
    if (!selectedProfile || !mergeTargetId || saving) return;
    const target = profiles.find((profile) => profile.id === mergeTargetId);
    if (!target) return;
    if (!window.confirm(`Merge ${selectedProfile.name} into ${target.name}? All supplier relationship records, material supplier labels, and pricing publication history will move to ${target.name}. This cannot be undone here.`)) return;
    setSaving(true); setLoadError(null);
    try {
      await mergeSupplierProfiles(selectedProfile.id, target.id);
      const sourceKey = supplierKey(selectedProfile.name);
      updateSettings({
        stockMaterials: materials.map((material) => supplierKey(material.supplier) === sourceKey ? { ...material, supplier: target.name } : material),
      });
      setSelectedKey(supplierKey(target.name));
      setMergeOpen(false);
      setMergeTargetId('');
      await refresh();
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Suppliers could not be merged.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="supplier-directory-empty">Opening supplier directory…</div>;

  return (
    <div className="supplier-workbench">
      <aside className="supplier-navigator">
        <header><div><span className="board-eyebrow">Reverse CRM</span><strong>Suppliers</strong></div><span>{rollups.length}</span></header>
        <div className="supplier-nav-search">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers or brands…" />
          <div className="supplier-filter-chips">
            {(['all', 'attention', 'current', 'missing'] as SupplierFilter[]).map((value) => (
              <button type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>
                {value === 'all' ? 'All' : value === 'attention' ? 'Needs attention' : value === 'current' ? 'Current' : 'Missing'}
              </button>
            ))}
          </div>
        </div>
        <div className="supplier-nav-list">
          {filtered.map((supplier) => (
            <button type="button" className={`supplier-nav-item ${selected?.key === supplier.key ? 'active' : ''}`} onClick={() => chooseSupplier(supplier.key)} key={supplier.key}>
              <span className={`supplier-nav-status freshness-${supplier.freshness}`} />
              <span className="supplier-nav-copy"><strong>{supplier.name}</strong><small>{supplier.brands.length ? supplier.brands.slice(0, 2).join(', ') : 'No brand linked'}{supplier.brands.length > 2 ? ` +${supplier.brands.length - 2}` : ''}</small></span>
              <span className="supplier-nav-meta">{supplier.materials.length}</span>
            </button>
          ))}
          {!filtered.length && <div className="supplier-nav-empty">No suppliers match this view.</div>}
        </div>
        <div className="supplier-nav-add">
          <input value={newSupplierName} onChange={(event) => setNewSupplierName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addSupplier(); }} placeholder="Add a supplier…" />
          <button type="button" onClick={() => void addSupplier()} disabled={!newSupplierName.trim() || adding}>+</button>
        </div>
      </aside>

      <section className="supplier-record">
        {loadError && <div className="supplier-directory-error">{loadError}</div>}
        {!selected ? <div className="supplier-record-empty"><strong>No supplier selected</strong><span>Add or select a supplier from the navigator.</span></div> : (
          <>
            <header className="supplier-record-header">
              <div className="supplier-record-heading">
                <div className="supplier-record-title-line"><h2>{selected.name}</h2><span className={`supplier-freshness-badge freshness-${selected.freshness}`}>{statusLabels[selected.freshness]}</span></div>
                <p>{selected.brands.length ? selected.brands.join(' · ') : 'No brands linked yet'} · {selected.materials.length} material{selected.materials.length === 1 ? '' : 's'}{openCommitments ? ` · ${openCommitments} open commitment${openCommitments === 1 ? '' : 's'}` : ''}</p>
                {selectedProfile && !editingProfile && <div className="supplier-contact-strip">{selectedProfile.phone && <a href={`tel:${selectedProfile.phone}`}>{selectedProfile.phone}</a>}{selectedProfile.website && <a href={websiteHref(selectedProfile.website)} target="_blank" rel="noreferrer">{selectedProfile.website}</a>}</div>}
              </div>
              <div className="supplier-record-actions">
                {!selectedProfile ? <button type="button" className="primary" onClick={() => void trackSelected()} disabled={saving}>Track supplier</button> : <>
                  <button type="button" onClick={() => { setProfileDraft({ ...selectedProfile }); setEditingProfile(true); }}>Edit supplier</button>
                  <button type="button" onClick={() => setMergeOpen((value) => !value)}>Merge</button>
                </>}
              </div>
            </header>

            <div className="supplier-health-strip">
              <div><span>Pricing effective</span><strong>{displayDate(selected.latestEffectiveDate)}</strong></div>
              <div><span>Most recent publish</span><strong>{displayDate(selected.latestPublication?.publishedAt)}</strong></div>
              <div><span>Next review</span><strong>{displayDate(selected.nextReviewDate)}</strong></div>
              <div><span>Published lists</span><strong>{selected.publications.length}</strong></div>
            </div>

            {mergeOpen && selectedProfile && <section className="supplier-merge-panel">
              <div><strong>Merge duplicate supplier</strong><span>Everything attached to this supplier will move to the supplier you keep.</span></div>
              <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">Choose supplier to keep…</option>{profiles.filter((profile) => profile.id !== selectedProfile.id).map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select>
              <button type="button" className="danger" disabled={!mergeTargetId || saving} onClick={() => void mergeSelected()}>Merge supplier</button>
              <button type="button" onClick={() => { setMergeOpen(false); setMergeTargetId(''); }}>Cancel</button>
            </section>}

            {editingProfile && selectedProfile && profileDraft && <section className="supplier-edit-card">
              <header><div><span className="board-eyebrow">Supplier profile</span><strong>Edit {selected.name}</strong></div><button type="button" onClick={() => { setEditingProfile(false); setProfileDraft(null); }}>×</button></header>
              <div className="supplier-edit-grid">
                <label><span>Name</span><input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label>
                <label><span>Main phone</span><input value={profileDraft.phone ?? ''} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label>
                <label className="wide"><span>Website</span><input value={profileDraft.website ?? ''} onChange={(event) => setProfileDraft({ ...profileDraft, website: event.target.value })} placeholder="supplier.com" /></label>
                <label><span>Pricing cadence</span><select value={profileDraft.pricingCadenceMonths ?? 12} onChange={(event) => setProfileDraft({ ...profileDraft, pricingCadenceMonths: Number(event.target.value) })}><option value={3}>Every 3 months</option><option value={6}>Every 6 months</option><option value={12}>Annual</option><option value={18}>Every 18 months</option><option value={24}>Every 24 months</option></select></label>
                <label><span>Next pricing review</span><input type="date" value={profileDraft.nextPricingReviewDate ?? ''} onChange={(event) => setProfileDraft({ ...profileDraft, nextPricingReviewDate: event.target.value || undefined })} /></label>
                <label><span>Status</span><select value={profileDraft.active ? 'active' : 'inactive'} onChange={(event) => setProfileDraft({ ...profileDraft, active: event.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="wide"><span>Relationship notes</span><textarea value={profileDraft.notes} onChange={(event) => setProfileDraft({ ...profileDraft, notes: event.target.value })} /></label>
              </div>
              <footer><span /><span /><button type="button" onClick={() => { setEditingProfile(false); setProfileDraft(null); }}>Cancel</button><button type="button" className="primary" onClick={() => void saveProfile()} disabled={!profileDraft.name.trim() || saving}>{saving ? 'Saving…' : 'Save supplier'}</button></footer>
            </section>}

            {!selectedProfile ? <section className="supplier-track-callout"><strong>Track {selected.name} to build the relationship record.</strong><span>Pricing history is already visible. Tracking adds contacts, locations, editable rules, notes, commitments, and activity.</span><button type="button" onClick={() => void trackSelected()} disabled={saving}>Track supplier</button></section> : <>
              <div className="supplier-info-grid">
                <section className="supplier-info-card">
                  <header><div><span className="board-eyebrow">People</span><strong>Contacts</strong></div><button type="button" onClick={() => setContactDraft(emptyContact(selectedProfile.id))}>Add</button></header>
                  <div className="supplier-card-list">{selectedContacts.map((contact) => <article key={contact.id}><div><strong>{contact.name}{contact.isPrimary ? ' ★' : ''}</strong><small>{contact.title || 'Supplier contact'}</small></div><div className="supplier-card-links">{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}</div><button type="button" onClick={() => setContactDraft({ ...contact })}>Edit</button></article>)}{!selectedContacts.length && <p className="supplier-soft-empty">No supplier contacts yet.</p>}</div>
                </section>
                <section className="supplier-info-card">
                  <header><div><span className="board-eyebrow">Footprint</span><strong>Warehouses & locations</strong></div><button type="button" onClick={() => setLocationDraft(emptyLocation(selectedProfile.id))}>Add</button></header>
                  <div className="supplier-card-list">{selectedLocations.map((location) => <article key={location.id}><div><strong>{location.label}</strong><small>{displayAddress(location)}</small></div><div className="supplier-card-links">{location.phone && <a href={`tel:${location.phone}`}>{location.phone}</a>}</div><button type="button" onClick={() => setLocationDraft({ ...location })}>Edit</button></article>)}{!selectedLocations.length && <p className="supplier-soft-empty">No warehouse or branch locations yet.</p>}</div>
                </section>
              </div>

              {contactDraft && <section className="supplier-mini-editor">
                <header><strong>{selectedContacts.some((item) => item.id === contactDraft.id) ? 'Edit contact' : 'Add contact'}</strong><button type="button" onClick={() => setContactDraft(null)}>×</button></header>
                <div className="supplier-edit-grid">
                  <label><span>Name</span><input value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} /></label>
                  <label><span>Title / role</span><input value={contactDraft.title ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, title: event.target.value })} /></label>
                  <label><span>Email</span><input type="email" value={contactDraft.email ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></label>
                  <label><span>Phone</span><input value={contactDraft.phone ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} /></label>
                  <label className="check"><input type="checkbox" checked={contactDraft.isPrimary} onChange={(event) => setContactDraft({ ...contactDraft, isPrimary: event.target.checked })} /> Primary contact</label>
                  <label className="wide"><span>Notes</span><textarea value={contactDraft.notes} onChange={(event) => setContactDraft({ ...contactDraft, notes: event.target.value })} /></label>
                </div>
                <footer>{selectedContacts.some((item) => item.id === contactDraft.id) ? <button type="button" className="danger-link" onClick={async () => { if (window.confirm('Delete this supplier contact?')) { await deleteSupplierContact(contactDraft.id); setContacts((current) => current.filter((item) => item.id !== contactDraft.id)); setContactDraft(null); } }}>Delete</button> : <span />}<span /><button type="button" onClick={() => setContactDraft(null)}>Cancel</button><button type="button" className="primary" onClick={() => void saveContact()} disabled={!contactDraft.name.trim() || saving}>Save contact</button></footer>
              </section>}

              {locationDraft && <section className="supplier-mini-editor">
                <header><strong>{selectedLocations.some((item) => item.id === locationDraft.id) ? 'Edit location' : 'Add location'}</strong><button type="button" onClick={() => setLocationDraft(null)}>×</button></header>
                <div className="supplier-edit-grid">
                  <label><span>Label</span><input value={locationDraft.label} onChange={(event) => setLocationDraft({ ...locationDraft, label: event.target.value })} placeholder="Warehouse / showroom / branch" /></label>
                  <label><span>Phone</span><input value={locationDraft.phone ?? ''} onChange={(event) => setLocationDraft({ ...locationDraft, phone: event.target.value })} /></label>
                  <label className="wide"><span>Street address</span><input value={locationDraft.addressLine1} onChange={(event) => setLocationDraft({ ...locationDraft, addressLine1: event.target.value })} /></label>
                  <label className="wide"><span>Address line 2</span><input value={locationDraft.addressLine2 ?? ''} onChange={(event) => setLocationDraft({ ...locationDraft, addressLine2: event.target.value })} /></label>
                  <label><span>City</span><input value={locationDraft.city ?? ''} onChange={(event) => setLocationDraft({ ...locationDraft, city: event.target.value })} /></label>
                  <label><span>State / region</span><input value={locationDraft.stateRegion ?? ''} onChange={(event) => setLocationDraft({ ...locationDraft, stateRegion: event.target.value })} /></label>
                  <label><span>Postal code</span><input value={locationDraft.postalCode ?? ''} onChange={(event) => setLocationDraft({ ...locationDraft, postalCode: event.target.value })} /></label>
                  <label className="wide"><span>Notes</span><textarea value={locationDraft.notes} onChange={(event) => setLocationDraft({ ...locationDraft, notes: event.target.value })} /></label>
                </div>
                <footer>{selectedLocations.some((item) => item.id === locationDraft.id) ? <button type="button" className="danger-link" onClick={async () => { if (window.confirm('Delete this location?')) { await deleteSupplierLocation(locationDraft.id); setLocations((current) => current.filter((item) => item.id !== locationDraft.id)); setLocationDraft(null); } }}>Delete</button> : <span />}<span /><button type="button" onClick={() => setLocationDraft(null)}>Cancel</button><button type="button" className="primary" onClick={() => void saveLocation()} disabled={!locationDraft.addressLine1.trim() || saving}>Save location</button></footer>
              </section>}

              <section className="supplier-rules-card">
                <header><div><span className="board-eyebrow">Working terms</span><strong>Supplier rules</strong><small>Editable rules salespeople should actually work from.</small></div><button type="button" onClick={() => setRuleDraft(emptyRule(selectedProfile.id, selectedRules.length))}>Add rule</button></header>
                <div className="supplier-rule-list">{selectedRules.map((rule) => <article key={rule.id}><span>{rule.ruleType}</span><p>{rule.ruleText}</p>{rule.sourceLabel && <small>Source: {rule.sourceLabel}</small>}<button type="button" onClick={() => setRuleDraft({ ...rule })}>Edit</button></article>)}{!selectedRules.length && <p className="supplier-soft-empty">No curated rules yet.</p>}</div>
                {latestPublishedRules.length > 0 && <details className="supplier-source-rules"><summary>Latest published price-list rules ({latestPublishedRules.length})</summary><div>{latestPublishedRules.map((rule) => <p key={rule}>{rule}</p>)}</div>{!selectedRules.length && <button type="button" onClick={() => void importPublishedRules()} disabled={saving}>Copy these into editable rules</button>}</details>}
              </section>

              {ruleDraft && <section className="supplier-mini-editor">
                <header><strong>{selectedRules.some((item) => item.id === ruleDraft.id) ? 'Edit supplier rule' : 'Add supplier rule'}</strong><button type="button" onClick={() => setRuleDraft(null)}>×</button></header>
                <div className="supplier-edit-grid">
                  <label><span>Rule type</span><input value={ruleDraft.ruleType} onChange={(event) => setRuleDraft({ ...ruleDraft, ruleType: event.target.value })} placeholder="Freight / returns / bundle / special order…" /></label>
                  <label><span>Source label</span><input value={ruleDraft.sourceLabel ?? ''} onChange={(event) => setRuleDraft({ ...ruleDraft, sourceLabel: event.target.value })} placeholder="Optional" /></label>
                  <label className="wide"><span>Rule</span><textarea value={ruleDraft.ruleText} onChange={(event) => setRuleDraft({ ...ruleDraft, ruleText: event.target.value })} /></label>
                  <label className="wide"><span>Notes</span><textarea value={ruleDraft.notes} onChange={(event) => setRuleDraft({ ...ruleDraft, notes: event.target.value })} /></label>
                </div>
                <footer>{selectedRules.some((item) => item.id === ruleDraft.id) ? <button type="button" className="danger-link" onClick={async () => { if (window.confirm('Delete this supplier rule?')) { await deleteSupplierRule(ruleDraft.id); setRules((current) => current.filter((item) => item.id !== ruleDraft.id)); setRuleDraft(null); } }}>Delete</button> : <span />}<span /><button type="button" onClick={() => setRuleDraft(null)}>Cancel</button><button type="button" className="primary" onClick={() => void saveRule()} disabled={!ruleDraft.ruleText.trim() || saving}>Save rule</button></footer>
              </section>}

              <SupplierRelationshipPanels
                supplier={selectedProfile}
                activities={selectedActivities}
                commitments={selectedCommitments}
                publications={selected.publications}
                onActivityCreated={(activity) => setActivities((current) => [activity, ...current])}
                onCommitmentChanged={(commitment) => setCommitments((current) => [commitment, ...current.filter((item) => item.id !== commitment.id)])}
              />

              <section className="supplier-pricing-history">
                <header><div><span className="board-eyebrow">Audit trail</span><strong>Pricing publications</strong></div><span>{selected.publications.length}</span></header>
                <div>{selected.publications.slice(0, 12).map((publication) => <article key={publication.id}><div><strong>{publication.priceListLabel || publication.sourceFileName}</strong><small>Effective {displayDate(publication.effectiveDate)} · published {displayDate(publication.publishedAt)}</small></div><span>{publication.summary.publishedCount ?? 0} published · {publication.summary.updatedCount ?? 0} updated</span></article>)}{!selected.publications.length && <p className="supplier-soft-empty">No pricing has been published for this supplier yet.</p>}</div>
              </section>
            </>}
          </>
        )}
      </section>
    </div>
  );
}
