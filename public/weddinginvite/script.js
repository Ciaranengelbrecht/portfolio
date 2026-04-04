(function () {
  const body = document.body;
  const openButton = document.getElementById('openButton');
  const backButton = document.getElementById('backButton');
  const openOverlay = document.getElementById('openOverlay');
  const closedView = document.getElementById('closedView');
  const openView = document.getElementById('openView');

  if (!openButton || !backButton || !openOverlay || !closedView || !openView) {
    return;
  }

  function setStep(step) {
    const isOpen = step === 'open';

    body.setAttribute('data-step', isOpen ? 'open' : 'closed');
    closedView.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    openView.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

    openButton.hidden = isOpen;
    backButton.hidden = !isOpen;
  }

  function openInvitation() {
    setStep('open');
  }

  function returnInvitation() {
    setStep('closed');
  }

  openOverlay.addEventListener('click', openInvitation);
  openButton.addEventListener('click', openInvitation);
  backButton.addEventListener('click', returnInvitation);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && body.getAttribute('data-step') === 'open') {
      returnInvitation();
    }
  });

  setStep('closed');
})();
