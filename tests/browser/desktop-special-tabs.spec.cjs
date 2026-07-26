const { expect, test } = require('@playwright/test');

function parseEuro(text) {
  return Number(String(text).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
}

test('desktop spaardoelen en data back-up renderen volledig', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('firestore.googleapis.com')) errors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const dashboardIncomeValues = await page.locator('#tab-dashboard .u5-primary-kpi .metric-value').allTextContents();
  expect(dashboardIncomeValues).toHaveLength(4);
  expect(parseEuro(dashboardIncomeValues[2])).toBeCloseTo(
    parseEuro(dashboardIncomeValues[0]) + parseEuro(dashboardIncomeValues[1]),
    2
  );
  const flowIcon = await page.locator('.u5-flow-list > div').nth(1).locator('span').evaluate(element =>
    getComputedStyle(element, '::before').content
  );
  expect(flowIcon).toBe('"−"');
  await expect(page.locator('.u5-flow-list')).not.toContainText('âˆ');

  await page.locator('.v4-sidebar [data-tab="dion"]').click();
  const dionBudget = page.locator('#tab-dion .card').filter({ hasText: 'Budgetgebruik deze maand' }).first();
  await expect(dionBudget).toBeVisible();
  await expect(dionBudget.locator('.progress-item').first()).toBeVisible();
  await expect(dionBudget).toContainText('Dion');
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="dion"]')).toBeVisible();
  await expect(page.locator('#tab-dion .u5-joint-activity-row')).toHaveCount(1);
  await expect(page.locator('#tab-dion .u5-fixed-costs-overview')).toBeVisible();
  await expect(page.locator('#tab-dion .u5-joint-goals-preview')).toBeVisible();
  await expect(page.locator('#tab-dion .manage-stack')).not.toContainText('Eigen vaste lasten');
  await page.locator('.overview-kpi-row [data-u3-planning-owner="dion"]').click();
  const dionFixedDialog = page.getByRole('dialog');
  await expect(dionFixedDialog.getByRole('heading', { name: 'Dion vaste lasten' })).toBeVisible();
  await expect(dionFixedDialog).not.toContainText('Inkomstenbronnen');
  const dionFixedRows = dionFixedDialog.locator('.u3-admin-row');
  for (let index = 0; index < await dionFixedRows.count(); index += 1) {
    await expect(dionFixedRows.nth(index)).toContainText('→ Dion');
  }
  await dionFixedDialog.getByRole('button', { name: 'Sluiten' }).click();

  await page.locator('.v4-sidebar [data-tab="dara"]').click();
  const daraBudget = page.locator('#tab-dara .card').filter({ hasText: 'Budgetgebruik deze maand' }).first();
  await expect(daraBudget).toBeVisible();
  await expect(daraBudget.locator('.progress-item').first()).toBeVisible();
  await expect(daraBudget).toContainText('Dara');
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="dara"]')).toBeVisible();
  await expect(page.locator('#tab-dara .u5-fixed-costs-overview')).toBeVisible();
  await expect(page.locator('#tab-dara .u5-joint-goals-preview')).toBeVisible();

  await page.locator('.v4-sidebar [data-tab="gezamenlijk"]').click();
  await expect(page.locator('#tab-gezamenlijk .u5-joint-budget-card')).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk')).not.toContainText('Recente gezamenlijke uitgaven');
  await expect(page.locator('.overview-kpi-row [data-u3-planning-owner="gezamenlijk"]')).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk .u5-fixed-costs-overview')).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk .u5-joint-goals-preview')).toBeVisible();
  await expect(page.locator('#tab-gezamenlijk .manage-stack')).not.toContainText('Beheer vaste lasten');

  await page.locator('.v4-sidebar [data-tab="spaardoelen"]').click();
  await expect(page.locator('#tab-spaardoelen .u5-goal-master')).toBeVisible();
  await expect(page.locator('#tab-spaardoelen .u5-goal-list-card').first()).toBeVisible();
  await expect(page.locator('#tab-spaardoelen .u5-goal-detail')).toBeVisible();

  await page.locator('.v4-sidebar [data-tab="data"]').click();
  await expect(page.locator('#tab-data .u5-data-sections')).toBeVisible();
  await expect(page.locator('#btnExport')).toBeVisible();
  await expect(page.locator('#btnRestoreBackup')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('mobiele spaardoelbalken houden hun vaste breedte', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/');
  const mobileIncomeValues = await page.locator('#tab-dashboard .mobile-kpi-card .mobile-kpi-value').allTextContents();
  expect(mobileIncomeValues).toHaveLength(4);
  expect(parseEuro(mobileIncomeValues[2])).toBeCloseTo(
    parseEuro(mobileIncomeValues[0]) + parseEuro(mobileIncomeValues[1]),
    2
  );
  await page.locator('.v4-bottom-nav [data-tab="spaardoelen"]').click();

  const measurements = await page.locator('#tab-spaardoelen .mobile-goal-main').evaluateAll(items =>
    items.map(item => {
      const amount = item.querySelector(':scope > span');
      const bar = item.querySelector(':scope > .progress-track');
      const inleg = item.querySelector(':scope > .goal-inleg-breakdown');
      return {
        amount: amount?.getBoundingClientRect().width,
        bar: bar?.getBoundingClientRect().width,
        inleg: inleg?.getBoundingClientRect().width,
        amountAlign: amount ? getComputedStyle(amount).textAlign : '',
        inlegAlign: inleg ? getComputedStyle(inleg).textAlign : ''
      };
    })
  );

  expect(measurements.length).toBeGreaterThan(0);
  measurements.forEach(item => {
    expect(item.amount).toBe(104);
    expect(item.bar).toBe(104);
    expect(item.inleg).toBe(104);
    expect(item.amountAlign).toBe('center');
    expect(item.inlegAlign).toBe('center');
  });
});
