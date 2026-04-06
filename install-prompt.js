/* PWA Install Prompt — auto-trigger native browser install dialog */
(function () {
  let deferredPrompt = null;
  let prompted = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (prompted) return;
    deferredPrompt = e;
    prompted = true;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
    });
  });
})();
