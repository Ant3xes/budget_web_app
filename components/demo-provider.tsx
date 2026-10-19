"use client";

import { createContext, useContext } from "react";

const DemoContext = createContext(false);

/** Presentation only: API checks and RLS remain authoritative (issue 166). */
export function DemoProvider({ isDemo, children }: { isDemo: boolean; children: React.ReactNode }) {
  return <DemoContext.Provider value={isDemo}>{children}</DemoContext.Provider>;
}

export const useDemo = () => useContext(DemoContext);
