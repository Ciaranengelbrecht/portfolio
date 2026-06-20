import { supabase, waitForSession } from "./supabase";
import { UserProfile, UserProgram, ArchivedProgram, Session } from "./types";
import { db } from "./db";
import { ensureProgram } from './program';
import { readProgramSnapshot, writeProgramSnapshot } from "./deviceSnapshot";

const PROFILE_TTL_MS = 5 * 60 * 1000;
const PROGRAM_TTL_MS = 5 * 60 * 1000;
let _profileCache:
  | { ownerId: string; value: UserProfile; ts: number }
  | null = null;
let _profileInflight: Promise<UserProfile | null> | null = null;
let _programCache: { ownerId: string; value: UserProgram; ts: number } | null = null;

function normalizeProfile(data: any): UserProfile {
  const norm: any = { ...data };
  if (norm.themeV2 === undefined && norm.themev2 !== undefined) {
    norm.themeV2 = norm.themev2;
  }
  return norm as UserProfile;
}

function cacheProfile(ownerId: string, profile: UserProfile | null) {
  if (!profile) return profile;
  const normalized = normalizeProfile({ ...profile, id: profile.id || ownerId });
  _profileCache = { ownerId, value: normalized, ts: Date.now() };
  if (normalized.program) {
    const prog = ensureProgram(normalized.program);
    _programCache = { ownerId, value: prog, ts: Date.now() };
    void writeProgramSnapshot(ownerId, prog);
  }
  return normalized;
}

export function primeUserProfile(profile: UserProfile | null | undefined) {
  if (!profile?.id) return;
  cacheProfile(profile.id, profile);
}

function clearProfileCaches() {
  _profileCache = null;
  _profileInflight = null;
  _programCache = null;
}

export async function fetchUserProfileStrict(opts?: {
  forceRemote?: boolean;
}): Promise<UserProfile | null> {
  const session = await waitForSession({ timeoutMs: 3000 });
  const user = session?.user;
  if (!user?.id) return null;
  const now = Date.now();
  const cachedProfile = _profileCache;
  if (
    !opts?.forceRemote &&
    cachedProfile &&
    cachedProfile.ownerId === user.id &&
    now - cachedProfile.ts < PROFILE_TTL_MS
  ) {
    return cachedProfile.value;
  }
  if (!opts?.forceRemote && _profileInflight) return _profileInflight;

  _profileInflight = (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,themev2,program,program_history")
      .eq("id", user.id)
      .single();

    if (error && (error as any).code !== "PGRST116") throw error;
    const profile = data ? normalizeProfile(data) : ({ id: user.id } as UserProfile);
    return cacheProfile(user.id, profile);
  })().finally(() => {
    _profileInflight = null;
  });

  return _profileInflight;
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    return await fetchUserProfileStrict();
  } catch (e) {
    console.warn("[profile] fetchUserProfile failed", e);
    return null;
  }
}

export async function saveProfileTheme(
  themeV2: UserProfile["themeV2"]
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    // Use lowercase column name to match unquoted creation (themev2)
    const payload: any = { id: user.id, themev2: themeV2 };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) throw error;
    cacheProfile(user.id, {
      ...(_profileCache?.ownerId === user.id ? _profileCache.value : { id: user.id }),
      themeV2,
    } as UserProfile);
    return true;
  } catch (e) {
    // Graceful fallback if column not yet in PostgREST schema cache
    const code = (e as any)?.code;
    if (code === "PGRST204") {
      console.warn(
        "[profile] themeV2 column missing in schema cache; falling back to creating profile row without themeV2"
      );
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // Attempt to upsert only the id so the row exists; theme still lives in settings locally
          await supabase
            .from("profiles")
            .upsert({ id: user.id }, { onConflict: "id" });
        }
      } catch (e2) {
        console.warn("[profile] fallback profile upsert failed", e2);
      }
      return false;
    }
    console.warn("[profile] saveProfileTheme failed", e);
    return false;
  }
}

export async function saveProfileProgram(
  program: UserProgram
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const payload: any = { id: user.id, program };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) throw error;
    const ensured = ensureProgram(program);
    _programCache = { ownerId: user.id, value: ensured, ts: Date.now() };
    cacheProfile(user.id, {
      ...(_profileCache?.ownerId === user.id ? _profileCache.value : { id: user.id }),
      program: ensured,
    } as UserProfile);
    void writeProgramSnapshot(user.id, ensured);
    return true;
  } catch (e) {
    console.warn("[profile] saveProfileProgram failed", e);
    return false;
  }
}

