import { useCallback, useEffect, useState } from "react";
import type { WorldPayload } from "@/types/world";

export function useWorld(refreshMs = 12000) {
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
    if (refreshMs <= 0) return;
    const timer = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(timer);
  }, [refresh, refreshMs]);

  return { world, error, loading, refresh };
}
