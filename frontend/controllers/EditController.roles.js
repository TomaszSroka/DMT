export function currentUserHasRole(roleName, userContext = window.__DMT_USER_CONTEXT || {}) {
  const expectedRole = String(roleName || '').trim().toUpperCase();
  const flatRoles = Array.isArray(userContext.roles) ? userContext.roles : [];
  return flatRoles.some((role) => String(role || '').trim().toUpperCase() === expectedRole);
}

export function canUpdateDictionaryByUserContext(dictionaryId, userContext = window.__DMT_USER_CONTEXT || {}) {
  const expectedDictionaryId = String(dictionaryId || '').trim().toUpperCase();
  const dictionaryRoles = Array.isArray(userContext.dictionaryRoles) ? userContext.dictionaryRoles : [];
  return dictionaryRoles.some((item) => {
    const roleDictionaryId = item && item.dictionary ? String(item.dictionary).trim().toUpperCase() : '';
    const role = item && item.role ? String(item.role).trim().toUpperCase() : '';
    return roleDictionaryId === expectedDictionaryId && role === 'DICTIONARY_UPDATER';
  });
}