import { useEffect, useRef } from 'react';
import '../../styles/components/navigation.css';

const Breadcrumbs = ({ path, onNavigate }) => {
  const scrollRef = useRef(null);
  const segments = path ? path.split('/') : [];

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const updateFade = () => {
      const maxScroll = node.scrollWidth - node.clientWidth;
      const hasOverflow = maxScroll > 1;
      const atStart = node.scrollLeft <= 1;
      const atEnd = node.scrollLeft >= maxScroll - 1;
      node.classList.toggle('has-overflow', hasOverflow);
      node.classList.toggle('fade-left', hasOverflow && !atStart);
      node.classList.toggle('fade-right', hasOverflow && !atEnd);
    };
    node.scrollLeft = node.scrollWidth;
    updateFade();
    const handleResize = () => updateFade();
    const handleScroll = () => updateFade();
    window.addEventListener('resize', handleResize);
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      node.removeEventListener('scroll', handleScroll);
    };
  }, [path]);

  const isRootCurrent = !path;

  return (
    <div className="breadcrumbs-scroll" ref={scrollRef}>
      <div className="breadcrumbs">
        <button
          className={`crumb is-home ${isRootCurrent ? 'current' : ''}`}
          type="button"
          onClick={() => onNavigate('')}
          aria-label="Home"
        >
          <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
            <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
          </svg>
          <span className="crumb-label">Home</span>
        </button>
        {segments.map((segment, index) => {
          const crumbPath = segments.slice(0, index + 1).join('/');
          const isCurrent = index === segments.length - 1;
          return (
            <span className="crumb-segment" key={crumbPath}>
              <span className="crumb-separator">/</span>
              <button
                className={`crumb ${isCurrent ? 'current' : ''}`}
                type="button"
                onClick={() => onNavigate(crumbPath)}
              >
                {segment}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default Breadcrumbs;
