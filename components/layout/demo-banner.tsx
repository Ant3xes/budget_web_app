import { logout } from "@/app/(auth)/actions";
import { T } from "@/components/i18n/t";

export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 md:px-6">
      <span><T k="common.demo.banner" /></span>
      <form action={logout}>
        <button type="submit" className="min-h-11 underline underline-offset-2"><T k="common.demo.exit" /></button>
      </form>
    </div>
  );
}
