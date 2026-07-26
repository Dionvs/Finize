const { expect, test } = require('@playwright/test');

test('vijftig importrenders houden één gedelegeerde click- en change-handler', async ({ page }) => {
  await page.goto('/');
  const counts = await page.evaluate(() => {
    document.getElementById('u4ImportModalRoot')?.remove();
    const modal = document.createElement('div');
    modal.id = 'u4ImportModalRoot';
    document.body.appendChild(modal);
    const registrations = { click: 0, change: 0 };
    const nativeAdd = modal.addEventListener.bind(modal);
    modal.addEventListener = (type, listener, options) => {
      if (type === 'click' || type === 'change') registrations[type] += 1;
      return nativeAdd(type, listener, options);
    };
    const draft = {
      id: 'listener-test',
      fileName: 'listener-test.csv',
      bank: 'ING',
      format: 'ing',
      status: 'concept',
      accountOwner: 'gezamenlijk',
      rows: [],
      summary: {}
    };
    for (let index = 0; index < 50; index += 1) {
      window.FinizeUpdate4Runtime.testRenderDraftModal(window, draft);
    }
    return registrations;
  });
  expect(counts).toEqual({ click: 1, change: 1 });
});
