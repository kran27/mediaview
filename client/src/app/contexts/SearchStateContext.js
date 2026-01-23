import { createContext, useContext } from 'react';

const SearchStateContext = createContext(null);

const useSearchStateContext = () => useContext(SearchStateContext);

export { SearchStateContext, useSearchStateContext };
