/**
 * script.js
 * ─────────────────────────────────────────────────────────────────────────
 *  1. Reading progress bar
 *  2. TOC active/past state via IntersectionObserver
 *  3. Photo-slot & text reveal animations via IntersectionObserver
 *  4. Mobile TOC drawer (FAB hamburger)
 *  5. Smooth scroll with fixed-header offset + focus management
 * ─────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── Utilities ────────────────────────────────────────────────────────── */

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Query helper — returns null if not found (no throw). */
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }
  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }


  /* ── 1. Reading Progress Bar ──────────────────────────────────────────── */

  const progressFill = qs('.progress-bar__fill');
  const progressBar  = qs('.progress-bar');
  const article      = qs('article');

  function updateProgress() {
    if (!progressFill || !article) return;

    const articleTop    = article.getBoundingClientRect().top + window.scrollY;
    const articleBottom = articleTop + article.offsetHeight;
    const viewH         = window.innerHeight;

    // Progress from when article enters top of viewport to when it leaves bottom
    const scrolled   = window.scrollY + viewH - articleTop;
    const total      = articleBottom - articleTop;
    const pct        = Math.min(Math.max(scrolled / total, 0), 1);
    const percentage = Math.round(pct * 100);

    progressFill.style.width = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();


  /* ── 2. TOC active / past state ───────────────────────────────────────── */

  const sections     = qsa('.content-section[id]');
  const tocLinks     = qsa('.toc-link[data-section]');     // sidebar + tablet
  const drawerLinks  = qsa('.toc-drawer__link[data-target]'); // mobile drawer

  /** Maps section id → NodeList of matching TOC anchors (across variants). */
  function buildLinkMap() {
    const map = new Map();
    sections.forEach(function (sec) {
      const links = [];
      tocLinks.forEach(function (a) {
        if (a.dataset.section === sec.id) links.push(a);
      });
      drawerLinks.forEach(function (a) {
        if (a.dataset.target === sec.id) links.push(a);
      });
      map.set(sec.id, links);
    });
    return map;
  }

  const linkMap  = buildLinkMap();
  const sectionOrder = sections.map(function (s) { return s.id; });

  /* ── Mascot elements ── */
  const mascotImages = qsa('.section-mascot__img');

  /* ── Section background colors map ── */
  const sectionBgColors = {
    'section-intro': 'var(--clr-intro-bg)',
    'section-history': 'var(--clr-history-bg)',
    'section-impacts': 'var(--clr-impacts-bg)',
    'section-social-good': 'var(--clr-social-bg)'
  };

  /** Update which mascot is visible based on active section */
  function updateMascot(activeSectionId) {
    mascotImages.forEach(function (img) {
      if (img.dataset.section === activeSectionId) {
        if (!img.classList.contains('is-visible')) {
          img.classList.add('is-visible');
        }
      } else {
        img.classList.remove('is-visible');
      }
    });
  }

  /** Check if we're in the video section or footer for Mew mascot */
  function checkVideoAndFooterMascot() {
    var videoSection = qs('#section-video');
    var footer = qs('.site-footer');
    
    if (!videoSection && !footer) return;
    
    var windowBottom = window.scrollY + window.innerHeight;
    var inVideoOrFooter = false;
    
    // Check if video section is in view
    if (videoSection) {
      var videoTop = videoSection.getBoundingClientRect().top + window.scrollY;
      var videoBottom = videoTop + videoSection.offsetHeight;
      if (windowBottom >= videoTop + (window.innerHeight * 0.15) && window.scrollY < videoBottom) {
        inVideoOrFooter = true;
        updateMascot('section-video');
      }
    }
    
    // Check if footer is in view (takes priority)
    if (footer && !inVideoOrFooter) {
      var footerTop = footer.getBoundingClientRect().top + window.scrollY;
      if (windowBottom >= footerTop + 50) {
        inVideoOrFooter = true;
        updateMascot('footer');
      }
    }
    
    return inVideoOrFooter;
  }

  /** Update body background color to match active section */
  function updateBodyBackground(activeSectionId) {
    var bgColor = sectionBgColors[activeSectionId];
    if (bgColor) {
      document.body.style.backgroundColor = bgColor;
    } else {
      document.body.style.backgroundColor = '';
    }
  }

  /** Check if we're in the splash section and toggle body class */
  function checkSplashState() {
    var splash = qs('#splash');
    if (!splash) return;
    
    var splashBottom = splash.getBoundingClientRect().bottom;
    // Trigger earlier - when splash bottom is at 90% of viewport height
    if (splashBottom <= window.innerHeight * 0.9) {
      document.body.classList.remove('in-splash');
    } else {
      document.body.classList.add('in-splash');
      // Reset body background when in splash
      document.body.style.backgroundColor = 'var(--clr-splash-bg)';
    }
  }

  /** Set active section — also marks all earlier ones as "past". */
  function setActive(activeSectionId, skipMascotUpdate) {
    let passed = true; // sections before active are "past"
    sectionOrder.forEach(function (id) {
      const links = linkMap.get(id) || [];
      if (id === activeSectionId) {
        passed = false; // the active one
        links.forEach(function (a) {
          a.classList.remove('is-past');
          a.classList.add('is-active');
        });
      } else if (passed) {
        links.forEach(function (a) {
          a.classList.remove('is-active');
          a.classList.add('is-past');
        });
      } else {
        links.forEach(function (a) {
          a.classList.remove('is-active', 'is-past');
        });
      }
    });
    
    // Update mascot to match active section (unless we're showing Mew)
    if (!skipMascotUpdate) {
      updateMascot(activeSectionId);
    }
    
    // Update body background to match active section
    updateBodyBackground(activeSectionId);
    
    // Update body class to match active section for TOC colors
    sectionOrder.forEach(function (id) {
      document.body.classList.remove('in-' + id);
    });
    document.body.classList.add('in-' + activeSectionId);
  }

  if (sections.length > 0) {

    /**
     * Find the active section by checking which one's top edge has most
     * recently entered the viewport. Triggers early so background color
     * is ready before the section header appears.
     */
    function getActiveSectionId() {
      // Trigger when section top reaches 85% down viewport (near bottom)
      const trigger = window.scrollY + window.innerHeight * 0.85;
      let activeId  = sections[0].id; // default to first section

      sections.forEach(function (sec) {
        const top = sec.getBoundingClientRect().top + window.scrollY;
        if (top <= trigger) activeId = sec.id;
      });

      return activeId;
    }

    function onScroll() {
      // First check if we're in video section or footer for Mew mascot
      var inVideoOrFooter = checkVideoAndFooterMascot();
      
      // Then update the active section (which won't override Mew if we're in video/footer)
      var activeId = getActiveSectionId();
      setActive(activeId, inVideoOrFooter);
      checkSplashState();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // set correct state immediately on page load
    checkSplashState(); // check splash state on load
  }


  /* ── 3. Reveal animations (photo curtain + text fade) ─────────────────── */

  const revealFigures = qsa('.reveal-figure');
  const revealTexts   = qsa('.reveal-text');

  if (reducedMotion) {
    // Instantly show everything — respect user preference
    revealFigures.forEach(function (el) { el.classList.add('is-revealed'); });
    revealTexts.forEach(function (el)   { el.classList.add('is-revealed'); });

  } else if ('IntersectionObserver' in window) {

    /** Generic reveal observer — adds .is-revealed once, then unobserves. */
    function makeRevealObserver(threshold, delay) {
      return new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (delay) {
            setTimeout(function () { el.classList.add('is-revealed'); }, delay);
          } else {
            el.classList.add('is-revealed');
          }
          obs.unobserve(el);
        });
      }, { threshold: threshold || 0.15 });
    }

    var figureObs = makeRevealObserver(0.1, 0);    // figures reveal first
    var textObs   = makeRevealObserver(0.15, 160); // text slightly after

    revealFigures.forEach(function (el) { figureObs.observe(el); });
    revealTexts.forEach(function (el)   { textObs.observe(el);   });
  }


  /* ── 4. Mobile drawer (FAB hamburger) ─────────────────────────────────── */

  const fab      = qs('#toc-fab');
  const drawer   = qs('#toc-drawer');
  const backdrop = qs('#toc-backdrop');

  function openDrawer() {
    if (!fab || !drawer || !backdrop) return;
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-label', 'Close table of contents');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    // Prevent body scroll while drawer is open
    document.body.style.overflow = 'hidden';
    // Focus first link inside drawer
    var firstLink = qs('.toc-drawer__link', drawer);
    if (firstLink) {
      setTimeout(function () { firstLink.focus(); }, 50);
    }
  }

  function closeDrawer() {
    if (!fab || !drawer || !backdrop) return;
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', 'Open table of contents');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (fab) {
    fab.addEventListener('click', function () {
      var isOpen = fab.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeDrawer(); else openDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', function () { closeDrawer(); });
  }

  // Close drawer when a nav link inside it is clicked
  drawerLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      closeDrawer();
      // Small delay so the drawer closes before scroll adjusts
      setTimeout(function () { fab && fab.focus(); }, 400);
    });
  });

  // Close drawer on Escape (WCAG 2.1 — Keyboard Accessible)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
      closeDrawer();
      fab && fab.focus();
    }
  });

  // Close drawer if viewport resizes above mobile breakpoint
  window.addEventListener('resize', function () {
    if (window.innerWidth > 640 && drawer && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  }, { passive: true });

  // Also sync drawer link active states with section observer
  var origSetActive = setActive;
  setActive = function (id) {
    origSetActive(id);
    drawerLinks.forEach(function (a) {
      if (a.dataset.target === id) {
        a.classList.add('is-active');
      } else {
        a.classList.remove('is-active');
      }
    });
  };


  /* ── 5. Smooth scroll with offset + focus management ─────────────────── */

  /**
   * Returns the height of the sticky TOC bar (tablet) or 0 (desktop/mobile).
   * Used to offset scroll targets so they aren't hidden behind the sticky bar.
   */
  function getStickyOffset() {
    var toc = qs('.toc');
    if (!toc) return 0;
    var styles = window.getComputedStyle(toc);
    if (styles.position === 'sticky') {
      return toc.offsetHeight || 0;
    }
    return 0;
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = anchor.getAttribute('href').slice(1);
      if (!targetId) return;

      var target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();

      var offset   = getStickyOffset() + 24; // 24px extra breathing room
      var targetY  = target.getBoundingClientRect().top + window.scrollY - offset;

      if (reducedMotion) {
        window.scrollTo(0, Math.max(0, targetY));
      } else {
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }

      // Move keyboard focus to the target section (WCAG 2.4.3)
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', function () {
        target.removeAttribute('tabindex');
      }, { once: true });
    });
  });

  // Header scroll shadow — TOC bar gets shadow when content scrolls under it
  var tocEl = qs('.toc');
  if (tocEl) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        tocEl.classList.add('is-scrolled');
      } else {
        tocEl.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

})();
