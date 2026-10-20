export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  const host = location.hostname;
  const refuse = !import.meta.env.PROD || window.self !== window.top || /^(id-preview--|preview--)/.test(host) || ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => host === domain || host.endsWith(`.${domain}`)) || new URLSearchParams(location.search).get("sw") === "off";
  if (refuse) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      if ([registration.active, registration.waiting, registration.installing].some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")) await registration.unregister();
    }
    return;
  }
  await navigator.serviceWorker.register("/sw.js");
}