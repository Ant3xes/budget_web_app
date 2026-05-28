import { ImportRulesList } from "@/components/settings/import-rules-list";

export default function ImportRulesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Règles d&apos;import</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Les règles s&apos;appliquent automatiquement lors de l&apos;import CSV, dans l&apos;ordre défini ci-dessous.
        </p>
      </div>
      <ImportRulesList />
    </div>
  );
}
