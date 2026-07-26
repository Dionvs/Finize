const { expect, test } = require('@playwright/test');

test('een no-op veroorzaakt geen revision of lokale write', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    commitChange(() => {}, { render: false });
    const beforeRevision = Number(window.state.meta.revision) || 0;
    let saves = 0;
    const originalSave = DataAdapter.save;
    DataAdapter.save = (...args) => {
      saves += 1;
      return originalSave.apply(DataAdapter, args);
    };
    const ok = commitChange(() => {}, { render: false });
    DataAdapter.save = originalSave;
    return {
      ok,
      saves,
      beforeRevision,
      afterRevision: Number(window.state.meta.revision) || 0
    };
  });
  expect(result).toEqual({
    ok: true,
    saves: 0,
    beforeRevision: result.beforeRevision,
    afterRevision: result.beforeRevision
  });
});

test('backdrop sluit ook na interne klikken en na opnieuw openen', async ({ page }) => {
  await page.goto('/');
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.evaluate(() => openTransactionModal());
    const modal = page.locator('#transactionModal');
    await expect(modal).toHaveClass(/open/);
    await modal.locator('#txAmount').click();
    await expect(modal).toHaveClass(/open/);
    await modal.click({ position: { x: 2, y: 2 } });
    await expect(modal).not.toHaveClass(/open/);
  }
});
