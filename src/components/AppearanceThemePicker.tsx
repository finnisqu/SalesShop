import { useState } from 'react';
import { useAppearanceStore } from '../store/appearanceStore';
import { useAuthStore } from '../store/authStore';
import { THEME_OPTIONS, themeName, type AppearanceThemeId, type AppearanceThemeChoice } from '../services/appearanceThemes';

function ThemeSample({ swatches }: { swatches: readonly string[] }) {
  return <span className="appearance-theme-sample" style={{ background: swatches[0] }} aria-hidden="true">
    <span className="appearance-theme-sample-bar" style={{ background: swatches[2] }} />
    <span className="appearance-theme-sample-content" style={{ background: swatches[1] }}>
      <span className="appearance-theme-sample-line" style={{ background: swatches[2] }} />
      <span className="appearance-theme-sample-line short" style={{ background: swatches[2] }} />
    </span>
  </span>;
}

export function AppearanceThemePicker() {
  const appearance = useAppearanceStore((state) => state.preferences);
  const companyPalette = useAppearanceStore((state) => state.companyPalette);
  const companyPaletteOrgId = useAppearanceStore((state) => state.companyPaletteOrgId);
  const saving = useAppearanceStore((state) => state.companyPaletteSaving);
  const companyError = useAppearanceStore((state) => state.companyPaletteError);
  const updateAppearance = useAppearanceStore((state) => state.update);
  const saveCompanyPalette = useAppearanceStore((state) => state.saveCompanyPalette);
  const role = useAuthStore((state) => state.teamRole);
  const mode = useAuthStore((state) => state.mode);
  const organizationId = useAuthStore((state) => state.organizationId);
  const canSetCompanyTheme = mode === 'cloud' && Boolean(organizationId) && (role === 'owner' || role === 'admin');
  const [expanded, setExpanded] = useState(false);

  const renderTheme = (
    id: AppearanceThemeId,
    selected: boolean,
    onSelect: () => void,
    disabled = false,
  ) => {
    const theme = THEME_OPTIONS.find((option) => option.id === id)!;
    return <button key={id} type="button" className="appearance-theme-choice"
      aria-pressed={selected} onClick={onSelect} disabled={disabled}
      title={theme.description}>
      <ThemeSample swatches={theme.swatches} />
      <span className="appearance-theme-choice-name">{theme.name}</span>
      <span className="appearance-theme-choice-detail">{theme.description}</span>
      {selected && <span className="appearance-theme-selected" aria-hidden="true">✓ Selected</span>}
    </button>;
  };
  const personalTheme = (id: AppearanceThemeId) =>
    renderTheme(id, appearance.themeChoice === id, () => updateAppearance({ themeChoice: id }));
  const companyTheme = (id: AppearanceThemeId) =>
    renderTheme(id, companyPalette === id, () => {
      if (organizationId) void saveCompanyPalette(organizationId, id);
    }, saving);

  return <div className="appearance-theme-gallery">
    <article className="company-settings-card appearance-theme-panel">
      <header><div><strong>Make SalesShop yours</strong><small>One tap changes your workspace instantly. These colors never change customer quotes.</small></div></header>
      <div className="appearance-theme-section-heading">
        <div><strong>Your appearance</strong><small>Saved on this device; you can always switch back.</small></div>
      </div>
      <div className="appearance-theme-grid">
        {renderTheme('warm', appearance.themeChoice === 'company', () => updateAppearance({ themeChoice:'company' }))}
      </div>
      <div className="appearance-theme-follow-caption">
        <strong>Follow {companyPaletteOrgId ? 'company' : 'SalesShop'} default</strong>
        <span>{companyPaletteOrgId ? `Your company currently uses ${themeName(companyPalette)}.` : 'Follow the classic Warm Paper palette.'} This option stays in sync when the default changes.</span>
      </div>
      <div className="appearance-theme-grid">
        {THEME_OPTIONS.filter((option) => option.category === 'essentials').map((item) => personalTheme(item.id))}
      </div>
      <div className="appearance-theme-section-heading is-secondary">
        <div><strong>Something more personal</strong><small>Subtle personality without getting in the way of work.</small></div>
        <button type="button" className="appearance-theme-expand" aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer' : 'Explore more palettes'} <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
      </div>
      {expanded && <div className="appearance-theme-grid">
        {THEME_OPTIONS.filter((option) => option.category !== 'essentials').map((item) => personalTheme(item.id))}
      </div>}
      {!expanded && appearance.themeChoice !== 'company' && THEME_OPTIONS.some((t) => t.category !== 'essentials' && t.id === appearance.themeChoice) &&
        <div className="appearance-theme-selected-detail">Your active mood: {themeName(appearance.themeChoice as AppearanceThemeId)} · <button type="button" onClick={() => setExpanded(true)}>See palettes</button></div>}
    </article>

    <article className="company-settings-card appearance-theme-panel">
      <header><div><strong>Company palette</strong><small>A familiar look shared across your team, with room for personal choice.</small></div></header>
      <div className="appearance-company-current">
        <span className="appearance-company-dot" style={{ background: THEME_OPTIONS.find((item) => item.id === companyPalette)?.swatches[2] ?? '#987739' }} aria-hidden="true" />
        <div><strong>{themeName(companyPalette)}</strong><small>{companyPaletteOrgId ? 'Default for this company workspace' : 'Default palette when no company is connected'}</small></div>
      </div>
      {canSetCompanyTheme && <div className="appearance-company-edit">
        <label htmlFor="appearance-company-theme-select">Change company default</label>
        <select id="appearance-company-theme-select" value={companyPalette} disabled={saving}
          onChange={(event) => void saveCompanyPalette(organizationId!, event.target.value as AppearanceThemeId)}>
          {THEME_OPTIONS.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
        </select>
        <div className="appearance-company-swatches" aria-label="Company palette swatches">
          {THEME_OPTIONS.filter((item) => item.category !== 'playful').map((item) =>
            <button type="button" key={item.id} className="appearance-company-swatch"
              title={`Set team default to ${item.name}`} aria-label={`Set team default to ${item.name}`}
              aria-pressed={companyPalette === item.id} disabled={saving}
              onClick={() => void saveCompanyPalette(organizationId!, item.id)}
              style={{ background: item.swatches[2] }} />)}
        </div>
      </div>}
      {saving && <p className="settings-help" role="status">Saving company palette…</p>}
      {companyError && <p className="appearance-theme-error" role="alert">Could not save or load company palette: {companyError}</p>}
      <p className="settings-help">{canSetCompanyTheme ?
        'Owners and admins choose the default. Team members can follow it or choose their own palette on their device.' :
        'The company default is managed by an owner or admin. Your personal theme is still your choice.'}</p>
    </article>
  </div>;
}