export async function getProfileProgram(opts?: {
  preferCached?: boolean;
  forceRemote?: boolean;
  fallbackProgram?: UserProgram | null;
}): Promise<UserProgram> {
  const now = Date.now();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) throw new Error('Not signed in');
    if (!opts?.forceRemote && _programCache?.ownerId === user.id && now - _programCache.ts < PROGRAM_TTL_MS) {
      return _programCache.value;
    }
    if (!opts?.forceRemote) {
      const local = await readProgramSnapshot(user.id);
      if(local?.program) {
        const prog = ensureProgram(local.program);
        _programCache = { ownerId: user.id, value: prog, ts: now };
        if (opts?.preferCached) {
          return prog;
        }
      }
    }
    const profile = await fetchUserProfileStrict({
      forceRemote: opts?.forceRemote,
    });
    const progRaw = profile?.program as UserProgram | undefined;
    const prog = ensureProgram(progRaw);
    _programCache = { ownerId: user.id, value: prog, ts: now };
    void writeProgramSnapshot(user.id, prog);
    return prog;
  } catch(e){
    // Fallback to default ensure
    const fallback = ensureProgram(opts?.fallbackProgram || null);
    _programCache = { ownerId: "fallback", value: fallback, ts: now };
    return fallback;
  }
}

export async function archiveCurrentProgram(
  newProgram: UserProgram,
  opts?: { phaseSpan?: { from: number; to: number } }
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("profiles")
      .select("program, program_history")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    const history: ArchivedProgram[] = data?.program_history || [];
    if (data?.program) {
      const existing = data.program as UserProgram;
      // compute lightweight stats snapshot for existing program
      let stats: ArchivedProgram['stats'] | undefined = undefined;
      try {
        const sessions = await db.getAll<Session>('sessions');
        const relevant = sessions.filter(s=> s.programId === existing.id);
        if(relevant.length){
          let totalSets=0; let totalVolume=0;
            relevant.forEach(s=> s.entries.forEach(e=> e.sets.forEach(st=> { totalSets++; totalVolume += (st.weightKg||0)*(st.reps||0); })));
          stats = { sessions: relevant.length, totalSets, totalVolume: Math.round(totalVolume) };
        }
      } catch(e){ console.warn('[archive] snapshot stats failed', e); }
      const archived: ArchivedProgram = {
        id: existing.id || `prog_${Math.random().toString(36).slice(2, 9)}`,
        name: existing.name,
        summary: `${existing.name} · ${existing.mesoWeeks}w`,
        archivedAt: new Date().toISOString(),
        program: existing,
        phaseSpan: opts?.phaseSpan,
        stats,
      };
      history.unshift(archived);
      // cap history
      if (history.length > 10) history.pop();
    }
    const payload: any = {
      id: user.id,
      program: newProgram,
      program_history: history,
    };
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (upErr) throw upErr;
    cacheProfile(user.id, {
      id: user.id,
      program: newProgram,
      program_history: history,
      themeV2:
        _profileCache?.ownerId === user.id
          ? _profileCache.value.themeV2
          : undefined,
    } as UserProfile);
    return true;
  } catch (e) {
    console.warn("[profile] archiveCurrentProgram failed", e);
    return false;
  }
}

export async function restoreArchivedProgram(
  programId: string
): Promise<UserProgram | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("profiles")
      .select("program, program_history")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    const history: ArchivedProgram[] = data?.program_history || [];
    const idx = history.findIndex((h) => h.id === programId);
    if (idx === -1) return null;
    const target = history[idx];
    // Move current program (if any) into history (top) before restoring
    const newHistory = [...history];
    const current = data?.program as UserProgram | undefined;
    if (current) {
      newHistory.unshift({
        id: current.id || `prog_${Math.random().toString(36).slice(2, 9)}`,
        name: current.name,
        summary: `${current.name} · ${current.mesoWeeks}w`,
        archivedAt: new Date().toISOString(),
        program: current,
      });
    }
    // Remove restored one from its old position AFTER capturing
    const adjusted = newHistory.filter(
      (h, i) => !(i !== 0 && h.id === target.id)
    );
    // Cap to 15
    while (adjusted.length > 15) adjusted.pop();
    const payload: any = {
      id: user.id,
      program: target.program,
      program_history: adjusted,
    };
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (upErr) throw upErr;
    cacheProfile(user.id, {
      id: user.id,
      program: target.program,
      program_history: adjusted,
      themeV2:
        _profileCache?.ownerId === user.id
          ? _profileCache.value.themeV2
          : undefined,
    } as UserProfile);
    return target.program;
  } catch (e) {
    console.warn("[profile] restoreArchivedProgram failed", e);
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("sb-auth", clearProfileCaches);
}
