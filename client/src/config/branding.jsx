import React from 'react';
import { brandData } from './brandingData.js';

export { brandData };

/**
 * Brand-mark SVG component that fetches the SVG from the configured URL.
 * Using a fetch-based component allows the SVG to be rendered inline,
 * ensuring that CSS styling (like .brand-mark-path) still works.
 */
const BrandMarkFetcher = (props) => {
  const [svgContent, setSvgContent] = React.useState('');

  React.useEffect(() => {
    fetch(brandData.brandMarkUrl)
      .then(response => response.text())
      .then(text => {
        // Strip out the wrapping <svg> tag if we want to inject it better,
        // but for now we'll just inject the whole thing.
        setSvgContent(text);
      })
      .catch(err => console.error("Failed to load brand mark:", err));
  }, []);

  if (!svgContent) return <div className={props.className} style={{ width: 25, height: 25 }} />;

  return (
    <span
      className={props.className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};

/**
 * Full branding configuration including React components.
 */
export const brandConfig = {
  ...brandData,

  // Brand-mark SVG component
  brandMark: BrandMarkFetcher
};
