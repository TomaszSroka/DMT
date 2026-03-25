const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { getDictionaryVersionDetailsRowsForPermission } = require("./version-details");

async function getDictionaryVersionHistoryForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  const rows = await getDictionaryVersionDetailsRowsForPermission(permission);

  return {
    rows,
    canUpdate: permission.canUpdate
  };
}

module.exports = {
  getDictionaryVersionHistoryForUser
};
