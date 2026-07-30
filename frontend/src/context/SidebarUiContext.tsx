import { createContext, useContext, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/context/AuthContext";

interface SidebarUiValue {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

const SidebarUiContext = createContext<SidebarUiValue | null>(null);

export function SidebarUiProvider({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  const [expanded, setExpanded] = useState(false);

  return (
    <SidebarUiContext.Provider value={{ expanded, setExpanded }}>
      {authed && (
        <Sidebar expanded={expanded} onExpandedChange={setExpanded} />
      )}
      {children}
    </SidebarUiContext.Provider>
  );
}

export function useSidebarUi() {
  const ctx = useContext(SidebarUiContext);
  if (!ctx) throw new Error("useSidebarUi must be used within SidebarUiProvider");
  return ctx;
}
