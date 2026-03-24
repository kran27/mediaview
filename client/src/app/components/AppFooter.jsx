import React from 'react';
import { brandConfig } from '../../config/branding.jsx';

export default function AppFooter() {
  const commitShort = import.meta.env.VITE_APP_COMMIT_SHORT || (import.meta.env.DEV ? 'deadc0d' : '');
  const { links, legalText } = brandConfig.footer;

  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="footer-links">
          {links.map((link, index) => (
            <React.Fragment key={link.url}>
              <a
                href={link.url}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
              >
                {link.label}
              </a>
              {index < links.length - 1 && <span aria-hidden="true">•</span>}
            </React.Fragment>
          ))}
          {commitShort && (
            <>
              <span aria-hidden="true">•</span>
              <span className="footer-build">(build {commitShort})</span>
            </>
          )}
        </div>
      </div>
      <div className="footer-body">
        <p>{legalText}</p>
      </div>
    </footer>
  );
}
