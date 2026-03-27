const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { extractDictionaryVersionId } = require("./helpers");
const { getDictionaryVersionDetailsRowsForPermission } = require("./version-details");

async function getDictionaryVersionsForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  const rawRows = await getDictionaryVersionDetailsRowsForPermission(permission, context.userKey);

  const seenVersionRows = new Set();
  const versions = [];

  rawRows.forEach((row, index) => {
    const id = extractDictionaryVersionId(row, index);
    const label = row.DICTIONARY_VERSION_NAME || row.DICTIONARY_VERSION_KEY || id;
    const dedupeKey = `${id}::${String(label)}`;

    if (seenVersionRows.has(dedupeKey)) {
      return;
    }

    seenVersionRows.add(dedupeKey);
    const versionKey = Number(id);
    const isCheckedOut = Number.isFinite(versionKey) && versionKey < 0;
    const location = row.DICTIONARY_LOCATION != null ? String(row.DICTIONARY_LOCATION).trim() : '';
    versions.push({
      id,
      label,
      location,
      isCheckedOut
    });
  });

  return {
    versions,
    canUpdate: permission.canUpdate
  };
}

module.exports = {
  getDictionaryVersionsForUser
};
