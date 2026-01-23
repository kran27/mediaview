import { createContext, useContext } from 'react';

const SearchActionsContext = createContext(null);

const useSearchActionsContext = () => useContext(SearchActionsContext);

export { SearchActionsContext, useSearchActionsContext };
