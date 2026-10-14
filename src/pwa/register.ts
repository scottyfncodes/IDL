/**
 * Registers the service worker in production builds and surfaces updates.
 * A new version installs in the background and waits; the player chooses
 * when to reload so an active game is never yanked away mid-move.
 */
export type UpdateHandler = (apply: () => void) => void;

export function registerServiceWorker(onUpdate: UpdateHandler) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const run = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      // Only reload when the player accepted an update. The very first
      // install also fires controllerchange (clients.claim), and reloading
      // then would wipe whatever they had just started.
      let updateAccepted = false;
      const offer = (worker: ServiceWorker) =>
        onUpdate(() => {
          updateAccepted = true;
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !updateAccepted) return;
        reloading = true;
        window.location.reload();
      });
      // Check for updates when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch {
      /* SW unsupported or blocked — app still works online. */
    }
  };
  if (document.readyState === 'complete') void run();
  else window.addEventListener('load', () => void run(), { once: true });
}
