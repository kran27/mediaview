import { createContext, useContext } from 'react';

const SelectionActionsContext = createContext(null);

const useSelectionActionsContext = () => useContext(SelectionActionsContext);

export { SelectionActionsContext, useSelectionActionsContext };
