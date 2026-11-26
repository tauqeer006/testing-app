(function () {
  // CRUCIAL: Do not report beacons if running in automation / RectificationAgent
  if (window.__RUM_DISABLED || navigator.webdriver) return;
  if (/bot|crawl|spider|RectificationAgent/i.test(navigator.userAgent)) return;

  let lcpMs = 0;
  let fcpMs = 0;
  let longTaskTotalMs = 0;

  // Observe Largest Contentful Paint (LCP)
  if (window.PerformanceObserver) {
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          lcpMs = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Observe First Contentful Paint (FCP)
      const paintObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            fcpMs = entry.startTime;
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });

      // Observe Long Tasks (>50ms)
      const taskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          longTaskTotalMs += entry.duration;
        }
      });
      taskObserver.observe({ type: 'longtask', buffered: true });
    } catch (e) {
      // Graceful fallback if observer types are unsupported
    }
  }

  // Send beacon after page load completes and stabilizes
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navEntries = performance.getEntriesByType('navigation');
      const nav = navEntries.length > 0 ? navEntries[0] : null;
      if (!nav) return;

      // Extract image metrics
      const images = Array.from(document.images).slice(0, 50).map((img) => {
        const rect = img.getBoundingClientRect();
        const topPx = rect.top + window.scrollY;
        return {
          src: img.getAttribute('src') || '',
          loadingAttr: img.getAttribute('loading') || 'eager',
          naturalWidth: img.naturalWidth || 0,
          renderedWidth: img.clientWidth || 0,
          top: Math.round(topPx),
          aboveFold: topPx < window.innerHeight,
        };
      });

      // Extract script tags
      const scripts = Array.from(document.querySelectorAll('script[src]')).slice(0, 50).map((s) => ({
        src: s.getAttribute('src') || '',
        inHead: s.parentElement && s.parentElement.tagName.toLowerCase() === 'head',
        hasDefer: s.hasAttribute('defer'),
        hasAsync: s.hasAttribute('async'),
        isModule: s.getAttribute('type') === 'module',
      }));

      // Extract resource metrics
      const resources = performance.getEntriesByType('resource').slice(0, 100).map((r) => ({
        name: r.name,
        type: r.initiatorType,
        transferSize: r.transferSize || 0,
        encodedBodySize: r.encodedBodySize || 0,
        decodedBodySize: r.decodedBodySize || 0,
        durationMs: Math.round(r.duration),
        startMs: Math.round(r.startTime),
      }));

      const beaconData = {
        path: window.location.pathname || '/',
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadMs: Math.round(nav.loadEventEnd - nav.startTime),
        fcpMs: Math.round(fcpMs),
        lcpMs: Math.round(lcpMs || nav.loadEventEnd - nav.startTime),
        longTaskTotalMs: Math.round(longTaskTotalMs),
        effectiveType: (navigator.connection && navigator.connection.effectiveType) || '4g',
        deviceMemory: navigator.deviceMemory || 4,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        resources: resources,
        images: images,
        scripts: scripts,
      };

      const beaconPayload = JSON.stringify(beaconData);
      const targetUrl = '/debug/rum';

      if (navigator.sendBeacon) {
        const blob = new Blob([beaconPayload], { type: 'application/json' });
        navigator.sendBeacon(targetUrl, blob);
      } else {
        fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: beaconPayload,
          keepalive: true,
        }).catch(() => {});
      }
    }, 1000);
  });
})();
