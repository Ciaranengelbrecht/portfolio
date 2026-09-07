(() => {
  'use strict';
  const countdown = document.getElementById('weddingCountdown');
  if (!countdown) return;

  // An explicit Perth offset keeps the ceremony time correct for guests abroad.
  const ceremony = new Date('2027-09-26T14:00:00+08:00').getTime();
  const title = document.getElementById('countdownTitle');
  const units = [
    [document.getElementById('countDays'), 86400],
    [document.getElementById('countHours'), 3600],
    [document.getElementById('countMinutes'), 60],
    [document.getElementById('countSeconds'), 1]
  ];
  let timer = null;

  function stop() {
    clearTimeout(timer);
    timer = null;
  }

  function update() {
    stop();
    let remaining = Math.max(0, Math.ceil((ceremony - Date.now()) / 1000));
    const finished = remaining === 0;
    units.forEach(([element, seconds]) => {
      const value = String(Math.floor(remaining / seconds)).padStart(2, '0');
      if (element.textContent !== value) element.textContent = value;
      remaining %= seconds;
    });
    title.textContent = finished ? 'The celebration has begun' : 'Until we say “I do”';
    countdown.hidden = false;
    if (!finished && !document.hidden) {
      timer = setTimeout(update, 1000 - Date.now() % 1000);
    }
  }

  document.addEventListener('visibilitychange', () => document.hidden ? stop() : update());
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', update);
  update();
})();
