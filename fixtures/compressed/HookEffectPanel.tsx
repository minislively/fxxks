import React, { useCallback, useEffect, useMemo, useState } from "react";

type HookEffectPanelProps = {
  userId: string;
  name: string;
  loadUser: (userId: string) => Promise<void>;
};

export function HookEffectPanel({ userId, name, loadUser }: HookEffectPanelProps) {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;

    async function hydrateUser() {
      setStatus("loading");
      await loadUser(userId);
      if (!cancelled) {
        setStatus("ready");
      }
    }

    hydrateUser();

    return () => {
      cancelled = true;
    };
  }, [loadUser, userId]);

  const greeting = useMemo(() => {
    return `Hello ${name}`;
  }, [name]);

  const handleRefresh = useCallback(async () => {
    setStatus("refreshing");
    await loadUser(userId);
    setStatus("ready");
  }, [loadUser, userId]);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{greeting}</h2>
        <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={handleRefresh}>
          Refresh
        </button>
      </header>
      <p className="text-xs text-slate-500">{status}</p>
    </section>
  );
}
