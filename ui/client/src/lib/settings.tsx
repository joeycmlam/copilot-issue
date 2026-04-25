import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { registerSettingsAccessor } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

// =============================================================================
// SettingsProvider
//
// All UI configuration lives here in React state — never localStorage / cookies
// (blocked in the sandbox iframe). On mount, we register an accessor with
// queryClient so every fetch can read the *current* settings without prop
// drilling.
//
// Defaults intentionally point at the BFF proxy ("" => same-origin /api/proxy),
// which in turn falls back to env COPILOT_API_URL or http://localhost:8000.
// =============================================================================

const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: "",
  pat: "",
  defaultOwner: "",
  defaultRepo: "",
  defaultBaseBranch: "main",
  defaultEnterprise: "",
};

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Keep a live ref for the queryClient accessor — avoids restale closures.
  const ref = useRef(settings);
  ref.current = settings;

  // Register exactly once. Accessor reads from the ref, so it stays current.
  useEffect(() => {
    registerSettingsAccessor(() => ({
      apiBaseUrl: ref.current.apiBaseUrl,
      pat: ref.current.pat,
    }));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings must be used inside SettingsProvider");
  return v;
}
