import { showToast, showRefreshToast, setLoaderState, showSemesterModal } from './ui';
import { buildNav } from './nav-builder';

// ─── App Init ─────────────────────────────────────────────────────────────────

/**
 * Fetches nav data from the provided URL and kicks off the app.
 * The navJsonUrl is read from the `data-nav-url` attribute on the script tag
 * so that it can be injected from the .env at build time via Astro.
 */
export async function initializeApp(
  navJsonUrl: string,
  navContainer: HTMLElement,
  contentFrame: HTMLIFrameElement,
  loader: HTMLElement
): Promise<void> {
  try {
    const response = await fetch(navJsonUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const navData = await response.json();

    /**
     * Expected structure:
     * { "title": "...", "data": [ { tahunAjaran, semester, data: { dataMapel, dataEkskul } }, ... ] }
     */
    if (!navData || !Array.isArray(navData.data) || navData.data.length === 0) {
      throw new Error('Invalid or empty navigation data received from server.');
    }

    const periodData: any[] = navData.data;

    if (periodData.length === 1) {
      // Only one period available — skip modal
      buildNav(periodData[0], navContainer, loader, contentFrame);
    } else {
      // Multiple periods — show selector modal first
      showSemesterModal(periodData, (selectedEntry) =>
        buildNav(selectedEntry, navContainer, loader, contentFrame)
      );
    }
  } catch (error) {
    navContainer.innerHTML = `<div class="text-red-400 p-4">Error: Failed to load navigation.</div>`;
    console.error('Initialization failed:', error);
    loader.style.display = 'none';
  }
}

// ─── Main bootstrap ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  const navContainer      = document.getElementById('nav-container')       as HTMLElement;
  const contentFrame      = document.getElementById('content-frame')       as HTMLIFrameElement;
  const loader            = document.getElementById('loader')               as HTMLElement;
  const toast             = document.getElementById('toast-notification')   as HTMLElement;
  const refreshToast      = document.getElementById('refresh-toast')        as HTMLElement;
  const refreshToastLink  = document.getElementById('refresh-toast-link')   as HTMLAnchorElement;
  const openInNewTabBtn   = document.getElementById('open-in-new-tab-btn') as HTMLButtonElement;
  const refreshIframeBtn  = document.getElementById('refresh-iframe-btn')  as HTMLButtonElement;
  const breadcrumbBar     = document.getElementById('breadcrumb-bar')      as HTMLElement;
  const breadcrumbText    = document.getElementById('breadcrumb-text')     as HTMLElement;
  const breadcrumbCloseBtn   = document.getElementById('breadcrumb-close-btn')   as HTMLButtonElement;
  const breadcrumbNewTabBtn  = document.getElementById('breadcrumb-new-tab-btn') as HTMLButtonElement;

  // Read the nav JSON URL injected from .env via a <meta> tag
  const navJsonUrl =
    (document.querySelector('meta[name="nav-json-url"]') as HTMLMetaElement)?.content ||
    '/nav.json';

  let currentIframeUrl: string | null = null;
  let currentBreadcrumb: string | null = null;

  // ─── Nav Click Handler ──────────────────────────────────────────────────────

  navContainer.addEventListener('click', function (event) {
    const navLink = (event.target as Element).closest('.nav-link') as HTMLAnchorElement | null;
    if (navLink) {
      event.preventDefault();
      const url = navLink.dataset.url;
      if (url && url !== '#') {
        currentIframeUrl = url;
        currentBreadcrumb = navLink.dataset.path ?? null;

        showToast(toast, `Loading: ${currentBreadcrumb}`);
        setLoaderState(loader, 'loading');
        loader.style.display = 'flex';
        contentFrame.classList.add('hidden');
        breadcrumbBar.classList.add('hidden');

        setTimeout(() => { contentFrame.src = url; }, 100);

        openInNewTabBtn.disabled = true;
        refreshIframeBtn.disabled = true;

        // Temporarily disable group hover to prevent menu staying open after click
        const allGroups = navContainer.querySelectorAll('.group, .group\\/item');
        allGroups.forEach((group) => {
          if (group.classList.contains('group'))      group.classList.replace('group',      'group-disabled-temp');
          if (group.classList.contains('group/item')) group.classList.replace('group/item', 'group-item-disabled-temp');
        });

        setTimeout(() => {
          navContainer.querySelectorAll('.group-disabled-temp, .group-item-disabled-temp').forEach((group) => {
            if (group.classList.contains('group-disabled-temp'))      group.classList.replace('group-disabled-temp',      'group');
            if (group.classList.contains('group-item-disabled-temp')) group.classList.replace('group-item-disabled-temp', 'group/item');
          });
        }, 1000);
      }
    }
  });

  // ─── iFrame Load Handler ────────────────────────────────────────────────────

  contentFrame.addEventListener('load', function () {
    loader.style.display = 'none';
    contentFrame.classList.remove('hidden');
    openInNewTabBtn.disabled = false;
    refreshIframeBtn.disabled = false;

    if (currentBreadcrumb) {
      breadcrumbText.textContent = currentBreadcrumb;
      breadcrumbBar.classList.remove('hidden');
    }
    showRefreshToast(refreshToast);
  });

  // ─── Refresh Logic ──────────────────────────────────────────────────────────

  function refreshContent() {
    if (currentIframeUrl) {
      showToast(toast, 'Refreshing content...');
      contentFrame.src = currentIframeUrl;
    }
  }

  refreshIframeBtn.addEventListener('click', refreshContent);

  refreshToastLink.addEventListener('click', function (e) {
    e.preventDefault();
    refreshContent();
    refreshToast.classList.add('opacity-0');
    setTimeout(() => refreshToast.classList.add('hidden'), 300);
  });

  // ─── Open in New Tab ────────────────────────────────────────────────────────

  openInNewTabBtn.addEventListener('click', function () {
    if (currentIframeUrl) window.open(currentIframeUrl, '_blank');
  });

  breadcrumbNewTabBtn.addEventListener('click', function () {
    if (currentIframeUrl) window.open(currentIframeUrl, '_blank');
  });

  // ─── Breadcrumb Close ───────────────────────────────────────────────────────

  breadcrumbCloseBtn.addEventListener('click', function () {
    breadcrumbBar.classList.add('hidden');
  });

  // ─── Boot ───────────────────────────────────────────────────────────────────
  initializeApp(navJsonUrl, navContainer, contentFrame, loader);
});
