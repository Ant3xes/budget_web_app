import { FixedChargesList } from "@/components/fixed-charges/fixed-charges-list";
import { T } from "@/components/i18n/t";

export default function FixedChargesPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">
        <T k="fixedCharges.title" />
      </h1>
      <FixedChargesList />
    </section>
  );
}
