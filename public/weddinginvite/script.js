(function () {
  const page = document.querySelector('.invite-page');
  const closedScene = document.getElementById('closedScene');
  const openScene = document.getElementById('openScene');
  const overlay = document.getElementById('openOverlay');
  const openButton = document.getElementById('openButton');
  const backButton = document.getElementById('backButton');

  if (!page || !closedScene || !openScene || !overlay || !openButton || !backButton) {
    return;
  }

  function setStep(step) {
    const nextStep = step === 'open' ? 'open' : 'closed';
    const isOpen = nextStep === 'open';

    page.dataset.step = nextStep;
    closedScene.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    openScene.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    openButton.hidden = isOpen;
    backButton.hidden = !isOpen;
  }

  function openInvite() {
    setStep('open');
  }

  function closeInvite() {
    setStep('closed');
  }

  overlay.addEventListener('click', openInvite);
  openButton.addEventListener('click', openInvite);
  backButton.addEventListener('click', closeInvite);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeInvite();
    }
  });

  setStep(page.dataset.step);
})();
