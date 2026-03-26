import { postJson } from './ApiClient.js';

export async function ensureDictionaryCheckOut(dictionaryId, dictionaryVersionKey) {
  const payload = await postJson(`/api/dictionaries/${encodeURIComponent(dictionaryId)}/check-out`, {
    dictionaryVersionKey
  });

  return {
    checkOutDictionaryLocation: String(payload && payload.checkOutDictionaryLocation ? payload.checkOutDictionaryLocation : '').trim(),
    created: Boolean(payload && payload.created)
  };
}