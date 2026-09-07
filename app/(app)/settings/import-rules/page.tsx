import { ImportRulesList } from "@/components/settings/import-rules-list";
import { T } from "@/components/i18n/t";

export default function ImportRulesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          <T k="importRules.title" />
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          <T k="importRules.description" />
        </p>
      </div>
      <ImportRulesList />
    </div>
  );
}
