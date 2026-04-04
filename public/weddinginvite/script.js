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

  const layoutMode = new URLSearchParams(window.location.search).get("layout") === "1";

  const labels = {
    0: "Open invitation",
    1: "Opening invitation...",
    2: "Start again",
  };

  const fixedLayoutItemsConfig = [
    {
      key: "closed-copy",
      selector: ".closed-copy",
      containerSelector: ".closed-envelope-group",
      baseTransform: "translate(-50%, -50%)",
    },
    {
      key: "wax-seal",
      selector: ".wax-seal",
      containerSelector: ".closed-envelope-group",
      baseTransform: "translate(-50%, -50%)",
    },
  ];

  const baseFlowerItemsConfig = [
    { id: "bloom-left-large", selector: ".bloom-left-large" },
    { id: "bloom-left-small", selector: ".bloom-left-small" },
    { id: "bloom-right", selector: ".bloom-right" },
    { id: "bloom-mid-right", selector: ".bloom-mid-right" },
    { id: "orchid-left", selector: ".orchid-left" },
    { id: "orchid-right", selector: ".orchid-right" },
    { id: "orchid-mid", selector: ".orchid-mid" },
  ];

  const layoutAssetOptions = [
    "3daboveflowers.png",
    "backgroundorchids1.png",
    "backgroundorchids2.png",
    "orchid.png",
    "closedletter.png",
    "stampoverlay.png",
    "openbottomletter.png",
    "openlettertop.png",
    "backgroundpaper.jpg",
  ];

  const layoutStoreKey = "weddinginvite-layout-v3";

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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function composeTransform(baseTransform, rotate, scale) {
    const base = baseTransform ? baseTransform + " " : "";
    return base + "rotate(" + round(rotate || 0) + "deg) scale(" + round(scale || 1) + ")";
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

  function readLayoutState() {
    try {
      const raw = window.localStorage.getItem(layoutStoreKey);
      if (!raw) {
        return { fixed: {}, flowers: {} };
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { fixed: {}, flowers: {} };
      }

      if (!parsed.fixed || typeof parsed.fixed !== "object") {
        parsed.fixed = {};
      }

      if (!parsed.flowers || typeof parsed.flowers !== "object") {
        parsed.flowers = {};
      }

      return parsed;
    } catch (error) {
      return { fixed: {}, flowers: {} };
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
    target.style.left = round(pos.left) + "%";
    target.style.top = round(pos.top) + "%";
    target.style.right = "auto";
    target.style.bottom = "auto";
  }

  function applyFixedVisual(target, fixedState, baseTransform) {
    applyLayoutPosition(target, fixedState);
    target.style.transform = composeTransform(baseTransform || "", fixedState.rotate || 0, fixedState.scale || 1);
    target.style.transformOrigin = "center center";
  }

  function applyFlowerVisual(target, flowerState) {
    applyLayoutPosition(target, flowerState);
    target.style.transform = composeTransform("", flowerState.rotate || 0, flowerState.scale || 1);
    target.style.transformOrigin = "center center";
    target.style.display = flowerState.hidden ? "none" : "";
  }

  function computePercentPosition(target, container) {
    const tr = target.getBoundingClientRect();
    const cr = container.getBoundingClientRect();

    return {
      left: round(((tr.left - cr.left) / cr.width) * 100),
      top: round(((tr.top - cr.top) / cr.height) * 100),
    };
  }

  function parseRotationDegrees(target) {
    const transform = window.getComputedStyle(target).transform;
    if (!transform || transform === "none") {
      return 0;
    }

    const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
    if (!matrixMatch) {
      return 0;
    }

    const values = matrixMatch[1].split(",").map(function (value) {
      return Number(value.trim());
    });

    if (values.length < 2 || Number.isNaN(values[0]) || Number.isNaN(values[1])) {
      return 0;
    }

    return round((Math.atan2(values[1], values[0]) * 180) / Math.PI);
  }

  function filenameFromSrc(src) {
    if (!src) {
      return "";
    }

    const cleaned = src.split("?")[0].split("#")[0];
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }

  function assetPathFromFilename(name) {
    return "./assets/" + name;
  }

  function defaultFlowerClassFromAsset(assetName) {
    const lower = (assetName || "").toLowerCase();
    if (lower.includes("orchid")) {
      return "asset orchid layout-custom-flower";
    }

    return "asset bloom layout-custom-flower";
  }

  function buildCssSnippet(state, dragItems) {
    const lines = [];

    fixedLayoutItemsConfig.forEach(function (item) {
      const pos = state.fixed[item.key];
      if (!pos) {
        return;
      }

      lines.push(
        item.selector +
          " { left: " +
          round(pos.left) +
          "%; top: " +
          round(pos.top) +
          "%; right: auto; bottom: auto; transform: " +
          composeTransform(item.baseTransform || "", pos.rotate || 0, pos.scale || 1) +
          "; }"
      );
    });

    Object.keys(state.flowers)
      .sort()
      .forEach(function (id) {
        const flower = state.flowers[id];
        const item = dragItems[id];
        if (!flower || !item) {
          return;
        }

        const selector = item.selector || '.layout-custom-flower[data-layout-id="' + id + '"]';

        if (flower.hidden) {
          lines.push(selector + " { display: none; }");
          return;
        }

        lines.push(
          selector +
            " { left: " +
            round(flower.left) +
            "%; top: " +
            round(flower.top) +
            "%; right: auto; bottom: auto; transform: " +
            composeTransform("", flower.rotate || 0, flower.scale || 1) +
            "; }"
        );
      });

    return lines.join("\n");
  }

  function buildCustomFlowerHtmlSnippet(state) {
    return Object.keys(state.flowers)
      .sort()
      .map(function (id) {
        const flower = state.flowers[id];
        if (!flower || !flower.custom || flower.hidden) {
          return null;
        }

        return (
          '<img class="' +
          (flower.classes || "asset bloom layout-custom-flower") +
          '" data-layout-id="' +
          id +
          '" src="' +
          assetPathFromFilename(flower.asset) +
          '" alt="" />'
        );
      })
      .filter(Boolean)
      .join("\n");
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

  function injectLayoutStyles() {
    const style = document.createElement("style");
    style.textContent =
      "body[data-layout-mode=\"true\"] .layout-panel {" +
      "position: fixed; right: 10px; bottom: 10px; left: auto; top: auto; z-index: 9999; width: min(340px, 86vw);" +
      "max-height: min(72vh, 560px); overflow: auto;" +
      "padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(130,95,36,0.45);" +
      "background: rgba(255,255,255,0.96); box-shadow: 0 8px 22px rgba(39,30,17,0.22);" +
      "font-family: \"Cinzel\", serif; color: #5d3d0f;" +
      "}" +
      "body[data-layout-mode=\"true\"] .layout-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; margin-bottom: 0.32rem; }" +
      "body[data-layout-mode=\"true\"] .layout-panel-header button { border-radius: 999px; border: 1px solid rgba(130,95,36,0.42); background: #fff; padding: 0.22rem 0.6rem; font-family: \"Cinzel\", serif; font-size: 0.66rem; color: #7b4f11; cursor: pointer; }" +
      "body[data-layout-mode=\"true\"] .layout-panel.collapsed { width: auto; max-height: none; overflow: visible; }" +
      "body[data-layout-mode=\"true\"] .layout-panel.collapsed #layoutPanelBody { display: none; }" +
      "body[data-layout-mode=\"true\"] .layout-panel p { margin: 0; }" +
      "body[data-layout-mode=\"true\"] .layout-title { font-size: 0.9rem; letter-spacing: 0.04em; text-transform: uppercase; }" +
      "body[data-layout-mode=\"true\"] .layout-help { font-family: \"Cormorant Garamond\", serif; font-size: 1rem; line-height: 1.1; margin-bottom: 0.4rem; }" +
      "body[data-layout-mode=\"true\"] .layout-active { font-family: \"Cormorant Garamond\", serif; font-size: 1rem; margin-bottom: 0.5rem; }" +
      "body[data-layout-mode=\"true\"] .layout-label { display: block; margin: 0.28rem 0 0.12rem; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; }" +
      "body[data-layout-mode=\"true\"] .layout-row { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem; margin-bottom: 0.34rem; }" +
      "body[data-layout-mode=\"true\"] .layout-row select, body[data-layout-mode=\"true\"] .layout-row button, body[data-layout-mode=\"true\"] #deleteFlowerButton { border-radius: 9px; border: 1px solid rgba(130,95,36,0.38); background: #fff; color: #684311; min-height: 30px; font-family: \"Cormorant Garamond\", serif; font-size: 0.9rem; }" +
      "body[data-layout-mode=\"true\"] #deleteFlowerButton { width: 100%; margin-top: 0.32rem; margin-bottom: 0.3rem; }" +
      "body[data-layout-mode=\"true\"] #flowerScaleInput, body[data-layout-mode=\"true\"] #flowerRotateInput { width: 100%; margin-bottom: 0.2rem; }" +
      "body[data-layout-mode=\"true\"] .layout-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.34rem; }" +
      "body[data-layout-mode=\"true\"] .layout-actions button { border-radius: 999px; border: 1px solid rgba(130,95,36,0.42); background: #fff; padding: 0.3rem 0.65rem; font-family: \"Cinzel\", serif; font-size: 0.72rem; color: #7b4f11; cursor: pointer; }" +
      "body[data-layout-mode=\"true\"] .layout-note { font-size: 0.92rem; margin-top: 0.2rem; }" +
      "body[data-layout-mode=\"true\"] .scene-hitbox { display: none !important; }" +
      "body[data-layout-mode=\"true\"] .floral-layer { pointer-events: auto !important; z-index: 60 !important; }" +
      "body[data-layout-mode=\"true\"] .layout-draggable { outline: 2px dashed rgba(207,160,67,0.55); outline-offset: 2px; cursor: grab; pointer-events: auto !important; touch-action: none; z-index: 70 !important; }" +
      "body[data-layout-mode=\"true\"] .layout-draggable.layout-active-item { outline-color: rgba(143,103,40,0.95); z-index: 90 !important; }" +
      "body[data-layout-mode=\"true\"] .controls { opacity: 0.35; pointer-events: none; }" +
      "@media (max-width: 700px) { body[data-layout-mode=\"true\"] .layout-panel { width: min(300px, 72vw); right: 8px; bottom: 8px; } }";

    document.head.appendChild(style);
  }

  function createLayoutPanel(state, callbacks) {
    const panel = document.createElement("aside");
    panel.className = "layout-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Layout mode controls");

    panel.innerHTML =
      '<div class="layout-panel-header">' +
      '<p class="layout-title">Layout mode</p>' +
      '<button type="button" id="togglePanelButton">Hide</button>' +
      "</div>" +
      '<div id="layoutPanelBody">' +
      '<p class="layout-help">Drag to reposition. Select any element to move, scale, and rotate.</p>' +
      '<p class="layout-active" id="layoutActive">Selected: none</p>' +
      '<label class="layout-label" for="flowerAssetSelect">Add flower asset</label>' +
      '<div class="layout-row">' +
      '<select id="flowerAssetSelect"></select>' +
      '<button type="button" id="addFlowerButton">Add</button>' +
      "</div>" +
      '<label class="layout-label" for="itemScaleInput">Scale (selected item)</label>' +
      '<input type="range" id="itemScaleInput" min="0.3" max="2.8" step="0.01" value="1" />' +
      '<label class="layout-label" for="itemRotateInput">Rotate (selected item)</label>' +
      '<input type="range" id="itemRotateInput" min="-180" max="180" step="1" value="0" />' +
      '<button type="button" id="deleteFlowerButton">Delete selected flower</button>' +
      '<div class="layout-actions">' +
      '<button type="button" id="copyLayoutButton">Copy CSS</button>' +
      '<button type="button" id="copyHardcodeButton">Copy HTML+CSS</button>' +
      '<button type="button" id="copyJsonButton">Copy JSON</button>' +
      '<button type="button" id="resetLayoutButton">Reset</button>' +
      "</div>" +
      '<p class="layout-help layout-note">Use Hide while editing behind panel. Remove ?layout=1 for normal mode.</p>' +
      "</div>";

    document.body.appendChild(panel);

    const togglePanelButton = panel.querySelector("#togglePanelButton");
    const activeLabel = panel.querySelector("#layoutActive");
    const assetSelect = panel.querySelector("#flowerAssetSelect");
    const addFlowerButton = panel.querySelector("#addFlowerButton");
    const scaleInput = panel.querySelector("#itemScaleInput");
    const rotateInput = panel.querySelector("#itemRotateInput");
    const deleteFlowerButton = panel.querySelector("#deleteFlowerButton");
    const copyLayoutButton = panel.querySelector("#copyLayoutButton");
    const copyHardcodeButton = panel.querySelector("#copyHardcodeButton");
    const copyJsonButton = panel.querySelector("#copyJsonButton");
    const resetLayoutButton = panel.querySelector("#resetLayoutButton");

    layoutAssetOptions.forEach(function (assetName) {
      const option = document.createElement("option");
      option.value = assetName;
      option.textContent = assetName;
      assetSelect.appendChild(option);
    });

    togglePanelButton.addEventListener("click", function () {
      const collapsed = panel.classList.toggle("collapsed");
      togglePanelButton.textContent = collapsed ? "Show" : "Hide";
    });

    addFlowerButton.addEventListener("click", function () {
      callbacks.onAddFlower(assetSelect.value);
    });

    scaleInput.addEventListener("input", function () {
      callbacks.onScaleChange(Number(scaleInput.value));
    });

    rotateInput.addEventListener("input", function () {
      callbacks.onRotateChange(Number(rotateInput.value));
    });

    deleteFlowerButton.addEventListener("click", function () {
      callbacks.onDeleteSelectedFlower();
    });

    copyLayoutButton.addEventListener("click", function () {
      copyToClipboard(callbacks.getCssSnippet(), copyLayoutButton);
    });

    copyHardcodeButton.addEventListener("click", function () {
      copyToClipboard(callbacks.getHardcodeSnippet(), copyHardcodeButton);
    });

    copyJsonButton.addEventListener("click", function () {
      copyToClipboard(JSON.stringify(state, null, 2), copyJsonButton);
    });

    resetLayoutButton.addEventListener("click", function () {
      window.localStorage.removeItem(layoutStoreKey);
      window.location.reload();
    });

    return {
      syncActiveLabel: function (activeLabelValue) {
        activeLabel.textContent = "Selected: " + (activeLabelValue || "none");
      },
      syncTransformControls: function (activeState, selectedItemFixed) {
        const enabled = Boolean(activeState);
        scaleInput.disabled = !enabled;
        rotateInput.disabled = !enabled;
        deleteFlowerButton.disabled = !enabled || Boolean(selectedItemFixed);

        if (!enabled) {
          scaleInput.value = "1";
          rotateInput.value = "0";
          return;
        }

        scaleInput.value = String(round(activeState.scale || 1));
        rotateInput.value = String(round(activeState.rotate || 0));
      },
    };
  }

  function initLayoutMode() {
    body.setAttribute("data-layout-mode", "true");

    const state = readLayoutState();
    const floralLayer = document.querySelector(".floral-layer");
    if (!floralLayer) {
      return;
    }

    injectLayoutStyles();

    const dragItems = {};
    let activeId = null;
    let activeType = null;
    let activeEl = null;
    let panel = null;

    function getActiveState() {
      if (!activeId) {
        return null;
      }

      if (activeType === "fixed") {
        return state.fixed[activeId] || null;
      }

      if (activeType === "flower") {
        return state.flowers[activeId] || null;
      }

      return null;
    }

    function syncPanelSelection() {
      if (!panel) {
        return;
      }

      panel.syncActiveLabel(activeId || null);
      panel.syncTransformControls(getActiveState(), activeType === "fixed");
    }

    function setActive(item) {
      if (activeEl) {
        activeEl.classList.remove("layout-active-item");
      }

      activeId = item ? item.id : null;
      activeType = item ? item.type : null;
      activeEl = item ? item.target : null;

      if (activeEl) {
        activeEl.classList.add("layout-active-item");
      }

      syncPanelSelection();
    }

    function registerDragItem(item) {
      dragItems[item.id] = item;
      item.target.classList.add("layout-draggable");

      item.target.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setActive(item);

        const rect = item.container.getBoundingClientRect();
        const current = item.type === "fixed" ? state.fixed[item.id] : state.flowers[item.id];

        const dragSession = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: current ? current.left : 50,
          startTop: current ? current.top : 50,
          width: rect.width,
          height: rect.height,
        };

        item.target.setPointerCapture(event.pointerId);

        function updatePosition(moveEvent) {
          if (!item.target.hasPointerCapture(dragSession.pointerId)) {
            return;
          }

          const dx = ((moveEvent.clientX - dragSession.startX) / dragSession.width) * 100;
          const dy = ((moveEvent.clientY - dragSession.startY) / dragSession.height) * 100;
          const left = clamp(round(dragSession.startLeft + dx), -20, 120);
          const top = clamp(round(dragSession.startTop + dy), -20, 120);

          if (item.type === "fixed") {
            if (!state.fixed[item.id]) {
              state.fixed[item.id] = { left: left, top: top, scale: 1, rotate: 0 };
            }

            state.fixed[item.id].left = left;
            state.fixed[item.id].top = top;
            applyFixedVisual(item.target, state.fixed[item.id], item.baseTransform || "");
            saveLayoutState(state);
            return;
          }

          if (!state.flowers[item.id]) {
            return;
          }

          state.flowers[item.id].left = left;
          state.flowers[item.id].top = top;
          applyFlowerVisual(item.target, state.flowers[item.id]);
          saveLayoutState(state);
        }

        function endDrag() {
          if (item.target.hasPointerCapture(dragSession.pointerId)) {
            item.target.releasePointerCapture(dragSession.pointerId);
          }

          item.target.removeEventListener("pointermove", updatePosition);
          item.target.removeEventListener("pointerup", endDrag);
          item.target.removeEventListener("pointercancel", endDrag);
        }

        item.target.addEventListener("pointermove", updatePosition);
        item.target.addEventListener("pointerup", endDrag);
        item.target.addEventListener("pointercancel", endDrag);
      });
    }

    fixedLayoutItemsConfig.forEach(function (config) {
      const target = document.querySelector(config.selector);
      const container = document.querySelector(config.containerSelector);
      if (!target || !container) {
        return;
      }

      if (!state.fixed[config.key]) {
        const initial = computePercentPosition(target, container);
        state.fixed[config.key] = {
          left: initial.left,
          top: initial.top,
          scale: 1,
          rotate: 0,
        };
      }

      applyFixedVisual(target, state.fixed[config.key], config.baseTransform || "");
      registerDragItem({
        id: config.key,
        type: "fixed",
        selector: config.selector,
        target: target,
        container: container,
        baseTransform: config.baseTransform || "",
      });
    });

    function ensureFlowerState(id, seed) {
      if (!state.flowers[id]) {
        state.flowers[id] = seed;
      }
    }

    function createFlowerItemRecord(id, selector, target, custom) {
      return {
        id: id,
        type: "flower",
        selector: selector,
        target: target,
        container: floralLayer,
        custom: Boolean(custom),
      };
    }

    baseFlowerItemsConfig.forEach(function (flowerDef) {
      const target = document.querySelector(flowerDef.selector);
      if (!target) {
        return;
      }

      const pos = computePercentPosition(target, floralLayer);
      ensureFlowerState(flowerDef.id, {
        left: pos.left,
        top: pos.top,
        scale: 1,
        rotate: parseRotationDegrees(target),
        hidden: false,
        custom: false,
        asset: filenameFromSrc(target.getAttribute("src") || ""),
        classes: target.className,
      });

      applyFlowerVisual(target, state.flowers[flowerDef.id]);
      registerDragItem(createFlowerItemRecord(flowerDef.id, flowerDef.selector, target, false));
    });

    function mountCustomFlower(id, flowerState) {
      let target = floralLayer.querySelector('[data-layout-id="' + id + '"]');

      if (!target) {
        target = document.createElement("img");
        target.setAttribute("alt", "");
        target.setAttribute("aria-hidden", "true");
        target.setAttribute("data-layout-id", id);
        floralLayer.appendChild(target);
      }

      target.className = flowerState.classes || defaultFlowerClassFromAsset(flowerState.asset);
      target.setAttribute("src", assetPathFromFilename(flowerState.asset));
      applyFlowerVisual(target, flowerState);
      registerDragItem(createFlowerItemRecord(id, null, target, true));
    }

    Object.keys(state.flowers).forEach(function (id) {
      const flowerState = state.flowers[id];
      if (!flowerState || !flowerState.custom) {
        return;
      }

      mountCustomFlower(id, flowerState);
    });

    function addFlower(assetName) {
      const id =
        "custom-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 6);

      state.flowers[id] = {
        left: 48,
        top: 42,
        scale: 1,
        rotate: 0,
        hidden: false,
        custom: true,
        asset: assetName,
        classes: defaultFlowerClassFromAsset(assetName),
      };

      mountCustomFlower(id, state.flowers[id]);
      saveLayoutState(state);
      setActive(dragItems[id]);
    }

    function deleteSelectedFlower() {
      if (!activeId || activeType !== "flower") {
        return;
      }

      const flower = state.flowers[activeId];
      const item = dragItems[activeId];
      if (!flower || !item) {
        return;
      }

      if (flower.custom) {
        if (item.target && item.target.parentNode) {
          item.target.parentNode.removeChild(item.target);
        }

        delete state.flowers[activeId];
        delete dragItems[activeId];
        setActive(null);
        saveLayoutState(state);
        return;
      }

      flower.hidden = true;
      applyFlowerVisual(item.target, flower);
      setActive(null);
      saveLayoutState(state);
    }

    function updateActiveTransform(nextScale, nextRotate) {
      const item = activeId ? dragItems[activeId] : null;
      if (!item) {
        return;
      }

      if (item.type === "fixed") {
        const fixed = state.fixed[item.id];
        if (!fixed) {
          return;
        }

        fixed.scale = clamp(round(nextScale), 0.3, 2.8);
        fixed.rotate = clamp(round(nextRotate), -180, 180);
        applyFixedVisual(item.target, fixed, item.baseTransform || "");
        saveLayoutState(state);
        syncPanelSelection();
        return;
      }

      const flower = state.flowers[item.id];
      if (!flower) {
        return;
      }

      flower.scale = clamp(round(nextScale), 0.3, 2.8);
      flower.rotate = clamp(round(nextRotate), -180, 180);
      applyFlowerVisual(item.target, flower);
      saveLayoutState(state);
      syncPanelSelection();
    }

    function getCssSnippet() {
      return buildCssSnippet(state, dragItems);
    }

    function getHardcodeSnippet() {
      return (
        "/* Add inside .floral-layer for custom flowers */\n" +
        (buildCustomFlowerHtmlSnippet(state) || "/* No custom flowers added */") +
        "\n\n/* Position overrides */\n" +
        getCssSnippet()
      );
    }

    panel = createLayoutPanel(state, {
      onAddFlower: addFlower,
      onDeleteSelectedFlower: deleteSelectedFlower,
      onScaleChange: function (nextScale) {
        const current = getActiveState();
        if (!current) {
          return;
        }

        updateActiveTransform(nextScale, current.rotate || 0);
      },
      onRotateChange: function (nextRotate) {
        const current = getActiveState();
        if (!current) {
          return;
        }

        updateActiveTransform(current.scale || 1, nextRotate);
      },
      getCssSnippet: getCssSnippet,
      getHardcodeSnippet: getHardcodeSnippet,
    });

    syncPanelSelection();

    primaryAction.textContent = "Layout mode active";
    primaryAction.disabled = true;
    secondaryAction.hidden = true;
    secondaryAction.disabled = true;

    saveLayoutState(state);

    document.addEventListener("keydown", function (event) {
      const item = activeId ? dragItems[activeId] : null;
      if (!item) {
        return;
      }

      const current = getActiveState();
      if (!current) {
        return;
      }

      const moveStep = event.shiftKey ? 1.6 : 0.45;
      let moved = false;

      if (event.key === "ArrowLeft") {
        current.left = clamp(round(current.left - moveStep), -20, 120);
        moved = true;
      } else if (event.key === "ArrowRight") {
        current.left = clamp(round(current.left + moveStep), -20, 120);
        moved = true;
      } else if (event.key === "ArrowUp") {
        current.top = clamp(round(current.top - moveStep), -20, 120);
        moved = true;
      } else if (event.key === "ArrowDown") {
        current.top = clamp(round(current.top + moveStep), -20, 120);
        moved = true;
      }

      if (!moved) {
        return;
      }

      event.preventDefault();

      if (item.type === "fixed") {
        applyFixedVisual(item.target, current, item.baseTransform || "");
      } else {
        applyFlowerVisual(item.target, current);
      }

      saveLayoutState(state);
      syncPanelSelection();
    });
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
