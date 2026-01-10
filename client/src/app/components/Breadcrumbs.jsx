import React from 'react';
import '../../styles/components/navigation.css';

const Breadcrumbs = ({ rootLabel, path, onNavigate }) => {
  const segments = path ? path.split('/') : [];
  return (
    <div className="breadcrumbs">
      <button className="crumb" type="button" onClick={() => onNavigate('')}>
        {rootLabel}
      </button>
      {segments.map((segment, index) => {
        const crumbPath = segments.slice(0, index + 1).join('/');
        return (
          <span className="crumb-segment" key={crumbPath}>
            <span className="crumb-separator">/</span>
            <button className="crumb" type="button" onClick={() => onNavigate(crumbPath)}>
              {segment}
            </button>
          </span>
        );
      })}
    </div>
  );
};

export default Breadcrumbs;
