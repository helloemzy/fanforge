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
const progressLabel = document.querySelector('[data-reading-progress-label]');
const wordsLabel = document.querySelector('[data-reading-words-label]');
const progressBar = document.querySelector('[data-reading-progress-bar]');
const syncState = document.querySelector('[data-reading-sync-state]');
const resumeReaderButton = document.querySelector('[data-resume-reader]');
const jumpTopButton = document.querySelector('[data-reader-jump-top]');

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

if (readerContent && readerToolbar && readerContent.dataset.contentLocked !== 'true') {
  const workId = Number(readerContent.dataset.workId);
  const totalWords = Number(readerContent.dataset.totalWords) || 0;
  const csrfToken = readerContent.dataset.csrfToken || '';
  const progressStorageKey = `fanforge_reader_progress_${workId}`;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const serverProgress = clamp(Number(readerContent.dataset.progressPercent) || 0, 0, 100);
  const serverWords = Math.max(0, Number(readerContent.dataset.wordsRead) || 0);

  let localProgress = serverProgress;
  let localWords = serverWords;

  try {
    const stored = window.localStorage.getItem(progressStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      localProgress = clamp(Math.max(serverProgress, Number(parsed.progressPercent) || 0), 0, 100);
      localWords = Math.max(serverWords, Number(parsed.wordsRead) || 0);
    }
  } catch (_error) {
    localProgress = serverProgress;
    localWords = serverWords;
  }

  const state = {
    lastSentProgress: serverProgress,
    progressPercent: localProgress,
    wordsRead: localWords,
    queued: false,
    saving: false,
    saveTimer: null,
  };

  const updateProgressUI = () => {
    if (progressLabel) {
      progressLabel.textContent =
        state.progressPercent >= 1 ? `${state.progressPercent}% saved` : 'Just getting started';
    }

    if (wordsLabel) {
      wordsLabel.textContent =
        state.wordsRead >= 1
          ? `${state.wordsRead.toLocaleString('en-US')} of ${totalWords.toLocaleString('en-US')} words tracked`
          : 'Progress will appear after you scroll';
    }

    if (progressBar) {
      progressBar.style.width = `${state.progressPercent}%`;
    }

    if (resumeReaderButton) {
      resumeReaderButton.hidden = state.progressPercent < 8 || state.progressPercent >= 98;
    }
  };

  const setSyncLabel = (value) => {
    if (syncState) {
      syncState.textContent = value;
    }
  };

  const persistLocalProgress = () => {
    try {
      window.localStorage.setItem(
        progressStorageKey,
        JSON.stringify({
          progressPercent: state.progressPercent,
          wordsRead: state.wordsRead,
        })
      );
    } catch (_error) {
      // Ignore local storage failures.
    }
  };

  const computeProgress = () => {
    const rect = readerContent.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const storyTop = window.scrollY + rect.top;
    const storyHeight = Math.max(readerContent.offsetHeight, 1);
    const readerLine = window.scrollY + viewportHeight * 0.36;
    const rawProgress = ((readerLine - storyTop) / storyHeight) * 100;
    const progressPercent = clamp(Math.round(rawProgress), 0, 100);

    return {
      progressPercent,
      wordsRead: Math.min(totalWords, Math.round((totalWords * progressPercent) / 100)),
    };
  };

  const sendProgress = async (keepalive = false) => {
    if (state.saving) {
      state.queued = true;
      return;
    }

    if (state.progressPercent <= 0 || Math.abs(state.progressPercent - state.lastSentProgress) < 2) {
      return;
    }

    state.saving = true;
    setSyncLabel('Saving your place');

    try {
      const response = await fetch(`/works/${workId}/progress`, {
        method: 'POST',
        keepalive,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          _csrf: csrfToken,
          progressPercent: state.progressPercent,
          wordsRead: state.wordsRead,
        }),
      });

      if (response.ok) {
        state.lastSentProgress = state.progressPercent;
        setSyncLabel('Place saved');
      } else {
        setSyncLabel('Save paused');
      }
    } catch (_error) {
      setSyncLabel('Save paused');
    } finally {
      state.saving = false;

      if (state.queued) {
        state.queued = false;
        void sendProgress(keepalive);
      }
    }
  };

  const updateFromViewport = () => {
    const nextProgress = computeProgress();

    if (nextProgress.progressPercent <= state.progressPercent) {
      return;
    }

    state.progressPercent = nextProgress.progressPercent;
    state.wordsRead = nextProgress.wordsRead;
    updateProgressUI();
    persistLocalProgress();

    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      void sendProgress();
    }, 700);
  };

  const scrollToProgress = (progressPercent) => {
    const targetTop =
      window.scrollY +
      readerContent.getBoundingClientRect().top +
      readerContent.offsetHeight * (progressPercent / 100) -
      (window.innerHeight || document.documentElement.clientHeight) * 0.18;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  window.addEventListener('scroll', updateFromViewport, { passive: true });
  window.addEventListener('beforeunload', () => {
    void sendProgress(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void sendProgress(true);
    }
  });

  if (resumeReaderButton) {
    resumeReaderButton.addEventListener('click', () => {
      scrollToProgress(state.progressPercent);
    });
  }

  if (jumpTopButton) {
    jumpTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: Math.max(0, window.scrollY + readerContent.getBoundingClientRect().top - 140),
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    });
  }

  updateProgressUI();
  persistLocalProgress();
}
