const LOCAL_PREFIXES = [
  "liftlog:",
  "progress:",
  "pp_cache_",
  "exerciseSeed",
  "theme",
  "bodyFatPrefs",
];

const LOCAL_KEYS = [
  "pp_cache_schema_version",
  "pp_cache_owner",
  "sb_pw_reset",
  "pw_reset_alert",
  "themePresetsCollapsed",
  "measurementSectionCollapsed",
  "measurementCollapse",
  "templateCollapse",
];

function removeMatching(storage: Storage) {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i) || "";
    if (LOCAL_KEYS.includes(key) || LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

export function clearLiftLogLocalData() {
  if (typeof window === "undefined") return;
  try {
    removeMatching(window.localStorage);
  } catch {}
  try {
    removeMatching(window.sessionStorage);
  } catch {}
}
