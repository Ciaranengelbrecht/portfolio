(function () {
  const body = document.body;
  const primaryAction = document.getElementById("primaryAction");
  const secondaryAction = document.getElementById("secondaryAction");
  const closedHitbox = document.getElementById("closedHitbox");
  const openedHitbox = document.getElementById("openedHitbox");
  const scenes = Array.from(document.querySelectorAll(".scene"));

  if (!primaryAction || !secondaryAction || !closedHitbox || !openedHitbox || scenes.length !== 3) {
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

  function clampStep(value) {
    return Math.max(0, Math.min(2, value));
  }

  function syncSceneVisibility() {
    scenes.forEach(function (scene, index) {
      scene.setAttribute("aria-hidden", index === step ? "false" : "true");
    });
  }

  function applyStep(nextStep) {
    step = clampStep(nextStep);
    body.setAttribute("data-step", String(step));
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
    syncSceneVisibility();
  }

  function goForward() {
    if (step < 2) {
      applyStep(step + 1);
      return;
    }

    applyStep(0);
  }

  function goBackward() {
    if (step > 0) {
      applyStep(step - 1);
    }
  }

  closedHitbox.addEventListener("click", function () {
    if (step === 0) {
      applyStep(1);
    }
  });

  openedHitbox.addEventListener("click", function () {
    if (step === 1) {
      applyStep(2);
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

  applyStep(step);
})();
