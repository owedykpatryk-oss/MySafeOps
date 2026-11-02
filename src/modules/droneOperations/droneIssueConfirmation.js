export async function verifyIssuedSnapshot(issue, read) {
  const result = await read();
  if (!result?.ok || !Array.isArray(result.value))
    throw new Error(
      "Cloud confirmation is unavailable. The local review is pending; an issued PDF cannot be downloaded yet."
    );
  const stored = result.value.find((m) => m.id === issue.snapshot?.id)?.issues?.find((i) => i.id === issue.id);
  if (!stored || JSON.stringify(stored) !== JSON.stringify(issue))
    throw new Error(
      "This exact review has not been confirmed by the server. Wait for sync and retry. If the write was rejected, resolve the sync error or copy the mission to prepare a new review."
    );
  return true;
}
