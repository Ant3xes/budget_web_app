// issue 121 — rows read per /analytics tab, before vs after, on a SYNTHETIC
// dataset (deterministic PRNG, no real data). Counts the rows each query
// returns to Node; it does NOT time anything (no database available here).
// Usage: node scripts/analytics-rows-model.mjs [years] [accounts] [txPerAccountPerMonth]
const years = Number(process.argv[2] ?? 5);
const nAccounts = Number(process.argv[3] ?? 4);
const perMonth = Number(process.argv[4] ?? 60);

let seed = 121;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const now = new Date(Date.UTC(2026, 9, 15));
const today = now.toISOString().slice(0, 10);
const months = years * 12;
const kinds = ["expense", "expense", "expense", "expense", "income", "transfer_debit", "transfer_credit"];
const txs = [];
for (let a = 0; a < nAccounts; a++)
  for (let m = 0; m < months; m++) {
    const d0 = new Date(Date.UTC(2026, 9 - m, 1));
    for (let i = 0; i < perMonth; i++) {
      const day = 1 + Math.floor(rnd() * 28);
      const date = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), day)).toISOString().slice(0, 10);
      if (date > today) continue;
      txs.push({ account: a, date, kind: kinds[Math.floor(rnd() * kinds.length)], cat: Math.floor(rnd() * 20) });
    }
  }
const month = (d) => d.slice(0, 7);
const from = (months) => new Date(Date.UTC(2026, 9 - (months - 1), 1)).toISOString().slice(0, 10);
const inWin = (t, f, kindsOk) => t.date >= f && t.date <= today && (!kindsOk || kindsOk.includes(t.kind));
const count = (f, kindsOk) => txs.filter((t) => inWin(t, f, kindsOk)).length;
const distinct = (fn) => new Set(txs.map(fn)).size;
const monthly = distinct((t) => `${t.account}|${month(t.date)}`);
const linked = txs.filter((t) => t.cat < 3); // 3 goals linked to categories
const goalMonthly = new Set(linked.map((t) => `${t.cat}|${month(t.date)}`)).size;

const periods = { "1m": 1, "6m": 6, "1a": 12, tout: months };
const rows = {};
for (const [p, n] of Object.entries(periods)) {
  const f = p === "tout" ? "0000-01-01" : from(n);
  const yoyFrom = p === "tout" ? "0000-01-01" : from(n + 12);
  const yearStart = "2026-01-01";
  rows[p] = {
    overview: { before: txs.length + count(f, ["expense", "income"]) + count(f, ["transfer_debit"]), after: monthly + count(f, ["expense", "income"]) + count(f, ["transfer_debit"]) },
    categories: { before: count(f, ["expense"]) + count(yearStart, ["expense"]), after: count(f, ["expense"]) + count(yearStart, ["expense"]) },
    accounts: { before: txs.length, after: nAccounts },
    transactions: { before: count(f, ["expense"]), after: count(f, ["expense"]) },
    comparisons: { before: count(yoyFrom, ["expense", "income"]) + linked.length, after: count(yoyFrom, ["expense", "income"]) + goalMonthly },
  };
}
console.log(`synthetic dataset: ${txs.length} transactions, ${nAccounts} accounts, ${years} years`);
console.log("rows returned to Node per tab (before -> after); PostgREST max_rows=1000 caps each real response");
console.log("period | tab | before | after");
for (const [p, tabs] of Object.entries(rows))
  for (const [tab, r] of Object.entries(tabs)) console.log(`${p.padEnd(5)} | ${tab.padEnd(12)} | ${String(r.before).padStart(7)} | ${String(r.after).padStart(6)}`);
