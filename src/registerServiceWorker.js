const onRegistrationSuccess = (registration) => {
  const swRegistration = { ...registration };

  swRegistration.onupdatefound = () => {
    const installingWorker = registration.installing;

    if (!installingWorker) {
      return;
    }

    installingWorker.onstatechange = () => {
      if (installingWorker.state === "installed") {
        console.info(
          navigator.serviceWorker.controller
            ? "New content is available; please refresh."
            : "Content is cached for offline use."
        );
      }
    };
  };
};

const onRegistrationFail = (error) =>
  console.error("Error during service worker registration:", error);

const registerServiceWorker = () => {
  const swUrl = "./sw.js";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(swUrl)
      .then(onRegistrationSuccess)
      .catch(onRegistrationFail);
  }
};

const unregisterServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) =>
      registration.unregister()
    );
  }
};

export { registerServiceWorker, unregisterServiceWorker };
