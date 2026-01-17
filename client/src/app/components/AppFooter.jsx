import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'mediaview:theme';

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
  } catch {
    return 'auto';
  }
};

const applyTheme = (value) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = value;
};

export default function AppFooter() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window === 'undefined') return;
    try {
      if (theme === 'auto') {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage write failures.
    }
  }, [theme]);

  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="footer-links">
          <a href="https://www.mirrorsedgearchive.org/">The Mirror&apos;s Edge Archive Homepage</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/terms-of-use.html">Terms of use</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/privacy-policy.html">Privacy &amp; cookies</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/takedown.html">DMCA</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/out/?t=https://www.reddit.com/r/mirrorsedge/" target="_blank" rel="noreferrer">/r/mirrorsedge</a>
          <span aria-hidden="true">•</span>
          <a href="https://github.com/mirrorsedgearchive/mediaview" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <label className="footer-theme">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            aria-label="Theme"
          >
            <option value="auto">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <div className="footer-body">
        <p>
          Contents in this archive may be protected by applicable copyright laws. The inclusion does not imply that we represent these contents as our intellectual property.
          Applicable copyright and/or licensing terms should be considered before using, distributing or adapting any potentially copyrighted content. 
          All rights remain with the original owners. This non-profit, open-source project is for entertainment purposes only and not affiliated with EA Digital Illusions CE, Electronic Arts or the Mirror&apos;s Edge franchise. 
          Mirror&apos;s Edge is a registered trademark of EA Digital Illusions CE. All trademarks and registered trademarks belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}
