import React from 'react';
import { IconFolder } from './Icons.jsx';

const TreeNode = ({ node, tree, currentPath, onToggle, onNavigate }) => {
  const isLoaded = Array.isArray(node.children);
  const hasChildren = isLoaded && node.children.length > 0;
  const canExpand = !isLoaded || hasChildren;
  const isActive = node.path === currentPath;
  return (
    <div className={`tree-node ${isActive ? 'active' : ''}`}>
      <div className="tree-node-row">
        {canExpand ? (
          <button
            className={`tree-toggle ${node.expanded ? 'open' : ''}`}
            type="button"
            onClick={() => onToggle(node.path)}
            aria-label={node.expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className="tree-toggle-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <polyline points="6,4 10,8 6,12" />
            </svg>
          </button>
        ) : (
          <span className="tree-toggle placeholder" aria-hidden="true" />
        )}
        <button className="tree-label" type="button" onClick={() => onNavigate(node.path)}>
          <span className="tree-icon">
            <IconFolder />
          </span>
          <span>{node.name || 'Archive'}</span>
        </button>
      </div>
      {node.expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((childPath) => {
            const childNode = tree[childPath];
            if (!childNode) return null;
            return (
              <TreeNode
                key={childPath}
                node={childNode}
                tree={tree}
                currentPath={currentPath}
                onToggle={onToggle}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const TreePanel = ({ tree, currentPath, rootPath, onToggle, onNavigate }) => {
  const rootNode = tree[rootPath];
  if (!rootNode) return null;
  return (
    <div className="panel tree-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Archive</span>
        </div>
      </div>
      <div className="panel-body tree-scroll">
        <TreeNode
          node={rootNode}
          tree={tree}
          currentPath={currentPath}
          onToggle={onToggle}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};

export default TreePanel;
