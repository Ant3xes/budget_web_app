"use client";

import { createContext, useContext } from "react";

/** CSP nonce of the current request, provided by the root layout (issue 163). */
const NonceContext = createContext<string | undefined>(undefined);

export const NonceProvider = NonceContext.Provider;
export const useNonce = () => useContext(NonceContext);
