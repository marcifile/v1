import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WorldPayload } from "@/types/world";

type WorldContextValue = {
  world: WorldPayload | null;
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const WorldContext = createContext<WorldContextValue | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<WorldPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/world", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not read the pond.");
      }
      setWorld(data as WorldPayload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the pond.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => void refresh(), 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ world, error, loading, refresh }),
    [world, error, loading, refresh]
  );

  return createElement(WorldContext.Provider, { value }, children);
}

export function useWorld(_refreshMs = 10_000) {
  const context = useContext(WorldContext);
  if (!context) {
    throw new Error("useWorld must be used inside WorldProvider.");
  }
  return context;
}
