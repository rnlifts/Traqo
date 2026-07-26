import React, { useState } from "react";
import type { ReactNode } from "react";

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

export const UnsavedChangesContext = React.createContext<
  UnsavedChangesContextType | undefined
>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = (): UnsavedChangesContextType => {
  const context = React.useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error(
      "useUnsavedChanges must be used within UnsavedChangesProvider"
    );
  }
  return context;
};
