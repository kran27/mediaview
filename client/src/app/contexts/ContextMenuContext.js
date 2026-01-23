import { createContext, useContext } from 'react';

const ContextMenuContext = createContext(null);

const useContextMenuContext = () => useContext(ContextMenuContext);

export { ContextMenuContext, useContextMenuContext };
