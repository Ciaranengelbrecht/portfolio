(function () {
  const body = document.body;
  const toggleButton = document.getElementById("toggleInvite");
  const envelopeButton = document.getElementById("envelopeButton");
  const closedComposition = document.querySelector(".closed-composition");
  const openComposition = document.querySelector(".open-composition");

  if (!toggleButton || !envelopeButton) {
    return;
  }

  let isOpen = false;

  function applyState(nextOpen) {
    isOpen = nextOpen;
    body.classList.toggle("is-open", isOpen);
    toggleButton.textContent = isOpen ? "< Return" : "Tap to open";
    toggleButton.setAttribute("aria-pressed", isOpen ? "true" : "false");
    envelopeButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    envelopeButton.setAttribute("aria-label", isOpen ? "Invitation opened" : "Open invitation");

    if (closedComposition) {
      closedComposition.setAttribute("aria-hidden", isOpen ? "true" : "false");
    }

    if (openComposition) {
      openComposition.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }
  }

  function toggleState() {
    applyState(!isOpen);
  }

  envelopeButton.addEventListener("click", function () {
    if (!isOpen) {
      applyState(true);
    }
  });

  toggleButton.addEventListener("click", toggleState);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen) {
      applyState(false);
      toggleButton.focus();
    }
  });

  applyState(false);
})();
