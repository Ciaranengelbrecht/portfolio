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
  const layoutMode = new URLSearchParams(window.location.search).get("layout") === "1";

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

  const layoutItemsConfig = [
    {
      key: "closed-copy",
      selector: ".closed-copy",
      containerSelector: ".closed-envelope-group",
    },
    {
      key: "wax-seal",
      selector: ".wax-seal",
      containerSelector: ".closed-envelope-group",
    },
    {
      key: "bloom-left-large",
      selector: ".bloom-left-large",
      containerSelector: ".floral-layer",
    },
    {
      key: "bloom-left-small",
      selector: ".bloom-left-small",
      containerSelector: ".floral-layer",
    },
    {
      key: "bloom-right",
      selector: ".bloom-right",
      containerSelector: ".floral-layer",
    },
    {
      key: "bloom-mid-right",
      selector: ".bloom-mid-right",
      containerSelector: ".floral-layer",
    },
    {
      key: "orchid-left",
      selector: ".orchid-left",
      containerSelector: ".floral-layer",
    },
    {
      key: "orchid-right",
      selector: ".orchid-right",
      containerSelector: ".floral-layer",
    },
    {
      key: "orchid-mid",
      selector: ".orchid-mid",
      containerSelector: ".floral-layer",
    },
  ];
  const layoutStoreKey = "weddinginvite-layout-v1";

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
    if (layoutMode) {
      return;
    }

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
    if (layoutMode) {
      return;
    }

    clearRevealTimer();
    applyStep(0, { fromUser: true, focusPrimary: true });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function readLayoutState() {
    try {
      const raw = window.localStorage.getItem(layoutStoreKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return parsed;
    } catch (error) {
      return {};
    }
  }

  function saveLayoutState(state) {
    try {
      window.localStorage.setItem(layoutStoreKey, JSON.stringify(state));
    } catch (error) {
      return;
    }
  }

  function applyLayoutPosition(target, pos) {
    if (!target || !pos) {
      return;
    }

    target.style.left = round(pos.left) + "%";
    target.style.top = round(pos.top) + "%";
    target.style.right = "auto";
    target.style.bottom = "auto";
  }

  function buildCssSnippet(state) {
    return layoutItemsConfig
      .map(function (item) {
        const pos = state[item.key];
        if (!pos) {
          return null;
        }

        return (
          "." +
          item.key +
          " { left: " +
          round(pos.left) +
          "%; top: " +
          round(pos.top) +
          "%; right: auto; bottom: auto; }"
        );
      })
      .filter(Boolean)
      .join("\n");
  }

  function createLayoutPanel(state, getActiveKey) {
    const panel = document.createElement("aside");
    panel.className = "layout-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Layout mode controls");

    panel.innerHTML =
      '<p class="layout-title">Layout mode</p>' +
      '<p class="layout-help">Drag elements to reposition. These values are desktop-first.</p>' +
      '<p class="layout-active" id="layoutActive">Selected: none</p>' +
      '<div class="layout-actions">' +
      '<button type="button" id="copyLayoutButton">Copy CSS</button>' +
      '<button type="button" id="copyJsonButton">Copy JSON</button>' +
      '<button type="button" id="resetLayoutButton">Reset</button>' +
      "</div>" +
      '<p class="layout-help layout-note">Open normal mode by removing ?layout=1 from URL.</p>';

    document.body.appendChild(panel);

    const activeLabel = panel.querySelector("#layoutActive");
    const copyLayoutButton = panel.querySelector("#copyLayoutButton");
    const copyJsonButton = panel.querySelector("#copyJsonButton");
    const resetLayoutButton = panel.querySelector("#resetLayoutButton");

    function syncActiveLabel() {
      const active = getActiveKey();
      activeLabel.textContent = "Selected: " + (active || "none");
    }

    function copyToClipboard(text, button) {
      if (!text) {
        return;
      }

      const defaultLabel = button.textContent;

      function setCopiedLabel() {
        button.textContent = "Copied";
        window.setTimeout(function () {
          button.textContent = defaultLabel;
        }, 900);
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text).then(setCopiedLabel);
        return;
      }

      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "true");
      fallback.style.position = "fixed";
      fallback.style.left = "-9999px";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      document.body.removeChild(fallback);
      setCopiedLabel();
    }

    copyLayoutButton.addEventListener("click", function () {
      copyToClipboard(buildCssSnippet(state), copyLayoutButton);
    });

    copyJsonButton.addEventListener("click", function () {
      copyToClipboard(JSON.stringify(state, null, 2), copyJsonButton);
    });

    resetLayoutButton.addEventListener("click", function () {
      window.localStorage.removeItem(layoutStoreKey);
      window.location.reload();
    });

    return {
      syncActiveLabel: syncActiveLabel,
    };
  }

  function injectLayoutStyles() {
    const style = document.createElement("style");
    style.textContent =
      "body[data-layout-mode=\"true\"] .layout-panel {" +
      "position: fixed; top: 10px; left: 10px; z-index: 9999; width: min(320px, 92vw);" +
      "padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(130,95,36,0.45);" +
      "background: rgba(255,255,255,0.96); box-shadow: 0 8px 22px rgba(39,30,17,0.22);" +
      "font-family: \"Cinzel\", serif; color: #5d3d0f;" +
      "}" +
      "body[data-layout-mode=\"true\"] .layout-panel p { margin: 0; }" +
      "body[data-layout-mode=\"true\"] .layout-title { font-size: 0.9rem; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.34rem; }" +
      "body[data-layout-mode=\"true\"] .layout-help { font-family: \"Cormorant Garamond\", serif; font-size: 1rem; line-height: 1.1; margin-bottom: 0.4rem; }" +
      "body[data-layout-mode=\"true\"] .layout-active { font-family: \"Cormorant Garamond\", serif; font-size: 1rem; margin-bottom: 0.5rem; }" +
      "body[data-layout-mode=\"true\"] .layout-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.34rem; }" +
      "body[data-layout-mode=\"true\"] .layout-actions button {" +
      "border-radius: 999px; border: 1px solid rgba(130,95,36,0.42); background: #fff;" +
      "padding: 0.3rem 0.65rem; font-family: \"Cinzel\", serif; font-size: 0.72rem; color: #7b4f11; cursor: pointer;" +
      "}" +
      "body[data-layout-mode=\"true\"] .layout-note { font-size: 0.92rem; margin-top: 0.2rem; }" +
      "body[data-layout-mode=\"true\"] .layout-draggable { outline: 2px dashed rgba(207,160,67,0.55); outline-offset: 2px; cursor: grab; pointer-events: auto !important; touch-action: none; }" +
      "body[data-layout-mode=\"true\"] .layout-draggable.layout-active-item { outline-color: rgba(143,103,40,0.95); }" +
      "body[data-layout-mode=\"true\"] .controls { opacity: 0.35; pointer-events: none; }";

    document.head.appendChild(style);
  }

  function initLayoutMode() {
    body.setAttribute("data-layout-mode", "true");

    const state = readLayoutState();
    const dragItems = [];
    let activeKey = null;
    let activeEl = null;

    layoutItemsConfig.forEach(function (config) {
      const target = document.querySelector(config.selector);
      const container = document.querySelector(config.containerSelector);
      if (!target || !container) {
        return;
      }

      target.classList.add("layout-draggable");

      const item = {
        key: config.key,
        target: target,
        container: container,
      };

      dragItems.push(item);

      if (state[item.key]) {
        applyLayoutPosition(item.target, state[item.key]);
      }
    });

    function setActive(item) {
      if (activeEl) {
        activeEl.classList.remove("layout-active-item");
      }

      activeKey = item ? item.key : null;
      activeEl = item ? item.target : null;

      if (activeEl) {
        activeEl.classList.add("layout-active-item");
      }

      panel.syncActiveLabel();
    }

    function positionFromPointer(item, event) {
      const rect = item.container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      const left = clamp(round(x), -15, 115);
      const top = clamp(round(y), -15, 115);

      state[item.key] = {
        left: left,
        top: top,
      };

      applyLayoutPosition(item.target, state[item.key]);
      saveLayoutState(state);
    }

    dragItems.forEach(function (item) {
      item.target.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setActive(item);
        item.target.setPointerCapture(event.pointerId);
        positionFromPointer(item, event);
      });

      item.target.addEventListener("pointermove", function (event) {
        if (!item.target.hasPointerCapture(event.pointerId)) {
          return;
        }

        event.preventDefault();
        positionFromPointer(item, event);
      });

      item.target.addEventListener("pointerup", function (event) {
        if (item.target.hasPointerCapture(event.pointerId)) {
          item.target.releasePointerCapture(event.pointerId);
        }
      });
    });

    injectLayoutStyles();
    const panel = createLayoutPanel(state, function () {
      return activeKey;
    });
    panel.syncActiveLabel();

    primaryAction.textContent = "Layout mode active";
    primaryAction.disabled = true;
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
    if (layoutMode) {
      return;
    }

    if (event.key === "Escape" && step > 0) {
      restartSequence();
    }
  });

  window.addEventListener("beforeunload", clearRevealTimer);

  applyStep(step, { skipScroll: true });

  if (layoutMode) {
    clearRevealTimer();
    applyStep(0, { skipScroll: true });
    initLayoutMode();
  }
})();
