import { createContext, useContext } from 'react';

const DownloadStateContext = createContext(null);

const useDownloadStateContext = () => useContext(DownloadStateContext);

export { DownloadStateContext, useDownloadStateContext };
