export function applyTypographyConfig(runtimeConfig) {
  const typography = runtimeConfig && runtimeConfig.typography ? runtimeConfig.typography : {};

  if (Array.isArray(typography.preconnectUrls)) {
    typography.preconnectUrls.forEach((url) => {
      if (!url || document.head.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      if (url.includes('gstatic')) {
        link.crossOrigin = '';
      }
      document.head.appendChild(link);
    });
  }

  if (typography.stylesheetUrl && !document.head.querySelector(`link[rel="stylesheet"][href="${typography.stylesheetUrl}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = typography.stylesheetUrl;
    document.head.appendChild(stylesheet);
  }

  if (typography.primaryFont) {
    document.documentElement.style.setProperty('--font-primary', typography.primaryFont);
  }
  if (typography.monoFont) {
    document.documentElement.style.setProperty('--font-mono', typography.monoFont);
  }
  if (typography.columnHeaderFont) {
    document.documentElement.style.setProperty('--font-column-header', typography.columnHeaderFont);
  }
}
