/**
 * Workspace context: the selected service and the workspace record.
 *
 * Almost every screen is scoped to one service, and the selection has to
 * survive navigation and reloads, so it lives here rather than in each route.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, DEFAULT_NOTIFICATIONS } from "./api";
import type { Service, WorkspaceSettings } from "./api";
import { useAsync } from "./hooks";
import type { AsyncState } from "./hooks";

const SERVICE_STORAGE_KEY = "orange-signal.service";
const APPEARANCE_STORAGE_KEY = "orange-signal.appearance";

export type Appearance = "light" | "dark";

interface WorkspaceValue {
  services: AsyncState<Service[]>;
  service: Service | null;
  serviceKey: string;
  setServiceKey: (key: string) => void;
  settings: WorkspaceSettings;
  settingsState: AsyncState<WorkspaceSettings>;
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
}

const FALLBACK_SETTINGS: WorkspaceSettings = {
  name: "Orange Signal",
  slug: "orange-signal",
  timezone: "UTC",
  notifications: DEFAULT_NOTIFICATIONS,
  updated_at: "",
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode — not worth telling the user about
  }
};

const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const services = useAsync(() => api.services(), []);
  const settingsState = useAsync(() => api.settings(), []);
  const [serviceKey, setServiceKeyState] = useState("");
  const [appearance, setAppearanceState] = useState<Appearance>(
    () => (readStored(APPEARANCE_STORAGE_KEY) === "dark" ? "dark" : "light"),
  );

  // Pick up the last-used service once the list arrives, else the first one.
  useEffect(() => {
    const list = services.data;
    if (!list?.length) return;
    setServiceKeyState((current) => {
      if (current && list.some((s) => s.key === current)) return current;
      const stored = readStored(SERVICE_STORAGE_KEY);
      return list.find((s) => s.key === stored)?.key ?? list[0].key;
    });
  }, [services.data]);

  const setServiceKey = useCallback((key: string) => {
    setServiceKeyState(key);
    writeStored(SERVICE_STORAGE_KEY, key);
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    writeStored(APPEARANCE_STORAGE_KEY, next);
  }, []);

  // The token file keys off [data-appearance] rather than a media query, so
  // the attribute has to be on a real element for either palette to apply.
  useEffect(() => {
    document.documentElement.setAttribute("data-appearance", appearance);
    document.documentElement.style.colorScheme = appearance;
  }, [appearance]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      services,
      service: services.data?.find((s) => s.key === serviceKey) ?? null,
      serviceKey,
      setServiceKey,
      settings: settingsState.data ?? FALLBACK_SETTINGS,
      settingsState,
      appearance,
      setAppearance,
    }),
    [services, serviceKey, setServiceKey, settingsState, appearance, setAppearance],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
