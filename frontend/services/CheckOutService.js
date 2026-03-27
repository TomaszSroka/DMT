import { postJson } from './ApiClient.js';

export async function ensureDictionaryCheckOut(dictionaryId, dictionaryVersionKey, mode = 'ADD') {
  const payload = await postJson(`/api/dictionaries/${encodeURIComponent(dictionaryId)}/check-out`, {
    dictionaryVersionKey,
    mode
  });

  return {
    mode: String(payload && payload.mode ? payload.mode : '').trim().toUpperCase(),
    procedureResult: String(payload && payload.procedureResult ? payload.procedureResult : '').trim().toUpperCase(),
    versionName: String(payload && payload.versionName ? payload.versionName : '').trim(),
    userLogin: String(payload && payload.userLogin ? payload.userLogin : '').trim(),
    checkOutDictionaryLocation: String(payload && payload.checkOutDictionaryLocation ? payload.checkOutDictionaryLocation : '').trim(),
    created: Boolean(payload && payload.created)
  };
}