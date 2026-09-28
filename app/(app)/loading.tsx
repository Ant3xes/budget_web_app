import { T } from "@/components/i18n/t";

/**
 * Shown instantly while a page of the app area renders on the server, so a
 * click gives feedback right away (and Next can prefetch this shell for dynamic
 * routes). Sized like a typical page (title + KPI row + two cards) to limit
 * layout shift when the real content streams in.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">
        <T k="common.loading" />
      </span>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 rounded-xl bg-muted" />
          <div className="h-72 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
