import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
vi.mock("@base-ui/react/alert-dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: { Root: Container, Portal: Container, Backdrop: Container, Popup: Container, Title: Container, Description: Container } };
});
import { DemoProvider } from "@/components/demo-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";

it("disables destructive confirmation in demo mode with a clear explanation", () => {
  const render = (isDemo: boolean) => renderToStaticMarkup(
    <LocaleProvider><DemoProvider isDemo={isDemo}>
      <AlertDialog open title="Delete" onOpenChange={() => {}} onConfirm={() => {}} />
    </DemoProvider></LocaleProvider>,
  );
  expect(render(true)).toContain('disabled=""');
  expect(render(true)).toContain("Compte demo en lecture seule");
  expect(render(false)).not.toContain('disabled=""');
});
