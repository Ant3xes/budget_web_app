import { FixedChargesList } from "@/components/fixed-charges/fixed-charges-list";

export default function FixedChargesPage() {
  return (
    <section className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Charges fixes</h1>
      <FixedChargesList />
    </section>
  );
}
