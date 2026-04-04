(function () {
  const body = document.body;
  const primaryAction = document.getElementById("primaryAction");
  const secondaryAction = document.getElementById("secondaryAction");
  const closedHitbox = document.getElementById("closedHitbox");
  const openedHitbox = document.getElementById("openedHitbox");
  const closedScene = document.querySelector(".scene-closed");
  const openedScene = document.querySelector(".scene-opened");
  const inviteStage = document.getElementById("inviteStage");
  const detailsSection = document.getElementById("detailsSection");
  const invitationCard = document.getElementById("invitationCard");

  if (
    !primaryAction ||
    !secondaryAction ||
    !closedHitbox ||
    !openedHitbox ||
    !closedScene ||
    !openedScene ||
    !inviteStage ||
    !detailsSection ||
    !invitationCard
  ) {
    return;
  }

  const labels = {
    0: "Open invitation",
    1: "Opening invitation...",
    2: "Start again",
  };

  let step = Number(body.getAttribute("data-step"));
  if (!Number.isInteger(step) || step < 0 || step > 2) {
    step = 0;
  }

  let revealTimer = null;

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getRevealDelay() {
    return prefersReducedMotion() ? 0 : 940;
  }

  function clearRevealTimer() {
    if (revealTimer !== null) {
      window.clearTimeout(revealTimer);
      revealTimer = null;
    }
  }

  function clampStep(value) {
    return Math.max(0, Math.min(2, value));
  }

  function scrollToElement(target, block) {
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: block || "start",
      inline: "nearest",
    });
  }

  function syncSceneVisibility() {
    closedScene.setAttribute("aria-hidden", step === 0 ? "false" : "true");
    openedScene.setAttribute("aria-hidden", step === 1 ? "false" : "true");
    detailsSection.setAttribute("aria-hidden", step === 2 ? "false" : "true");
    body.setAttribute("aria-busy", step === 1 ? "true" : "false");
  }

  function syncControls() {
    primaryAction.textContent = labels[step];
    primaryAction.setAttribute("aria-label", labels[step]);
    primaryAction.setAttribute("aria-pressed", step === 2 ? "true" : "false");
    primaryAction.disabled = step === 1;

    if (step === 2) {
      secondaryAction.hidden = false;
      secondaryAction.disabled = false;
      secondaryAction.setAttribute("aria-hidden", "false");
    } else {
      secondaryAction.hidden = true;
      secondaryAction.disabled = true;
      secondaryAction.setAttribute("aria-hidden", "true");
    }

    closedHitbox.setAttribute("aria-expanded", step > 0 ? "true" : "false");
    openedHitbox.setAttribute("aria-expanded", step === 2 ? "true" : "false");
  }

  function focusInvitationCard() {
    try {
      invitationCard.focus({ preventScroll: true });
    } catch (error) {
      invitationCard.focus();
    }
  }

  function applyStep(nextStep, options) {
    const config = options || {};

    step = clampStep(nextStep);
    body.setAttribute("data-step", String(step));
    syncSceneVisibility();
    syncControls();

    if (config.skipScroll) {
      return;
    }

    if (step === 2 && config.fromUser) {
      window.requestAnimationFrame(function () {
        scrollToElement(detailsSection, "start");
        if (config.focusDetails) {
          window.setTimeout(focusInvitationCard, prefersReducedMotion() ? 0 : 200);
        }
      });
      return;
    }

    if (step === 0 && config.fromUser) {
      window.requestAnimationFrame(function () {
        scrollToElement(inviteStage, "center");
        if (config.focusPrimary) {
          window.setTimeout(function () {
            primaryAction.focus();
          }, prefersReducedMotion() ? 0 : 140);
        }
      });
    }
  }

  function startRevealSequence() {
    if (step !== 0) {
      return;
    }

    clearRevealTimer();
    applyStep(1, { fromUser: true, skipScroll: true });

    revealTimer = window.setTimeout(function () {
      applyStep(2, { fromUser: true, focusDetails: true });
      clearRevealTimer();
    }, getRevealDelay());
  }

  function restartSequence() {
    clearRevealTimer();
    applyStep(0, { fromUser: true, focusPrimary: true });
  }

  closedHitbox.addEventListener("click", function () {
    startRevealSequence();
  });

  openedHitbox.addEventListener("click", function () {
    if (step === 1) {
      clearRevealTimer();
      applyStep(2, { fromUser: true, focusDetails: true });
    }
  });

  primaryAction.addEventListener("click", function () {
    if (step === 0) {
      startRevealSequence();
      return;
    }

    if (step === 2) {
      restartSequence();
    }
  });

  secondaryAction.addEventListener("click", function () {
    restartSequence();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && step > 0) {
      restartSequence();
    }
  });

  window.addEventListener("beforeunload", clearRevealTimer);

  applyStep(step, { skipScroll: true });
})();
