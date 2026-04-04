(function () {
  const page = document.querySelector('.invite-page');
  const closedScene = document.getElementById('closedScene');
  const openScene = document.getElementById('openScene');
  const overlay = document.getElementById('openOverlay');
  const returnLink = document.getElementById('returnLink');

  if (!page || !closedScene || !openScene || !overlay || !returnLink) {
    return;
  }

  function setStep(step) {
    const nextStep = step === 'open' ? 'open' : 'closed';
    const isOpen = nextStep === 'open';

    page.dataset.step = nextStep;
    closedScene.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    openScene.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    returnLink.hidden = !isOpen;
  }

  function openInvite() {
    setStep('open');
  }

  function closeInvite() {
    setStep('closed');
  }

  overlay.addEventListener('click', openInvite);
  returnLink.addEventListener('click', closeInvite);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeInvite();
    }
  });

  setStep(page.dataset.step);
})();
