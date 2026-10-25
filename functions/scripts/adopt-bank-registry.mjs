import { readFile } from 'node:fs/promises';
import { adoptLegacyBankMetadata, parseBankRegistry } from '../src/bank-registry.mjs';

const arguments_ = process.argv.slice(2);
if (arguments_.includes('--help')) {
  console.log('node functions/scripts/adopt-bank-registry.mjs --config <private-config.json> [--apply]');
  console.log('Default: read-only plan. --apply only adds private adoption/ownership records; preserves the live session and binding in place. Uses existing ADC for financien-7dd43; never reads Secret Manager or calls the bank.');
} else {
  try {
    if (arguments_.some((value, i) => !['--config', '--apply'].includes(value) && arguments_[i-1] !== '--config') ||
        arguments_.filter(value => value === '--config').length !== 1 || arguments_.filter(value => value === '--apply').length > 1) throw new Error('invalid-arguments');
    const filename = arguments_[arguments_.indexOf('--config') + 1];
    if (!filename || filename.startsWith('--')) throw new Error('private-config-required');
    const config = JSON.parse(await readFile(filename, 'utf8'));
    if (config.projectId !== 'financien-7dd43') throw new Error('wrong-project');
    if (!parseBankRegistry(config)) throw new Error('bank-registry-required');
    const { initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore, Timestamp, FieldPath } = await import('firebase-admin/firestore');
    const { createBankMetadataStore } = await import('../src/bank-retention.mjs');
    const app = initializeApp({ projectId: config.projectId, credential: applicationDefault() });
    const result = await adoptLegacyBankMetadata({ config, store: createBankMetadataStore({ db: getFirestore(app), Timestamp, FieldPath }), apply: arguments_.includes('--apply') });
    console.log(JSON.stringify(result));
  } catch (error) {
    // Do not echo config, SDK errors, credentials or private metadata.
    const code = error.code || error.message;
    console.error(/^[a-z-]+$/.test(code || '') ? code : 'bank-adoption-not-completed');
    process.exitCode = 1;
  }
}
