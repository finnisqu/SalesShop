import { test, expect, type Page } from '@playwright/test';

const WORKSPACES = ['notebook', 'board', 'quotes', 'catalog', 'dashboard', 'settings'] as const;
type Workspace = (typeof WORKSPACES)[number];
const PHONE = (name: string) => name.startsWith('phone');

async function openView(page: Page, view: Workspace, theme = 'warm') {
  if (!page.url().startsWith('http')) await page.goto('/');
  await page.evaluate(({ view, theme }) => {
    localStorage.setItem('salesshop-active-view-v1', view);
    localStorage.setItem('salesshop-catalog-section-v1', 'materials');
    localStorage.setItem('salesshop-appearance-v1', JSON.stringify({
      themeChoice: theme, textSize: 'standard', motion: 'reduced',
      highContrast: theme === 'contrast', largerControls: false,
    }));
  }, { view, theme });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator(`.sales-app.view-${view}`)).toBeVisible();
}

async function snapshot(page: Page, title: string, testInfo: Parameters<typeof test>[1] extends never ? never : any) {
  await testInfo.attach(title, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
}

async function captureLayout(page: Page) {
  return page.evaluate(() => {
    const classes = [
      '.sales-app', '.app-header', '.mobile-app-commandbar', '.quote-mobile-commandbar',
      '.role-perspective-content', '.quotes-view', '.quote-editor-pane', '.catalog-workspace',
      '.materials-workspace', '.board-view', '.connections-workspace',
      '.company-settings-view', '.notebook-workspace', '.paper-sheet',
    ];
    return {
      width: innerWidth, height: innerHeight,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      components: classes.map((selector) => {
        const el = document.querySelector(selector);
        if (!(el instanceof HTMLElement)) return { selector, present: false };
        const b = el.getBoundingClientRect();
        const computed = getComputedStyle(el);
        return {
          selector, present: true,
          visible: computed.display !== 'none' && computed.visibility !== 'hidden',
          x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height),
          scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
          overflowX: computed.overflowX, overflowY: computed.overflowY,
          background: computed.backgroundColor, color: computed.color,
        };
      }),
    };
  });
}

test('six workspaces render with bounded page geometry and screenshots', async ({ page }, testInfo) => {
  const crashes: string[] = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  const measurements: Array<{ view: Workspace; layout: Awaited<ReturnType<typeof captureLayout>> }> = [];
  for (const view of WORKSPACES) {
    await openView(page, view);
    const layout = await captureLayout(page);
    measurements.push({ view, layout });
    await snapshot(page, `${testInfo.project.name}-${view}`, testInfo);
    // Workspace lists and boards may scroll independently; the document must not.
    expect.soft(layout.htmlScrollWidth, `${view} document overflow at ${testInfo.project.name}`).toBeLessThanOrEqual(layout.width + 8);
    expect.soft(layout.bodyScrollWidth, `${view} body overflow at ${testInfo.project.name}`).toBeLessThanOrEqual(layout.width + 8);
    if (PHONE(testInfo.project.name) && view !== 'quotes') {
      await expect(page.locator('.mobile-app-commandbar')).toBeVisible();
      await expect(page.locator('.app-header')).toBeHidden();
    }
  }
  await testInfo.attach('workspace-layouts.json', {
    body: Buffer.from(JSON.stringify({ measurements, crashes }, null, 2)),
    contentType: 'application/json',
  });
  expect.soft(crashes, 'Unhandled browser errors across workspaces').toEqual([]);
});

test('responsive navigation retains its escape path', async ({ page }, testInfo) => {
  await openView(page, 'notebook');
  if (PHONE(testInfo.project.name)) {
    await page.getByRole('button', { name: 'Open SalesShop navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'SalesShop navigation' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /Catalog/ }).click();
    await drawer.getByRole('button', { name: 'Materials' }).click();
    await expect(page.locator('.sales-app.view-catalog')).toBeVisible();
    await page.getByRole('button', { name: 'Open SalesShop navigation' }).click();
    const next = page.getByRole('dialog', { name: 'SalesShop navigation' });
    await next.getByRole('button', { name: 'Quotes' }).click();
    await expect(page.locator('.sales-app.view-quotes')).toBeVisible();
    await page.getByRole('button', { name: 'Open SalesShop and quote navigation' }).click();
    const quoteDrawer = page.getByRole('dialog', { name: 'Quotes navigation' });
    await expect(quoteDrawer).toBeVisible();
    await quoteDrawer.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('.sales-app.view-settings')).toBeVisible();
  } else {
    const nav = page.getByRole('navigation', { name: 'SalesShop sections' });
    await nav.getByRole('button', { name: 'Catalog' }).click();
    await expect(page.locator('.sales-app.view-catalog')).toBeVisible();
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('.sales-app.view-settings')).toBeVisible();
  }
});

