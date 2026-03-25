const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { extractDictionaryVersionId } = require("./helpers");
const { getDictionaryVersionDetailsRowsForPermission } = require("./version-details");

async function getDictionaryVersionsForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  const rawRows = await getDictionaryVersionDetailsRowsForPermission(permission);

  const seenVersionIds = new Set();
  const versions = [];

  rawRows.forEach((row, index) => {
    const id = extractDictionaryVersionId(row, index);
    if (seenVersionIds.has(id)) {
      return;
    }

    seenVersionIds.add(id);
    versions.push({
      id,
      label: row.DICTIONARY_VERSION_NAME || row.DICTIONARY_VERSION_KEY || id
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
