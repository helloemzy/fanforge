const revealElements = document.querySelectorAll('.reveal');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reducedMotion || !('IntersectionObserver' in window)) {
  for (const element of revealElements) {
    element.classList.add('is-visible');
  }
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.16 }
  );

  for (const element of revealElements) {
    observer.observe(element);
  }
}

const readerContent = document.querySelector('[data-reader-content]');
const readerToolbar = document.querySelector('[data-reader-toolbar]');

if (readerContent && readerToolbar) {
  const storageKey = 'fanforge_reader_prefs';
  const defaults = {
    fontScale: 1,
    lineHeight: 1.95,
    theme: 'paper',
  };

  let prefs = { ...defaults };

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      prefs = {
        fontScale: Number(parsed.fontScale) || defaults.fontScale,
        lineHeight: Number(parsed.lineHeight) || defaults.lineHeight,
        theme: typeof parsed.theme === 'string' ? parsed.theme : defaults.theme,
      };
    }
  } catch (_error) {
    prefs = { ...defaults };
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const applyPrefs = () => {
    document.documentElement.style.setProperty('--reader-font-scale', String(prefs.fontScale));
    document.documentElement.style.setProperty('--reader-line-height', String(prefs.lineHeight));
    document.body.classList.remove('reader-theme-paper', 'reader-theme-sepia', 'reader-theme-night');
    document.body.classList.add(`reader-theme-${prefs.theme}`);

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch (_error) {
      // Ignore write failures (private mode/storage disabled).
    }
  };

  readerToolbar.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.readerAction;
    const theme = target.dataset.readerTheme;

    if (action === 'font-up') {
      prefs.fontScale = clamp(Number((prefs.fontScale + 0.06).toFixed(2)), 0.9, 1.28);
      applyPrefs();
      return;
    }

    if (action === 'font-down') {
      prefs.fontScale = clamp(Number((prefs.fontScale - 0.06).toFixed(2)), 0.9, 1.28);
      applyPrefs();
      return;
    }

    if (action === 'line-up') {
      prefs.lineHeight = clamp(Number((prefs.lineHeight + 0.08).toFixed(2)), 1.55, 2.3);
      applyPrefs();
      return;
    }

    if (action === 'line-down') {
      prefs.lineHeight = clamp(Number((prefs.lineHeight - 0.08).toFixed(2)), 1.55, 2.3);
      applyPrefs();
      return;
    }

    if (theme && ['paper', 'sepia', 'night'].includes(theme)) {
      prefs.theme = theme;
      applyPrefs();
    }
  });

  applyPrefs();
}
