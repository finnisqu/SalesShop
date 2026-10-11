import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_COMPANY_SETTINGS } from '../types/settings';
import { SettingsIdentityFields, SettingsProfileFields } from './SettingsIdentityFields';

describe('Settings UI Foundation pilot', () => {
  it('renders labeled company fields without changing autosaved values', () => {
    const settings = {
      ...EMPTY_COMPANY_SETTINGS,
      organizationName: 'World Stone',
      address: '123 Sample Road',
      email: 'office@example.com',
    };
    const html = renderToStaticMarkup(<fieldset disabled>
      <SettingsIdentityFields settings={settings} update={() => {}} />
    </fieldset>);
    for (const id of [
      'settings-company-name', 'settings-company-address', 'settings-company-phone',
      'settings-company-email', 'settings-company-website',
    ]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('World Stone');
    expect(html).toContain('123 Sample Road');
    expect(html).toContain('office@example.com');
    expect(html).toContain('disabled=""');
    expect(html).toContain('class="ss-field');
  });

  it('preserves profile loading/disabled and read-only email affordances', () => {
    const html = renderToStaticMarkup(<SettingsProfileFields
      name="Estimator Example" email="estimator@example.com"
      busy onNameChange={() => {}} />);
    expect(html).toContain('Estimator Example');
    expect(html).toContain('disabled=""');
    expect(html).toContain('type="email"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain('Managed by your sign-in account.');
  });

  it('keeps the existing role management, branding and appearance workflows mounted', () => {
    const page = readFileSync(new URL('./CompanySettings.tsx', import.meta.url), 'utf8');
    expect(page).toContain('<PageHeader');
    expect(page).toContain('<Panel');
    expect(page).toContain('<SettingsIdentityFields settings={settings} update={update} />');
    expect(page).toContain('disabled={!canEditCompany}');
    expect(page).toContain('onClick={() => void saveProfile()}');
    expect(page).toContain('<TeamAccessSettings />');
    expect(page).toContain('<AppearanceThemePicker />');
    expect(page).toContain('className="company-branding-preview"');
  });

  it('scopes Settings tokens to its own view and fixes mobile scroll ownership', () => {
    const css = readFileSync(new URL('../design-system/settings-adapter.css', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
    expect(css).toContain('.sales-app.view-settings');
    expect(css).toContain('.settings-foundation-panel');
    expect(css).toContain('.settings-foundation-fields .ss-field');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('height: auto');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(main).toContain("import './design-system/settings-adapter.css'");
    expect(main.indexOf("import './design-system/settings-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './appearance-contrast.css'"));
  });
});
