import type { IDBPDatabase, IDBPTransaction } from "idb";

export async function migrateV4(
  db: IDBPDatabase<any>,
  tx: IDBPTransaction<any, string[]>
) {
  try {
    if (db.objectStoreNames.contains("settings")) {
      const sStore = tx.objectStore("settings");
      const s = await sStore.get("app");
      if (s) {
        s.progress = s.progress || {
          weeklyTargetDays: 6,
          gamification: true,
          showDeloadHints: true,
        };
        if (typeof s.progress.weeklyTargetDays !== "number")
          s.progress.weeklyTargetDays = 6;
        if (typeof s.progress.gamification !== "boolean")
          s.progress.gamification = true;
        if (typeof s.progress.showDeloadHints !== "boolean")
          s.progress.showDeloadHints = true;
        await (sStore as any).put(s, "app");
      }
    }
  } catch {
    // best-effort
  }
}
