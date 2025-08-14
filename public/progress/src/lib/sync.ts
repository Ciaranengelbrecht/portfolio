// Deprecated Gist sync: shim exports to avoid runtime errors if something still imports them
export async function pullFromGist(_: any) {
  return false;
}
export async function pushToGist(_: any) {
  return false;
}
export async function syncDebounced() {
  /* no-op */
}
export function startBackgroundPull(_: number) {
  /* no-op */
}
