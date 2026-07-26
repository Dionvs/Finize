const { expect, test } = require('@playwright/test');

test('financiële tekst blijft letterlijke tekst en voert geen HTML uit', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const payload = '<img src=x onerror="window.__finizeXss=1">';
    window.__finizeXss = 0;
    const tx = {
      id: `tx-" onmouseover="window.__finizeXss=2`,
      date: `${getSelectedMonth()}-01`,
      owner: 'dion',
      kind: 'uitgave',
      amount: 10,
      category: payload,
      description: payload,
      note: payload
    };
    state.transactions.push(tx);
    const transactionHost = document.createElement('div');
    transactionHost.innerHTML = renderTransactionsTable('dion');

    document.getElementById('u4ImportModalRoot')?.remove();
    const draft = {
      id: 'security-import',
      fileName: payload,
      bank: payload,
      format: 'ing',
      status: 'concept',
      accountOwner: 'gezamenlijk',
      rows: [{
        id: `row-" onmouseover="window.__finizeXss=3`,
        certainty: 'nakijken',
        duplicate: false,
        reasons: [payload],
        bankOriginal: {
          valid: true,
          amount: -10,
          description: payload,
          bankDate: '2026-07-01',
          accountIdentifier: payload,
          counterpartyAccount: payload,
          fingerprint: payload,
          lineNumber: 1
        },
        processing: {
          processingDate: '2026-07-01',
          processedAmount: 10,
          budgetOwner: 'gezamenlijk',
          category: payload,
          transactionType: 'uitgave',
          include: true,
          note: payload,
          splits: []
        }
      }],
      summary: {}
    };
    window.FinizeUpdate4Runtime.testRenderDraftModal(window, draft);
    const importModal = document.getElementById('u4ImportModalRoot');
    return {
      xss: window.__finizeXss,
      transactionImages: transactionHost.querySelectorAll('img').length,
      importImages: importModal.querySelectorAll('img').length,
      transactionText: transactionHost.textContent.includes(payload),
      importText: importModal.textContent.includes(payload),
      unsafeImageAccepted: safeImageUrl('javascript:alert(1)')
    };
  });
  expect(result).toEqual({
    xss: 0,
    transactionImages: 0,
    importImages: 0,
    transactionText: true,
    importText: true,
    unsafeImageAccepted: ''
  });
});
