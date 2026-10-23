import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProviderConfiguration, createProviderClient } from '../functions/src/enable-banking.mjs';
const config = { applicationId: 'synthetic-app', redirectUrl: 'https://synthetic.invalid/callback', aspspName: 'ING' };
const application = { kid: config.applicationId, environment: 'PRODUCTION', active: true, redirect_urls: [config.redirectUrl], countries: ['NL'], services: ['AIS'] };
const bank = { name: 'ING', country: 'NL', psu_types: ['personal'], maximum_consent_validity: 86400 };

test('configuration validation only reads application and connector metadata; returns no provider payload', async () => {
  const calls = [];
  const provider = async (method, path) => { calls.push([method, path]); return path === '/application' ? { ...application, private_extra: 'never-returned' } : { aspsps: [bank] }; };
  const result = await checkProviderConfiguration({ config, provider });
  assert.equal(result.applicationVerified, true);
  assert.deepEqual(calls, [['GET', '/application'], ['GET', '/aspsps?country=NL']]);
  assert(!JSON.stringify(result).includes('never-returned'));
});

test('wrong key ID, inactive or sandbox app, redirect, country and payment services fail before connector lookup', async () => {
  for (const change of [{ kid: 'other' }, { active: false }, { environment: 'SANDBOX' }, { redirect_urls: [] }, { countries: [] }, { services: ['AIS', 'PIS'] }]) {
    const calls = [];
    await assert.rejects(checkProviderConfiguration({ config, provider: async (method, path) => { calls.push(path); return { ...application, ...change }; } }), { code: 'provider-application-mismatch' });
    assert.deepEqual(calls, ['/application']);
  }
});

test('unavailable personal ING connector or invalid consent interval fails closed', async () => {
  for (const change of [{ name: 'other' }, { country: 'BE' }, { psu_types: ['business'] }, { maximum_consent_validity: 0 }]) {
    await assert.rejects(checkProviderConfiguration({ config, provider: async (method, path) => path === '/application' ? application : { aspsps: [{ ...bank, ...change }] } }), { code: 'unsupported-ing-connector' });
  }
});

test('application metadata transport permits GET only and rejects writes before key access', async () => {
  let reads = 0;
  const provider = createProviderClient({ applicationId: 'synthetic', privateKey: () => { reads++; throw new Error('must not read'); } });
  for (const method of ['POST', 'DELETE']) await assert.rejects(provider(method, '/application'), { code: 'unsupported-provider-operation' });
  assert.equal(reads, 0);
});
