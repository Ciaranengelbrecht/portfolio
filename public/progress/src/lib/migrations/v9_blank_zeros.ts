import { db } from "../db";
import type { Session, SetEntry } from "../types";

// Convert historical placeholder 0/0 sets to null/null to enable ghost suggestions and avoid prefilled zeros.
// Safety: only transforms sets where BOTH weightKg and reps are exactly 0. Leaves real data intact.
export async function migrateToV9_BlankZeros() {
  try {
    const sessions = await db.getAll<Session>("sessions");
    const updates: Session[] = [];
    for (const s of sessions) {
      if (!s?.entries?.length) continue;
      let changed = false;
      const newEntries = s.entries.map((e) => {
        if (!e?.sets?.length) return e;
        let entryChanged = false;
        const newSets: SetEntry[] = e.sets.map((st) => {
          if ((st.weightKg ?? 0) === 0 && (st.reps ?? 0) === 0) {
            // Only blank when both are zero; preserve cases like bodyweight (0kg) with reps > 0
            if (st.weightKg !== null || st.reps !== null) {
              entryChanged = true;
              return { ...st, weightKg: null, reps: null };
            }
          }
          return st;
        });
        if (entryChanged) { changed = true; return { ...e, sets: newSets }; }
        return e;
      });
      if (changed) {
        updates.push({ ...s, entries: newEntries, updatedAt: new Date().toISOString() } as Session);
      }
    }
    for (const u of updates) {
      await db.put("sessions", u);
    }
  } catch (e) {
    console.warn("[migrateToV9_BlankZeros] error", e);
  }
}
