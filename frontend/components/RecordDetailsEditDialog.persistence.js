export async function persistRecordRow({
  postJson,
  dictionaryName,
  dictionaryVersionKey,
  checkoutDictionaryLocation,
  isNewRecord,
  originalRow,
  currentRow
}) {
  const dictionaryPath = `/api/dictionaries/${encodeURIComponent(dictionaryName)}`;

  if (isNewRecord) {
    await postJson(`${dictionaryPath}/rows/insert`, {
      dictionaryVersionKey,
      checkoutDictionaryLocation,
      newRow: currentRow
    });
    return;
  }

  await postJson(`${dictionaryPath}/rows/save`, {
    dictionaryVersionKey,
    checkoutDictionaryLocation,
    originalRow,
    updatedRow: currentRow
  });
}
