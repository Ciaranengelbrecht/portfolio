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
    0: "Tap to open",
    1: "Pull out invitation",
    2: "Start again",
  };

  let step = Number(body.getAttribute("data-step"));
  if (!Number.isInteger(step) || step < 0 || step > 2) {
    step = 0;
  }

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clampStep(value) {
    return Math.max(0, Math.min(2, value));
  }

  function scrollToElement(target) {
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
      inline: "nearest",
    });
  }

  function syncSceneVisibility() {
    closedScene.setAttribute("aria-hidden", step === 0 ? "false" : "true");
    openedScene.setAttribute("aria-hidden", step === 1 ? "false" : "true");
    detailsSection.setAttribute("aria-hidden", step === 2 ? "false" : "true");
  }

  function syncControls() {
    primaryAction.textContent = labels[step];
    primaryAction.setAttribute("aria-label", labels[step]);
    primaryAction.setAttribute("aria-pressed", step === 2 ? "true" : "false");

    if (step === 0) {
      secondaryAction.hidden = true;
      secondaryAction.disabled = true;
      secondaryAction.setAttribute("aria-hidden", "true");
    } else {
      secondaryAction.hidden = false;
      secondaryAction.disabled = false;
      secondaryAction.setAttribute("aria-hidden", "false");
    }

    closedHitbox.setAttribute("aria-expanded", step >= 1 ? "true" : "false");
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
    syncControls();
    syncSceneVisibility();

    if (config.skipScroll) {
      return;
    }

    if (step === 2 && config.fromUser) {
      window.requestAnimationFrame(function () {
        scrollToElement(detailsSection);
        if (config.focusDetails) {
          window.setTimeout(focusInvitationCard, prefersReducedMotion ? 0 : 220);
        }
      });
      return;
    }

    if (step < 2 && config.fromUser) {
      window.requestAnimationFrame(function () {
        scrollToElement(inviteStage);
      });
    }
  }

  function goForward() {
    if (step < 2) {
      applyStep(step + 1, { fromUser: true, focusDetails: step + 1 === 2 });
      return;
    }

    applyStep(0, { fromUser: true });
  }

  function goBackward() {
    if (step > 0) {
      applyStep(step - 1, { fromUser: true });
    }
  }

  closedHitbox.addEventListener("click", function () {
    if (step === 0) {
      applyStep(1, { fromUser: true });
    }
  });

  openedHitbox.addEventListener("click", function () {
    if (step === 1) {
      applyStep(2, { fromUser: true, focusDetails: true });
    }
  });

  primaryAction.addEventListener("click", goForward);
  secondaryAction.addEventListener("click", goBackward);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && step > 0) {
      goBackward();
      primaryAction.focus();
    }
  });

  applyStep(step, { skipScroll: true });
})();
