import './ViewToggle.css';
import { IconGrid, IconList } from './Icons.jsx';

const ViewToggle = ({ viewMode, onChange, zoomLevel, onZoomChange }) => (
  <div
    className={`view-toggle ${viewMode === 'grid' ? 'mode-grid' : 'mode-list'}`}
    role="group"
    aria-label="View mode"
  >
    <div className={`view-segment ${viewMode === 'grid' ? 'active' : ''}`}>
      <button type="button" className="view-button" onClick={() => onChange('grid')}>
        <span className="view-icon">
          <IconGrid />
        </span>
        <span>Grid</span>
      </button>
      <div className="size-toggle" role="group" aria-label="Grid size">
        <button
          type="button"
          className={zoomLevel === 'sm' ? 'active' : ''}
          onClick={() => onZoomChange('sm')}
          aria-label="Small thumbnails"
          disabled={viewMode !== 'grid'}
        >
          S
        </button>
        <button
          type="button"
          className={zoomLevel === 'md' ? 'active' : ''}
          onClick={() => onZoomChange('md')}
          aria-label="Medium thumbnails"
          disabled={viewMode !== 'grid'}
        >
          M
        </button>
        <button
          type="button"
          className={zoomLevel === 'lg' ? 'active' : ''}
          onClick={() => onZoomChange('lg')}
          aria-label="Large thumbnails"
          disabled={viewMode !== 'grid'}
        >
          L
        </button>
      </div>
    </div>
    <div className={`view-segment ${viewMode === 'list' ? 'active' : ''}`}>
      <button type="button" className="view-button" onClick={() => onChange('list')}>
        <span className="view-icon">
          <IconList />
        </span>
        <span>List</span>
      </button>
    </div>
  </div>
);

export default ViewToggle;
