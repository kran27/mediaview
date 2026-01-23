import { createContext, useContext } from 'react';

const DownloadActionsContext = createContext(null);

const useDownloadActionsContext = () => useContext(DownloadActionsContext);

export { DownloadActionsContext, useDownloadActionsContext };
