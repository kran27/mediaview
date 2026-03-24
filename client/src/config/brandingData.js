/**
 * Raw branding data (strings and links).
 * This part is imported by vite.config.js for HTML transformation.
 */
export const brandData = {
  // Main application name (used in page title and metadata)
  appName: "The Mirror's Edge Archive",

  // Main application description (used in metadata)
  appDescription: "Browse the Mirror's Edge Archive",

  // Brand title used in the header (split into main and highlight parts)
  brandTitle: {
    main: "The Mirror's Edge",
    highlight: "Archive"
  },

  // Footer configuration
  footer: {
    links: [
      { label: "The Mirror's Edge Archive Homepage", url: "https://www.mirrorsedgearchive.org/" },
      { label: "/r/mirrorsedge", url: "https://www.reddit.com/r/mirrorsedge/", external: true },
      { label: "GitHub", url: "https://github.com/mirrorsedgearchive/mediaview", external: true },
      { label: "Terms of use", url: "https://www.mirrorsedgearchive.org/legal/terms-of-use.html" },
      { label: "Privacy & cookies", url: "https://www.mirrorsedgearchive.org/legal/privacy-policy.html" },
      { label: "DMCA", url: "https://www.mirrorsedgearchive.org/legal/takedown.html" }
    ],
    legalText: `Contents in this archive may be protected by applicable copyright laws. The inclusion does not imply that we represent these contents as our intellectual property.
      Applicable copyright and/or licensing terms should be considered before using, distributing or adapting any potentially copyrighted content.
      All rights remain with the original owners. This non-profit, open-source project is for entertainment purposes only and not affiliated with EA Digital Illusions CE, Electronic Arts or the Mirror's Edge franchise.
      Mirror's Edge is a registered trademark of EA Digital Illusions CE. All trademarks and registered trademarks belong to their respective owners.`
  },

  // Search labels
  search: {
    placeholder: "Search the archive",
    labelFull: "Search the archive",
    labelShort: "Search"
  },

  // Breadcrumb/Path labels
  paths: {
    rootName: "Archive",
    rootAriaLabel: "Go to archive root"
  },

  // Metadata for index.html noscript
  noscriptMessage: "Please disable any script-blocking extensions and enable JavaScript in your browser settings.",

  /**
   * Path to the brand-mark SVG (relative to public directory).
   */
  brandMarkUrl: "/brand-mark.svg"
};
