import { createContext, useContext } from 'react';

const DirectoryDataContext = createContext(null);

const useDirectoryDataContext = () => useContext(DirectoryDataContext);

export { DirectoryDataContext, useDirectoryDataContext };
