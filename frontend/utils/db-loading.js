let activeDbLoadCount = 0;

function getGlobalLoadingInfo() {
  const element = document.getElementById('globalLoadingInfo');
  return element instanceof Element ? element : null;
}

function normalizeElements(elements) {
  return (Array.isArray(elements) ? elements : [elements]).filter(
    (element) => element instanceof Element
  );
}

function syncGlobalCursor() {
  document.body.classList.toggle('db-loading', activeDbLoadCount > 0);
}

export function beginDbLoading(elements = []) {
  const targets = normalizeElements(elements);
  const globalLoadingInfo = getGlobalLoadingInfo();
  activeDbLoadCount += 1;
  syncGlobalCursor();

  if (globalLoadingInfo) {
    globalLoadingInfo.textContent = 'Loading data...';
    globalLoadingInfo.classList.add('is-loading-from-db');
    globalLoadingInfo.setAttribute('aria-busy', 'true');
  }

  targets.forEach((element) => {
    element.classList.add('is-loading-from-db');
    element.setAttribute('aria-busy', 'true');
  });

  let finished = false;

  return () => {
    if (finished) {
      return;
    }

    finished = true;
    activeDbLoadCount = Math.max(0, activeDbLoadCount - 1);
    syncGlobalCursor();

    if (globalLoadingInfo && activeDbLoadCount === 0) {
      globalLoadingInfo.textContent = '';
      globalLoadingInfo.classList.remove('is-loading-from-db');
      globalLoadingInfo.removeAttribute('aria-busy');
    }

    targets.forEach((element) => {
      element.classList.remove('is-loading-from-db');
      element.removeAttribute('aria-busy');
    });
  };
}