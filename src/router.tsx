import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new publish, tabs/PWA still running the previous build request
// chunk hashes that no longer exist. Reload once to fetch the fresh build.
const STALE_KEY = "segnatavolo:stale-chunk-reload";
function reloadOnceForStaleChunk() {
  try {
    const last = Number(sessionStorage.getItem(STALE_KEY) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(STALE_KEY, String(Date.now()));
  } catch { /* ignore */ }
  window.location.reload();
}
const isStaleChunkError = (msg: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(msg ?? ""));
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnceForStaleChunk(); });
  window.addEventListener("unhandledrejection", (e) => {
    if (isStaleChunkError((e.reason as Error)?.message ?? e.reason)) reloadOnceForStaleChunk();
  });
  window.addEventListener("error", (e) => { if (isStaleChunkError(e.message)) reloadOnceForStaleChunk(); });
}

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
