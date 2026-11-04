// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthMessage } from "@/components/auth-message";
import { LocaleProvider } from "@/components/locale-provider";

afterEach(cleanup);

const mount = (message?: string) => render(createElement(LocaleProvider, null, createElement(AuthMessage, { message })));

describe("AuthMessage", () => {
  it.each([
    "Votre compte est bloqué, appelez le 06 00 00 00 00",
    "<img src=x onerror=alert(1)>",
    "constructor",
    "__proto__",
    "toString",
  ])("renders nothing for an unknown ?message= value (%s)", (message) => {
    const { container } = mount(message);
    expect(container.textContent).toBe("");
  });

  it("renders nothing without a message", () => {
    expect(mount(undefined).container.textContent).toBe("");
  });

  it("announces errors with role=alert (WCAG 4.1.3)", () => {
    mount("invalidCredentials");
    expect(screen.getByRole("alert").textContent).toMatch(/invalide/i);
  });

  it("announces the signup confirmation as a polite status", () => {
    mount("signupSuccess");
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
