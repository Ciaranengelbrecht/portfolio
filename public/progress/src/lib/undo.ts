type Action = { undo: () => Promise<void> | void }
let last: Action | null = null
export function setLastAction(a: Action){ last = a }
export async function undo(){ if (last){ await last.undo(); last = null }}
