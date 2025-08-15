// Migration v6: introduce dynamic program + program field injection
// - Adds default program to profile (local) if missing
// - No structural IndexedDB changes needed besides allowing weekNumber >9 (code-level)

import { db } from "../db";
import { defaultProgram } from "../defaults";
import { ensureProgram } from "../program";
import { Session, Measurement } from "../types";

export async function migrateToV6() {
  try {
    // profiles stored remote; ensure local cache (settings) has no action required
    // inject default program via synthetic profile row if profile table cached locally (if any abstraction used)
    // For simplicity: ensure a sentinel session beyond week 9 not required; existing sessions remain valid.
    const settings = await db.get("settings", "app");
    // nothing to mutate here; program persistence lives in user profile (supabase); local migration minimal
    // We choose to seed templates (already done elsewhere) and leave program creation to server fetch.
    // Backfill programId + createdAt/updatedAt timestamps for sessions
    const sessions = await db.getAll<Session>('sessions');
    const now = new Date().toISOString();
    for(const s of sessions){
      let changed=false;
      if(!(s as any).programId){ (s as any).programId = settings?.program?.id; changed=true; }
      if(!(s as any).createdAt){ (s as any).createdAt = s.dateISO || now; changed=true; }
      (s as any).updatedAt = now; // always refresh
      if(changed) await db.put('sessions', s);
    }
    // Backfill timestamps for measurements
    const measurements = await db.getAll<Measurement>('measurements');
    for(const m of measurements){
      let changed=false; if(!(m as any).createdAt){ (m as any).createdAt = m.dateISO; changed=true; }
      if(!(m as any).updatedAt){ (m as any).updatedAt = now; changed=true; }
      if(changed) await db.put('measurements', m);
    }
    console.log("[migrateToV6] Completed (backfill programId & timestamps)");
  } catch (e) {
    console.warn("[migrateToV6] error", e);
  }
}
