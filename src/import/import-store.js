import { FinizeImportRuntime } from "./runtime.js";

export const ImportStore = FinizeImportRuntime.ImportStore;
export const persistImportDraft = (...args) => FinizeImportRuntime.persistImportDraft(...args);
export const recoverJournal = (...args) => FinizeImportRuntime.recoverJournal(...args);
