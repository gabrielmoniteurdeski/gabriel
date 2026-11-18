(() => {
  const consentKey = "site-gab-consent-v2";
  const consentLifetime = 183 * 24 * 60 * 60 * 1000;
  const banner = document.querySelector("#consent-banner");
  const acceptButton = document.querySelector("#consent-accept");
  const rejectButton = document.querySelector("#consent-reject");
  const settingsLinks = document.querySelectorAll(".consent-settings-link");

  if (!banner || !acceptButton || !rejectButton) {
    return;
  }

  const loadGoogleFonts = () => {
    if (document.querySelector("#google-fonts-stylesheet")) {
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.id = "google-fonts-stylesheet";
    stylesheet.rel = "stylesheet";
    stylesheet.href =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap";
    document.head.append(stylesheet);
  };

  const unloadGoogleFonts = () => {
    document.querySelector("#google-fonts-stylesheet")?.remove();
  };

  const setOptionalContentConsent = (accepted) => {
    document.dispatchEvent(
      new CustomEvent("site:optional-content-consent", {
        detail: { accepted },
      }),
    );
  };

  const saveConsent = (choice) => {
    const preference = {
      choice,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(consentKey, JSON.stringify(preference));
    } catch (error) {
      console.warn("Le choix de confidentialité ne peut pas être mémorisé dans ce navigateur.", error);
    }

    if (choice === "accepted") {
      loadGoogleFonts();
      setOptionalContentConsent(true);
    } else {
      unloadGoogleFonts();
      setOptionalContentConsent(false);
    }

    banner.hidden = true;
  };

  let preference = null;
  try {
    preference = JSON.parse(localStorage.getItem(consentKey));
  } catch (error) {
    console.warn("Le choix de confidentialité ne peut pas être lu dans ce navigateur.", error);
  }

  if (
    preference &&
    (preference.choice === "accepted" || preference.choice === "rejected") &&
    Number.isFinite(preference.savedAt) &&
    Date.now() - preference.savedAt < consentLifetime
  ) {
    if (preference.choice === "accepted") {
      loadGoogleFonts();
      setOptionalContentConsent(true);
    } else {
      unloadGoogleFonts();
      setOptionalContentConsent(false);
    }
    banner.hidden = true;
  } else {
    banner.hidden = false;
  }

  acceptButton.addEventListener("click", () => saveConsent("accepted"));
  rejectButton.addEventListener("click", () => saveConsent("rejected"));

  settingsLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      banner.hidden = false;
      acceptButton.focus();
    });
  });
})();
