import { createContext, useContext, useState, ReactNode } from 'react';

interface GlobalContextType {
    isLogged: boolean;
    logIn: () => void;
    logOut: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

interface GlobalProviderProps {
    children: ReactNode;
  }

export const CustomGlobal = ({ children }: GlobalProviderProps) => {
  const [isLogged, setIsLogged] = useState(false);

  const logIn = (fn: boolean) => {
    setIsLogged(true);
  };

  const logOut = (fn: boolean) => {
    setIsLogged(false);
  };
  
  return (
    <GlobalContext.Provider value={{
        isLogged,
        logIn,
        logOut
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = (): GlobalContextType => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};

export default CustomGlobal;
