import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { getBasename } from '../../lib/format.js';

const initialTree = {
  '': { path: '', name: 'Archive', expanded: true, children: null }
};

export const useDirectoryTree = () => {
  const [tree, setTree] = useState(initialTree);
  const treeHydratedRef = useRef(false);
  const treePrefetchingRef = useRef(true);
  const treeFetchRef = useRef(null);

  const applyTreeNodes = useCallback((nodes) => {
    if (!nodes) return;
    setTree((prev) => {
      const next = { ...prev };
      Object.values(nodes).forEach((node) => {
        if (!node) return;
        const prevNode = next[node.path];
        next[node.path] = {
          path: node.path,
          name: node.name || prevNode?.name || (node.path ? getBasename(node.path) : 'Archive'),
          children: Array.isArray(node.children) ? node.children : [],
          expanded: prevNode?.expanded ?? node.path === ''
        };
      });
      return next;
    });
  }, []);

  const updateTreeWithEntries = useCallback((pathValue, entries, options = {}) => {
    const { expand = false, rootLabel } = options;
    setTree((prev) => {
      const next = { ...prev };
      const nodeName = pathValue ? getBasename(pathValue) : rootLabel || prev['']?.name || 'Archive';
      const children = entries.filter((entry) => entry.isDir).map((entry) => entry.path);
      next[pathValue] = {
        path: pathValue,
        name: nodeName,
        expanded: expand ? true : next[pathValue]?.expanded ?? false,
        children
      };
      entries
        .filter((entry) => entry.isDir)
        .forEach((entry) => {
          if (!next[entry.path]) {
            next[entry.path] = {
              path: entry.path,
              name: entry.name,
              expanded: false,
              children: null
            };
          }
        });
      return next;
    });
  }, []);

  const expandAncestors = useCallback((pathValue, rootLabel) => {
    setTree((prev) => {
      const next = { ...prev };
      const resolvedRootLabel = rootLabel || prev['']?.name || 'Archive';
      next[''] = { ...(next[''] || {}), path: '', name: resolvedRootLabel, expanded: true };
      if (!pathValue) return next;
      const segments = pathValue.split('/').filter(Boolean);
      let parentPath = '';
      segments.forEach((segment) => {
        const current = parentPath ? `${parentPath}/${segment}` : segment;
        const parentNode = next[parentPath] || {
          path: parentPath,
          name: parentPath ? getBasename(parentPath) : resolvedRootLabel,
          expanded: true,
          children: []
        };
        const children = Array.isArray(parentNode.children) ? [...parentNode.children] : [];
        if (!children.includes(current)) {
          children.push(current);
        }
        next[parentPath] = { ...parentNode, children, expanded: true };
        next[current] = {
          ...(next[current] || {}),
          path: current,
          name: segment,
          expanded: true
        };
        parentPath = current;
      });
      return next;
    });
  }, []);

  const toggleNode = useCallback((pathValue) => {
    setTree((prev) => ({
      ...prev,
      [pathValue]: {
        ...prev[pathValue],
        expanded: !prev[pathValue]?.expanded
      }
    }));
  }, []);

  const collapseAll = useCallback(() => {
    setTree((prev) => {
      const next = {};
      Object.values(prev).forEach((node) => {
        if (!node) return;
        const isRoot = node.path === '';
        next[node.path] = { ...node, expanded: isRoot };
      });
      return next;
    });
  }, []);

  const fetchTree = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/tree`);
    if (!response.ok) {
      throw new Error('Failed to load tree');
    }
    return response.json();
  }, []);

  useEffect(() => {
    let isActive = true;
    if (!treeFetchRef.current) {
      treePrefetchingRef.current = true;
      treeFetchRef.current = fetchTree();
    }
    treeFetchRef.current
      .then((data) => {
        if (!isActive) return;
        applyTreeNodes(data?.nodes);
        treeHydratedRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        if (!isActive) return;
        treePrefetchingRef.current = false;
      });
    return () => {
      isActive = false;
    };
  }, [applyTreeNodes, fetchTree]);

  return {
    tree,
    treeHydratedRef,
    treePrefetchingRef,
    updateTreeWithEntries,
    expandAncestors,
    toggleNode,
    collapseAll
  };
};