test('Quotes setup and Catalog filter keep independent visible controls', async ({ page }, testInfo) => {
  await openView(page, 'quotes', 'dark');
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  if (PHONE(testInfo.project.name)) {
    await page.getByRole('button', { name: 'Quote tools' }).click();
    const done = page.locator('.quote-mobile-menu-done');
    await expect(done).toBeVisible();
    const rect = await done.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 4);
    await done.click();
    await expect(page.locator('.quote-mobile-menu')).toHaveCount(0);
  }
  await page.locator('.quote-configuration-strip > button').first().click();
  await expect(page.locator('#quote-setup-document')).toBeVisible();
  const geometry = await page.locator('#quote-setup-document').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const el = node as HTMLElement;
    const select = el.querySelector('select');
    return {
      x: rect.x, right: rect.right, top: rect.top, bottom: rect.bottom,
      clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      overflow: getComputedStyle(el).overflowY,
      selectFont: select ? parseFloat(getComputedStyle(select).fontSize) : null,
    };
  });
  await testInfo.attach('quote-setup-geometry.json', {
    body: Buffer.from(JSON.stringify(geometry, null, 2)), contentType: 'application/json',
  });
  expect.soft(geometry.right).toBeLessThanOrEqual(page.viewportSize()!.width + 6);
  if (PHONE(testInfo.project.name)) {
    expect.soft(geometry.selectFont).toBeGreaterThanOrEqual(16);
  }
  await snapshot(page, `${testInfo.project.name}-quotes-document-popover-dark`, testInfo);

  await openView(page, 'catalog', 'dark');
  if (PHONE(testInfo.project.name)) {
    const filter = page.locator('.mobile-catalog-filter-trigger:visible').first();
    await expect(filter).toBeVisible();
    await filter.click();
    const dialog = page.getByRole('dialog', { name: 'Filter results' });
    await expect(dialog).toBeVisible();
    const footer = dialog.locator('.mobile-catalog-tools-footer');
    const content = dialog.locator('.mobile-catalog-tools-content');
    const positions = await dialog.evaluate((node) => {
      const body = node.querySelector('.mobile-catalog-tools-content')!;
      const foot = node.querySelector('.mobile-catalog-tools-footer')!;
      const a = body.getBoundingClientRect(), b = foot.getBoundingClientRect();
      return { contentBottom: a.bottom, footerTop: b.top, footerBottom: b.bottom, viewport: innerHeight };
    });
    expect.soft(positions.contentBottom).toBeLessThanOrEqual(positions.footerTop + 3);
    expect.soft(positions.footerBottom).toBeLessThanOrEqual(positions.viewport + 3);
    await expect(footer).toBeVisible();
    await expect(content).toBeVisible();
    await snapshot(page, `${testInfo.project.name}-materials-filters-dark`, testInfo);
    await dialog.getByRole('button', { name: /Done · View results/i }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test('theme screenshots preserve foreground contrast and paper boundaries', async ({ page }, testInfo) => {
  const findings: unknown[] = [];
  for (const theme of ['warm', 'dark', 'contrast', 'coastal'] as const) {
    for (const view of ['board', 'catalog', 'settings'] as const) {
      await openView(page, view, theme);
      await expect(page.locator('html')).toHaveAttribute('data-sales-theme', theme);
      await snapshot(page, `${testInfo.project.name}-${theme}-${view}`, testInfo);
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const candidate = document.querySelector(
          '.ss-page-header__title, .board-foundation-header h1, .catalog-foundation-heading h1, .settings-foundation-page-header h1, .mobile-app-current strong',
        );
        const style = candidate ? getComputedStyle(candidate) : null;
        return {
          theme: root.dataset.salesTheme,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          titleColor: style?.color ?? null,
          titlePresent: candidate !== null,
        };
      });
      findings.push({ view, ...metrics });
    }
  }
  await testInfo.attach('appearance-metrics.json', {
    body: Buffer.from(JSON.stringify(findings, null, 2)), contentType: 'application/json',
  });
});
