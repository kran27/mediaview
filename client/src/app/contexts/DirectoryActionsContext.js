import { createContext, useContext } from 'react';

const DirectoryActionsContext = createContext(null);

const useDirectoryActionsContext = () => useContext(DirectoryActionsContext);

export { DirectoryActionsContext, useDirectoryActionsContext };
