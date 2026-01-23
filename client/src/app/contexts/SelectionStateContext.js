import { createContext, useContext } from 'react';

const SelectionStateContext = createContext(null);

const useSelectionStateContext = () => useContext(SelectionStateContext);

export { SelectionStateContext, useSelectionStateContext };
