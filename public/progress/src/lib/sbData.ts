import { supabase, getOwnerIdFast } from "./supabase";
import { trackError } from "./monitoring";

function isDevEnv() {
  try {
    const nodeEnv =
      (typeof process !== "undefined" && (process as any)?.env?.NODE_ENV) ||
      undefined;
    if (nodeEnv) return nodeEnv !== "production";
    const viteMode =
      typeof import.meta !== "undefined" && (import.meta as any)?.env?.MODE;
    if (viteMode) return viteMode !== "production";
  } catch (e) {
    /* ignore */
  }
  return false;
}

export type Table =
  | "exercises"
  | "sessions"
  | "measurements"
  | "templates"
  | "settings";

export type SbAppSnapshotRow = {
  id: string;
  data: any;
  updated_at: string | null;
};

export type SbAppSnapshotStore = {
  rows: SbAppSnapshotRow[];
  ids: string[];
  latestUpdatedAt: string | null;
};

export type SbAppSnapshot = {
  profile: {
    id: string;
    themev2?: any;
    program?: any;
    program_history?: any[];
  } | null;
  stores: Record<Table, SbAppSnapshotStore>;
};

function storageKey(owner: string, id: string) {
  return `${owner}:${id}`;
}

export async function sbUpsert(
  table: Table,
  owner: string,
  id: string,
  data: any
) {
  const sk = storageKey(owner, id);
  const { error } = await supabase
    .from(table)
    .upsert({ id: sk, owner, data }, { onConflict: "id" });
  if (error) throw error;
  if (table === "settings") return;
  // Cleanup legacy plain-id row to prevent duplicates. Some self-hosted setups
  // may still have rows without an owner column or with stricter RLS rules;
  // treat those as best-effort so we don't surface noisy 400 errors in the console.
  const { error: cleanupError } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("owner", owner);
  if (cleanupError && isDevEnv()) {
    console.warn("[sbData] legacy cleanup skipped", {
      table,
      id,
      owner,
      error: cleanupError,
    });
  }
}

export async function sbDelete(table: Table, owner: string, id: string) {
  const sk = storageKey(owner, id);
  // Delete both new and legacy keys
  const delNew = await supabase
    .from(table)
    .delete()
    .eq("id", sk)
    .eq("owner", owner);
  const delOld = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("owner", owner);
  if (delNew.error) throw delNew.error;
  if (delOld.error && isDevEnv()) {
    console.warn("[sbData] legacy delete skipped", {
      table,
      id,
      owner,
      error: delOld.error,
    });
  }
}

export async function sbGet(table: Table, id: string) {
  const owner = await getOwnerIdFast({ timeoutMs: 1500 });
  const sk = storageKey(owner, id);
  const attempt = async () => {
    // Try new namespaced key first
    let { data, error } = await supabase
      .from(table)
      .select("id,data")
      .eq("id", sk)
      .eq("owner", owner)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Fallback: legacy plain id, migrate if found
    const legacy = await supabase
      .from(table)
      .select("id,data")
      .eq("id", id)
      .eq("owner", owner)
      .maybeSingle();
    if (legacy.error) throw legacy.error;
    if (!legacy.data) return null;
    // Migrate: write to namespaced id and remove old row
    const up = await supabase
      .from(table)
      .upsert({ id: sk, owner, data: legacy.data.data }, { onConflict: "id" });
    if (up.error) throw up.error;
    await supabase.from(table).delete().eq("id", id).eq("owner", owner);
    return { ...legacy.data, id: sk };
  };
  try {
    return await attempt();
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = (e && (e.status || e.code)) || "";
    console.log("[sbData] sbGet error, retrying once:", table, id, {
      status,
      msg,
    });
    trackError(e, { source: "sbGet", table, status });
    await new Promise((r) => setTimeout(r, 300));
    return await attempt();
  }
}

export async function sbList(table: Table) {
  const owner = await getOwnerIdFast({ timeoutMs: 1500 });
  const attempt = async () => {
    const { data, error } = await supabase
      .from(table)
      .select("id,data")
      .eq("owner", owner as any);
    if (error) throw error;
    return data!;
  };
  try {
    const rows = await attempt();
    return rows;
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = (e && (e.status || e.code)) || "";
    console.log("[sbData] sbList error, retrying once:", table, {
      status,
      msg,
    });
    trackError(e, { source: "sbList", table, status });
    await new Promise((r) => setTimeout(r, 300));
    return await attempt();
  }
}

export type SbIncrementalRow = {
  id: string;
  data: any;
  updated_at: string | null;
};

export async function sbListUpdatedSince(
  table: Table,
  updatedAfterISO: string
): Promise<SbIncrementalRow[]> {
  const owner = await getOwnerIdFast({ timeoutMs: 1500 });
  const attempt = async () => {
    const { data, error } = await supabase
      .from(table)
      .select("id,data,updated_at")
      .eq("owner", owner as any)
      .gt("updated_at", updatedAfterISO)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    return (data || []) as SbIncrementalRow[];
  };
  try {
    return await attempt();
  } catch (e: any) {
    const status = (e && (e.status || e.code)) || "";
    trackError(e, { source: "sbListUpdatedSince", table, status });
    await new Promise((r) => setTimeout(r, 300));
    return await attempt();
  }
}

function normalizeSnapshotStore(value: any): SbAppSnapshotStore {
  return {
    rows: Array.isArray(value?.rows) ? value.rows : [],
    ids: Array.isArray(value?.ids) ? value.ids.filter(Boolean).map(String) : [],
    latestUpdatedAt: value?.latestUpdatedAt || value?.latestupdatedat || null,
  };
}

export async function sbAppSnapshot(
  since?: Partial<Record<Table, string | null>>
): Promise<SbAppSnapshot> {
  const { data, error } = await supabase.rpc("get_liftlog_app_snapshot", {
    since: since || {},
  });
  if (error) throw error;
  const stores = (data as any)?.stores || {};
  return {
    profile: (data as any)?.profile || null,
    stores: {
      settings: normalizeSnapshotStore(stores.settings),
      exercises: normalizeSnapshotStore(stores.exercises),
      templates: normalizeSnapshotStore(stores.templates),
      sessions: normalizeSnapshotStore(stores.sessions),
      measurements: normalizeSnapshotStore(stores.measurements),
    },
  };
}
