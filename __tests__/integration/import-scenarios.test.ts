/**
 * Scénarios d'import multi-fichiers / multi-banques.
 *
 * Ces tests font tourner les VRAIES routes /api/import/preview et
 * /api/import/confirm, les vrais parseurs (N26 CSV, BNP XLS) et la vraie
 * déduplication, contre une fausse base Supabase en mémoire. Seules les règles
 * de catégorisation sont neutralisées.
 *
 * Convention :
 *  - `it(...)`       : comportement actuel qui doit rester vrai (non-régression).
 *  - `it.fails(...)` : comportement SOUHAITÉ mais aujourd'hui en défaut (bug connu ;
 *                      il n'y en a plus pour l'instant — les 8 bugs identifiés sont corrigés).
 *                      Le test décrit le bon comportement ; il est "vert" tant que
 *                      le bug existe et devient ROUGE quand il est corrigé → retirer
 *                      alors le `.fails` pour en faire une vraie non-régression.
 */
import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
// Catégorisation neutralisée ; detectTransfer reste réel.
vi.mock("@/lib/import/apply-rules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import/apply-rules")>();
  return {
    ...actual,
    buildRuleMatcher: vi.fn().mockResolvedValue(() => null),
    buildRuleShareMatcher: vi.fn().mockResolvedValue(() => null),
    buildHistoryMatcher: vi.fn().mockResolvedValue(() => null),
    buildDefaultMatcher: vi.fn().mockReturnValue(() => null),
  };
});

import { POST as confirmPOST } from "@/app/api/import/confirm/route";
import { POST as previewPOST } from "@/app/api/import/preview/route";
import { buildRuleShareMatcher, detectTransfer } from "@/lib/import/apply-rules";
import { parseBnpXls } from "@/lib/import/parse-bnp";
import { parseN26Csv } from "@/lib/import/parse-n26";
import { withSpace } from "@/lib/spaces/with-space";

// ---------------------------------------------------------------------------
// Fausse base Supabase en mémoire (uniquement ce que les routes d'import utilisent)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const USER_ID = "user-test-id";
const SPACE_ID = "space-test-id";
const BNP_ACCOUNT = "00000000-0000-4000-8000-0000000000b1";
const N26_ACCOUNT = "00000000-0000-4000-8000-0000000000c2";
const SHARED_SPACE = "00000000-0000-4000-8000-0000000000d3";
const PARTNER_ID = "user-partner-id";

class FakeDb {
  transactions: Row[] = [];
  /** Comptes de l'espace actif : l'import vérifie que les comptes ciblés y appartiennent. */
  accounts: Row[] = [BNP_ACCOUNT, N26_ACCOUNT].map((id) => ({ id, space_id: SPACE_ID, deleted_at: null }));
  /** PostgREST plafonne à 1000 lignes par requête (max-rows) ; null = pas de plafond. */
  maxRows: number | null = 1000;

  /** Dépenses partagées créées par import_transactions. */
  sharedExpenses: Row[] = [];
  spaces: Row[] = [{ id: SHARED_SPACE, name: "Colocation", default_share_percent: 50 }];
  spaceMembers: Row[] = [
    { space_id: SHARED_SPACE, user_id: USER_ID },
    { space_id: SHARED_SPACE, user_id: PARTNER_ID },
  ];
  /** Erreur simulée de la fonction SQL (rollback complet). */
  rpcError: { message: string; code?: string } | null = null;

  client() {
    return {
      from: (table: string) => this.builder(table),
      rpc: (fn: string, args: { p_rows: Row[]; p_shares: Row[] }) => this.rpc(fn, args),
    };
  }

  /**
   * import_transactions : une seule transaction SQL — tout ou rien, et idempotent :
   * une ligne importée dont le hash existe déjà dans son compte (ou déjà vue plus
   * haut dans le lot) est ignorée, avec son miroir de virement et sa dépense partagée.
   * (La vraie fonction est testée en SQL : supabase/tests/database/import_idempotent.test.sql.)
   */
  private rpc(fn: string, { p_rows, p_shares }: { p_rows: Row[]; p_shares: Row[] }) {
    if (fn !== "import_transactions") return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
    if (this.rpcError) return Promise.resolve({ data: null, error: this.rpcError });

    const hashOf = (r: Row) => (r.raw_import_data as { hash?: string } | null)?.hash;
    const skipped = new Set<number>();
    p_rows.forEach((r, i) => {
      const hash = hashOf(r);
      if (!r.is_imported || !hash) return;
      const known = this.transactions.some(
        (t) => t.account_id === r.account_id && t.is_imported && !t.deleted_at && hashOf(t) === hash,
      );
      const repeated = p_rows.slice(0, i).some((o) => o.account_id === r.account_id && hashOf(o) === hash);
      if (known || repeated) skipped.add(i);
    });
    const skippedTransfers = new Set([...skipped].map((i) => p_rows[i]!.transfer_id).filter(Boolean));
    const skippedIds = new Set([...skipped].map((i) => p_rows[i]!.id).filter(Boolean));

    const inserted: Row[] = p_rows
      .filter((r, i) => !skipped.has(i) && !(r.transfer_id && skippedTransfers.has(r.transfer_id)))
      .map((r, i) => ({
        ...r,
        id: (r.id as string | undefined) ?? `tx-${this.transactions.length + i}`,
        // timestamptz côté Postgres : la date revient avec une heure et un fuseau
        date: `${r.date as string}T00:00:00+00:00`,
      }));
    const shared: Row[] = [];
    for (const share of p_shares.filter((sh) => !skippedIds.has(sh.source_transaction_id))) {
      const source = inserted.find((t) => t.id === share.source_transaction_id);
      if (!source) return Promise.resolve({ data: null, error: { message: "unknown source", code: "23503" } });
      shared.push({ ...share, paid_by: USER_ID, amount_cents: -(source.amount_cents as number) });
    }
    this.transactions.push(...inserted);
    this.sharedExpenses.push(...shared);
    return Promise.resolve({ data: inserted.filter((t) => t.is_imported).length, error: null });
  }

  private builder(table: string) {
    const source = () =>
      table === "transactions"
        ? this.transactions
        : table === "accounts"
          ? this.accounts
          : table === "spaces"
            ? this.spaces
            : table === "space_members"
              ? this.spaceMembers
              : [];
    const filters: Array<(r: Row) => boolean> = [];
    let window: [number, number] | null = null;
    const run = () => {
      const out = source().filter((r) => filters.every((f) => f(r)));
      const [from, to] = window ?? [0, Infinity];
      const cap = this.maxRows ?? Infinity;
      return { data: out.slice(from, Math.min(to + 1, from + cap)), error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]));
        return chain;
      },
      is: (col: string, val: unknown) => {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val));
        return chain;
      },
      not: (col: string, _op: string, val: unknown) => {
        filters.push((r) => (val === null ? r[col] != null : r[col] !== val));
        return chain;
      },
      gte: (col: string, val: string) => {
        filters.push((r) => String(r[col]) >= val);
        return chain;
      },
      lt: (col: string, val: string) => {
        filters.push((r) => String(r[col]) < val);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      range: (from: number, to: number) => {
        window = [from, to];
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
    };
    Object.defineProperty(chain, "then", {
      get() {
        const p = Promise.resolve(run());
        return p.then.bind(p);
      },
    });
    return chain;
  }

  ofAccount(accountId: string) {
    return this.transactions.filter((t) => t.account_id === accountId);
  }
  balance(accountId: string) {
    return this.ofAccount(accountId).reduce((s, t) => s + (t.amount_cents as number), 0);
  }
}

// ---------------------------------------------------------------------------
// Fabrication de fichiers réalistes
// ---------------------------------------------------------------------------

type Line = { date: string; label: string; amount: number };

const N26_HEADER = `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`;

function n26File(lines: Line[]) {
  const body = lines.map(
    (l) => `"${l.date}","${l.date}","${l.label}","","Presentment","","N26","${l.amount.toFixed(2)}","","",""`,
  );
  return new File([[N26_HEADER, ...body].join("\n")], "n26.csv", { type: "text/csv" });
}

/** Ligne `amountText` fournie brute pour tester les formats de nombre de la banque. */
function bnpBuffer(lines: Array<{ date: string; label: string; amount: string | number }>): ArrayBuffer {
  const aoa = [
    ["Compte BNP FR76…", "", ""],
    ["Date operation", "Libelle operation", "Montant"],
    ...lines.map((l) => [l.date, l.label, String(l.amount)]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

function bnpFile(lines: Array<{ date: string; label: string; amount: string | number }>) {
  return new File([bnpBuffer(lines)], "bnp.xlsx");
}

// ---------------------------------------------------------------------------
// Simulation du parcours de la modale : preview → sélection → confirm
// ---------------------------------------------------------------------------

type PreviewRow = {
  hash: string;
  date: string;
  description: string;
  amount_cents: number;
  kind: "expense" | "income";
  is_transfer_candidate: boolean;
  is_duplicate: boolean;
  duplicate_reason: "already_imported" | "transfer_mirror" | null;
  suggested_share: { space_id: string; space_name: string; category_id: string | null; payer_share_percent: number } | null;
};

async function preview(file: File, accountId?: string): Promise<PreviewRow[]> {
  const fd = new FormData();
  fd.append("file", file);
  // Comme la modale : le compte cible part avec le fichier
  if (accountId) fd.append("account_id", accountId);
  const res = await previewPOST(new Request("http://localhost/api/import/preview", { method: "POST", body: fd }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { preview: PreviewRow[] }).preview;
}

type ConfirmOpts = {
  /** Compte de contrepartie par description : la ligne est alors importée comme virement + miroir. */
  counterpart?: Record<string, string>;
  /** Décocher explicitement ces descriptions (comme un utilisateur qui écarte une ligne). */
  uncheck?: string[];
  /** Cocher aussi les lignes marquées doublon. */
  includeDuplicates?: boolean;
  /** Partager ces lignes (par description) vers l'espace commun — comme le fait la modale. */
  share?: Record<string, { space_id: string; category_id?: string | null; payer_share_percent?: number }>;
};

function buildConfirmBody(accountId: string, rows: PreviewRow[], opts: ConfirmOpts = {}) {
  const selected = rows.filter(
    (r) => (opts.includeDuplicates || !r.is_duplicate) && !opts.uncheck?.includes(r.description),
  );
  return {
    account_id: accountId,
    transactions: selected.map((r) => {
      const counterpart = opts.counterpart?.[r.description];
      return {
        hash: r.hash,
        date: r.date,
        description: r.description,
        amount_cents: r.amount_cents,
        kind: counterpart ? ("transfer" as const) : r.kind,
        category_id: null,
        transfer_account_id: counterpart,
        ...(opts.share?.[r.description] ? { share: opts.share[r.description] } : {}),
      };
    }),
  };
}

async function confirmBody(body: unknown) {
  return confirmPOST(
    new Request("http://localhost/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function importFile(accountId: string, file: File, opts: ConfirmOpts = {}) {
  const rows = await preview(file, accountId);
  const res = await confirmBody(buildConfirmBody(accountId, rows, opts));
  return { rows, res };
}

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  vi.mocked(withSpace).mockResolvedValue({
    supabase: db.client(),
    user: { id: USER_ID, email: "test@budget.local" },
    spaceId: SPACE_ID,
    space: { id: SPACE_ID, name: "Personnel", kind: "personal", role: "owner" },
    spaces: [
      { id: SPACE_ID, name: "Personnel", kind: "personal", role: "owner" },
      { id: SHARED_SPACE, name: "Colocation", kind: "shared", role: "member" },
    ],
  } as never);
  vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => null);
});

// ---------------------------------------------------------------------------
// 1. Ré-import du même fichier / chevauchement de périodes
// ---------------------------------------------------------------------------

describe("ré-import et chevauchement", () => {
  const janvier: Line[] = [
    { date: "2026-01-05", label: "Lidl", amount: -42.3 },
    { date: "2026-01-10", label: "Employeur SA", amount: 2500 },
  ];

  it("ré-importer le même fichier : tout est signalé doublon, rien n'est inséré", async () => {
    await importFile(N26_ACCOUNT, n26File(janvier));
    const { rows } = await importFile(N26_ACCOUNT, n26File(janvier));

    expect(rows.every((r) => r.is_duplicate)).toBe(true);
    expect(db.transactions).toHaveLength(2);
  });

  it("exports qui se chevauchent : seules les nouvelles lignes sont importées", async () => {
    await importFile(N26_ACCOUNT, n26File(janvier));
    const chevauchement = [...janvier, { date: "2026-02-03", label: "Netflix", amount: -15.99 }];
    const { rows } = await importFile(N26_ACCOUNT, n26File(chevauchement));

    expect(rows.filter((r) => r.is_duplicate)).toHaveLength(2);
    expect(db.transactions).toHaveLength(3);
  });

  it("une transaction supprimée (soft delete) peut être ré-importée", async () => {
    await importFile(N26_ACCOUNT, n26File(janvier));
    db.transactions.forEach((t) => (t.deleted_at = "2026-03-01T00:00:00Z"));

    const { rows } = await importFile(N26_ACCOUNT, n26File(janvier));
    expect(rows.some((r) => r.is_duplicate)).toBe(false);
  });

  it("une transaction identique d'un AUTRE espace n'est pas un doublon", async () => {
    db.transactions.push({
      space_id: "another-space-id",
      user_id: USER_ID,
      account_id: N26_ACCOUNT,
      date: "2026-01-05",
      description: "Lidl",
      amount_cents: -4230,
      is_imported: false,
      raw_import_data: null,
      deleted_at: null,
    });
    const rows = await preview(n26File(janvier));
    expect(rows.find((r) => r.description === "Lidl")?.is_duplicate).toBe(false);
  });

  it("importer vers un compte d'un autre espace est refusé (404), rien n'est inséré", async () => {
    const rows = await preview(n26File(janvier));
    const res = await confirmBody(buildConfirmBody("00000000-0000-4000-8000-0000000000ff", rows));

    expect(res.status).toBe(404);
    expect(db.transactions).toHaveLength(0);
  });

  it("une saisie manuelle identique (date + libellé + montant) est vue comme doublon", async () => {
    db.transactions.push({
      space_id: SPACE_ID,
      user_id: USER_ID,
      account_id: N26_ACCOUNT,
      date: "2026-01-05",
      description: "Lidl",
      amount_cents: -4230,
      is_imported: false,
      raw_import_data: null,
      deleted_at: null,
    });
    const rows = await preview(n26File(janvier));
    expect(rows.find((r) => r.description === "Lidl")?.is_duplicate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Virements entre deux banques — le cas du double comptage
// ---------------------------------------------------------------------------

describe("virement BNP → N26 importé depuis les deux banques", () => {
  // Côté BNP : "VIREMENT VERS N26" -500 €. Côté N26 : "Romain Pereira" +500 €.
  const bnp = [{ date: "05-01-2026", label: "VIREMENT VERS N26", amount: "-500.00" }];
  const n26: Line[] = [{ date: "2026-01-05", label: "Romain Pereira", amount: 500 }];

  it("BNP avec contrepartie N26 crée bien la ligne miroir liée (même transfer_id, montant opposé)", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });

    const [debit, mirror] = db.transactions;
    expect(debit).toMatchObject({ account_id: BNP_ACCOUNT, kind: "transfer_debit", amount_cents: -50000, is_imported: true });
    expect(mirror).toMatchObject({ account_id: N26_ACCOUNT, kind: "transfer_credit", amount_cents: 50000, is_imported: false });
    expect(debit?.transfer_id).toBeTruthy();
    expect(debit?.transfer_id).toBe(mirror?.transfer_id);
  });

  it("sans contrepartie : une seule ligne, pas de miroir ni de transfer_id", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp));
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0]?.transfer_id).toBeNull();
  });

  // Le miroir garde le libellé BNP et la ligne N26 en a un autre : le hash ne peut pas
  // les rapprocher. Le preview cherche donc un miroir de même montant, à quelques jours près.
  it("la ligne N26 correspondant au miroir déjà créé est signalée doublon (transfer_mirror)", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    const rows = await preview(n26File(n26), N26_ACCOUNT);
    expect(rows[0]).toMatchObject({ is_duplicate: true, duplicate_reason: "transfer_mirror" });
  });

  it("le rapprochement tolère quelques jours d'écart entre les deux banques", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    const [proche] = await preview(n26File([{ date: "2026-01-08", label: "Romain Pereira", amount: 500 }]), N26_ACCOUNT);
    const [loin] = await preview(n26File([{ date: "2026-01-12", label: "Romain Pereira", amount: 500 }]), N26_ACCOUNT);
    expect(proche?.is_duplicate).toBe(true);
    expect(loin?.is_duplicate).toBe(false);
  });

  it("un miroir n'absorbe qu'une ligne : un 2e virement de même montant reste à importer", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Romain Pereira", amount: 500 },
        { date: "2026-01-06", label: "Autre virement", amount: 500 },
      ]),
      N26_ACCOUNT,
    );
    expect(rows.map((r) => r.is_duplicate)).toEqual([true, false]);
  });

  it("ré-importer le fichier N26 après coup reste sans effet (miroir toujours reconnu)", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    await importFile(N26_ACCOUNT, n26File(n26));
    const { rows } = await importFile(N26_ACCOUNT, n26File(n26));
    expect(rows[0]?.is_duplicate).toBe(true);
    expect(db.ofAccount(N26_ACCOUNT)).toHaveLength(1);
  });

  // Même problème vu par son effet : le solde N26 ne doit pas doubler.
  it("après import des deux fichiers, le solde N26 vaut +500 € (pas +1000 €)", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    // L'utilisateur importe le fichier N26 tel quel, en suivant les cases pré-cochées.
    await importFile(N26_ACCOUNT, n26File(n26));
    expect(db.balance(N26_ACCOUNT)).toBe(50000);
  });

  it("contournement A : décocher la ligne côté N26 évite le double comptage", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    await importFile(N26_ACCOUNT, n26File(n26), { uncheck: ["Romain Pereira"] });
    expect(db.balance(N26_ACCOUNT)).toBe(50000);
    expect(db.balance(BNP_ACCOUNT)).toBe(-50000);
  });

  it("contournement B : sans contrepartie des deux côtés, chaque compte est bon", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp));
    await importFile(N26_ACCOUNT, n26File(n26));
    expect(db.balance(N26_ACCOUNT)).toBe(50000);
    expect(db.balance(BNP_ACCOUNT)).toBe(-50000);
  });

  it("ordre inverse (N26 d'abord avec contrepartie BNP, puis BNP) : pas de double comptage côté BNP", async () => {
    await importFile(N26_ACCOUNT, n26File(n26), { counterpart: { "Romain Pereira": BNP_ACCOUNT } });
    await importFile(BNP_ACCOUNT, bnpFile(bnp));
    expect(db.balance(BNP_ACCOUNT)).toBe(-50000);
    expect(db.balance(N26_ACCOUNT)).toBe(50000);
  });

  it("le miroir d'un autre compte n'est pas pris pour le virement : un fichier vers un 3e compte n'est pas touché", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    const [row] = await preview(n26File(n26), BNP_ACCOUNT);
    expect(row?.is_duplicate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Faux doublons (lignes légitimes écartées à tort)
// ---------------------------------------------------------------------------

describe("faux positifs de la déduplication", () => {
  // Deux cafés à 3 € le même jour au même endroit = deux vraies dépenses.
  it("deux achats identiques le même jour dans un même fichier sont tous les deux importés", async () => {
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
      ]),
    );
    expect(rows.filter((r) => r.is_duplicate)).toHaveLength(0);
  });

  it("ces deux achats identiques sont bien enregistrés, et un ré-import ne les recrée pas", async () => {
    const twins = n26File([
      { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
      { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
    ]);
    await importFile(N26_ACCOUNT, twins);
    expect(db.transactions).toHaveLength(2);

    const { rows } = await importFile(N26_ACCOUNT, twins);
    expect(rows.every((r) => r.is_duplicate)).toBe(true);
    expect(db.transactions).toHaveLength(2);
  });

  it("un export plus récent qui contient un 2e achat identique n'importe que celui-là", async () => {
    await importFile(N26_ACCOUNT, n26File([{ date: "2026-01-05", label: "Boulangerie Paul", amount: -3 }]));
    const { rows } = await importFile(
      N26_ACCOUNT,
      n26File([
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
      ]),
    );
    expect(rows.map((r) => r.is_duplicate)).toEqual([true, false]);
    expect(db.transactions).toHaveLength(2);
  });

  // La dédup est limitée au compte : un retrait identique sur deux banques
  // le même jour n'est pas un doublon.
  it("une même opération (date/libellé/montant) sur deux comptes différents n'est pas un doublon", async () => {
    await importFile(BNP_ACCOUNT, bnpFile([{ date: "05-01-2026", label: "RETRAIT DAB", amount: "-50.00" }]));
    const rows = await preview(n26File([{ date: "2026-01-05", label: "RETRAIT DAB", amount: -50 }]), N26_ACCOUNT);
    expect(rows[0]?.is_duplicate).toBe(false);
  });

  it("… mais le même compte, lui, le reconnaît", async () => {
    await importFile(BNP_ACCOUNT, bnpFile([{ date: "05-01-2026", label: "RETRAIT DAB", amount: "-50.00" }]));
    const rows = await preview(bnpFile([{ date: "05-01-2026", label: "RETRAIT DAB", amount: "-50.00" }]), BNP_ACCOUNT);
    expect(rows[0]?.is_duplicate).toBe(true);
  });

  it("deux achats identiques à des dates différentes ne sont pas des doublons", async () => {
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
        { date: "2026-01-06", label: "Boulangerie Paul", amount: -3 },
      ]),
    );
    expect(rows.some((r) => r.is_duplicate)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Volumétrie : 6 mois d'historique
// ---------------------------------------------------------------------------

function manyLines(n: number): Line[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-0${1 + (i % 6)}-${String(1 + (i % 28)).padStart(2, "0")}`,
    label: `Commerce ${i}`,
    amount: -(1 + i / 100),
  }));
}

describe("volumétrie", () => {
  // Chaque réponse PostgREST est plafonnée à 1000 lignes : la dédup lit donc page par page,
  // sinon les hashes au-delà de la 1000e ligne sont ignorés et un ré-import recrée des doublons.
  it("la déduplication reste fiable au-delà de 1000 transactions déjà en base", async () => {
    for (const chunk of [manyLines(1100).slice(0, 500), manyLines(1100).slice(500, 1000), manyLines(1100).slice(1000)]) {
      await importFile(N26_ACCOUNT, n26File(chunk));
    }
    expect(db.transactions).toHaveLength(1100);

    const rows = await preview(n26File(manyLines(1100)), N26_ACCOUNT);
    expect(rows.filter((r) => r.is_duplicate)).toHaveLength(1100);
  });

  it("la déduplication fonctionne bien sous le plafond de 1000 lignes", async () => {
    await importFile(N26_ACCOUNT, n26File(manyLines(400)));
    const rows = await preview(n26File(manyLines(400)));
    expect(rows.every((r) => r.is_duplicate)).toBe(true);
  });

  // Limite actuelle : le confirm refuse > 500 lignes alors que la preview en accepte plus.
  it("un fichier de plus de 500 lignes est refusé au confirm (400) — à découper par période", async () => {
    const rows = await preview(n26File(manyLines(600)));
    expect(rows).toHaveLength(600);

    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows));
    expect(res.status).toBe(400);
    expect(db.transactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Double envoi du confirm
// ---------------------------------------------------------------------------

describe("double envoi", () => {
  // Double-clic sur « Importer » ou rejeu réseau : la fonction SQL ignore ce qui existe déjà.
  it("confirmer deux fois le même lot n'insère pas les lignes deux fois", async () => {
    const rows = await preview(n26File([{ date: "2026-01-05", label: "Lidl", amount: -42.3 }]), N26_ACCOUNT);
    const body = buildConfirmBody(N26_ACCOUNT, rows);
    await confirmBody(body);
    const second = await confirmBody(body);
    expect(db.transactions).toHaveLength(1);
    expect(await second.json()).toMatchObject({ ok: true, imported: 0, skipped: 1 });
  });

  it("un lot rejoué ne recrée ni le miroir d'un virement ni la dépense partagée", async () => {
    const rows = await preview(
      bnpFile([
        { date: "05-01-2026", label: "VIREMENT VERS N26", amount: "-500.00" },
        { date: "06-01-2026", label: "LOYER", amount: "-800.00" },
      ]),
      BNP_ACCOUNT,
    );
    const body = buildConfirmBody(BNP_ACCOUNT, rows, {
      counterpart: { "VIREMENT VERS N26": N26_ACCOUNT },
      share: { LOYER: { space_id: SHARED_SPACE } },
    });
    await confirmBody(body);
    const rowsAfterFirst = db.transactions.length;
    await confirmBody(body);
    expect(db.transactions).toHaveLength(rowsAfterFirst); // 3 : ligne, miroir, loyer
    expect(db.sharedExpenses).toHaveLength(1);
  });

  it("une ligne déjà importée dans un lot mixte est ignorée, les nouvelles passent", async () => {
    await importFile(N26_ACCOUNT, n26File([{ date: "2026-01-05", label: "Lidl", amount: -42.3 }]));
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Lidl", amount: -42.3 },
        { date: "2026-01-06", label: "Netflix", amount: -15.99 },
      ]),
      N26_ACCOUNT,
    );
    // l'utilisateur force aussi la ligne marquée doublon
    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows, { includeDuplicates: true }));
    expect(await res.json()).toMatchObject({ imported: 1, skipped: 1 });
    expect(db.transactions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Détection des virements (impacte revenus/dépenses)
// ---------------------------------------------------------------------------

describe("détection de virements", () => {
  it("reconnaît les libellés BNP usuels", () => {
    expect(detectTransfer("VIR SEPA RECU /DE Romain")).toBe(true);
    expect(detectTransfer("VIREMENT VERS N26")).toBe(true);
    expect(detectTransfer("VIR INST Loyer")).toBe(true);
  });

  it("ne marque pas une dépense courante comme virement", () => {
    expect(detectTransfer("Lidl")).toBe(false);
    expect(detectTransfer("CB CARREFOUR")).toBe(false);
  });

  // Un salaire versé par virement est présélectionné « virement » : s'il est
  // importé tel quel il sort des revenus. Comportement actuel à connaître.
  it("un salaire BNP par virement est présélectionné comme virement (à décocher)", async () => {
    const rows = await preview(bnpFile([{ date: "28-01-2026", label: "VIR SEPA RECU /DE EMPLOYEUR SA", amount: "2500.00" }]));
    expect(rows[0]?.is_transfer_candidate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Formats de nombres des banques
// ---------------------------------------------------------------------------

describe("parsing des montants", () => {
  it("BNP : virgule décimale et espace des milliers", () => {
    const [tx] = parseBnpXls(bnpBuffer([{ date: "05-01-2026", label: "LOYER", amount: "-1 234,56" }]));
    expect(tx?.amount_cents).toBe(-123456);
  });

  // Le parseur ne remplace que la 1re virgule : "1.234,56" devient "1.234.56" → 1.234 €.
  it("BNP : séparateur de milliers avec point (1.234,56)", () => {
    const [tx] = parseBnpXls(bnpBuffer([{ date: "05-01-2026", label: "LOYER", amount: "-1.234,56" }]));
    expect(tx?.amount_cents).toBe(-123456);
  });

  it("N26 : séparateur de milliers avec virgule (1,234.56)", () => {
    const csv = [N26_HEADER, `"2026-01-05","2026-01-05","Employeur","","","","N26","1,234.56","","",""`].join("\n");
    const [tx] = parseN26Csv(csv);
    expect(tx?.amount_cents).toBe(123456);
  });

  it("BNP : les dates JJ/MM/AAAA et JJ-MM-AAAA sont normalisées", () => {
    const txs = parseBnpXls(
      bnpBuffer([
        { date: "05/01/2026", label: "A", amount: "-1" },
        { date: "06-01-2026", label: "B", amount: "-2" },
      ]),
    );
    expect(txs.map((t) => t.date)).toEqual(["2026-01-05", "2026-01-06"]);
  });

  it("BNP : une ligne avec une date illisible est ignorée sans faire échouer l'import", () => {
    const txs = parseBnpXls(
      bnpBuffer([
        { date: "pas une date", label: "X", amount: "-1" },
        { date: "06-01-2026", label: "B", amount: "-2" },
      ]),
    );
    expect(txs).toHaveLength(1);
  });

  it("N26 : les décimales flottantes sont arrondies au centime (pas de -1599.0000001)", () => {
    const csv = [N26_HEADER, `"2026-01-05","2026-01-05","Netflix","","","","N26","-15.99","","",""`].join("\n");
    expect(parseN26Csv(csv)[0]?.amount_cents).toBe(-1599);
  });
});

// ---------------------------------------------------------------------------
// Import avec règles de partage : transactions + dépenses partagées, atomiquement
// ---------------------------------------------------------------------------

describe("import avec partage (règles de partage)", () => {
  const lignes: Line[] = [
    { date: "2026-01-05", label: "Loyer Agence", amount: -600 },
    { date: "2026-01-06", label: "Lidl", amount: -42.3 },
    { date: "2026-01-10", label: "Employeur SA", amount: 2500 },
  ];

  /** Une règle « loyer » partage 40 % vers l'espace commun ; le reste ne partage pas. */
  const ruleSharesLoyer = () =>
    vi.mocked(buildRuleShareMatcher).mockResolvedValue((description, kind) =>
      kind === "expense" && description.includes("Loyer")
        ? { space_id: SHARED_SPACE, category_id: null, payer_share_percent: 40 }
        : null,
    );

  const shareOf = (rows: PreviewRow[]) =>
    Object.fromEntries(
      rows
        .filter((r) => r.suggested_share)
        .map((r) => [
          r.description,
          {
            space_id: r.suggested_share!.space_id,
            category_id: r.suggested_share!.category_id,
            payer_share_percent: r.suggested_share!.payer_share_percent,
          },
        ]),
    );

  it("le preview pré-marque la ligne de la règle ; le confirm crée transaction ET dépense partagée liées", async () => {
    ruleSharesLoyer();
    const rows = await preview(n26File(lignes));
    expect(rows.find((r) => r.description === "Loyer Agence")?.suggested_share).toEqual({
      space_id: SHARED_SPACE,
      space_name: "Colocation",
      category_id: null,
      payer_share_percent: 40,
    });
    expect(rows.find((r) => r.description === "Lidl")?.suggested_share).toBeNull();

    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows, { share: shareOf(rows) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, imported: 3, skipped: 0, shared: 1 });

    expect(db.transactions).toHaveLength(3);
    expect(db.sharedExpenses).toHaveLength(1);
    const loyer = db.transactions.find((t) => t.description === "Loyer Agence")!;
    expect(db.sharedExpenses[0]).toMatchObject({
      space_id: SHARED_SPACE,
      source_transaction_id: loyer.id,
      paid_by: USER_ID,
      shares: { [USER_ID]: 40, [PARTNER_ID]: 60 },
    });
  });

  it("une ligne que l'utilisateur dé-partage reste une simple transaction", async () => {
    ruleSharesLoyer();
    const rows = await preview(n26File(lignes));
    const share = shareOf(rows);
    delete share["Loyer Agence"]; // décochée dans la modale : la ligne part sans `share`

    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows, { share }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, imported: 3, skipped: 0, shared: 0 });
    expect(db.sharedExpenses).toHaveLength(0);
    expect(db.transactions).toHaveLength(3);
  });

  it("l'utilisateur peut aussi partager à la main une ligne sans règle, avec le pourcentage par défaut", async () => {
    const rows = await preview(n26File(lignes));
    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows, { share: { Lidl: { space_id: SHARED_SPACE } } }));
    expect(res.status).toBe(200);
    expect(db.sharedExpenses[0]?.shares).toEqual({ [USER_ID]: 50, [PARTNER_ID]: 50 });
  });

  it("un doublon n'est jamais pré-marqué à partager", async () => {
    ruleSharesLoyer();
    await importFile(N26_ACCOUNT, n26File(lignes));
    const rows = await preview(n26File(lignes));
    expect(rows.every((r) => r.is_duplicate && r.suggested_share === null)).toBe(true);
  });

  it("un virement présumé et un revenu ne sont jamais pré-marqués", async () => {
    vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => ({
      space_id: SHARED_SPACE,
      category_id: null,
      payer_share_percent: null,
    }));
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Virement SEPA loyer", amount: -600 },
        { date: "2026-01-10", label: "Employeur SA", amount: 2500 },
        { date: "2026-01-11", label: "Lidl", amount: -10 },
      ]),
    );
    expect(rows.find((r) => r.description === "Virement SEPA loyer")?.suggested_share).toBeNull();
    expect(rows.find((r) => r.description === "Employeur SA")?.suggested_share).toBeNull();
    expect(rows.find((r) => r.description === "Lidl")?.suggested_share).not.toBeNull();
  });

  it("le confirm refuse de partager un revenu ou un virement (400), rien n'est inséré", async () => {
    const rows = await preview(n26File(lignes));
    const revenu = await confirmBody(
      buildConfirmBody(N26_ACCOUNT, rows, { share: { "Employeur SA": { space_id: SHARED_SPACE } } }),
    );
    expect(revenu.status).toBe(400);

    const virement = await confirmBody(
      buildConfirmBody(N26_ACCOUNT, rows, {
        counterpart: { Lidl: BNP_ACCOUNT },
        share: { Lidl: { space_id: SHARED_SPACE } },
      }),
    );
    expect(virement.status).toBe(400);
    expect(db.transactions).toHaveLength(0);
    expect(db.sharedExpenses).toHaveLength(0);
  });

  it("un espace commun actif refuse tout partage (400) et ne suggère rien", async () => {
    vi.mocked(withSpace).mockResolvedValue({
      supabase: db.client(),
      user: { id: USER_ID, email: "test@budget.local" },
      spaceId: SPACE_ID,
      space: { id: SPACE_ID, name: "Colocation", kind: "shared", role: "member" },
      spaces: [{ id: SHARED_SPACE, name: "Colocation", kind: "shared", role: "member" }],
    } as never);
    ruleSharesLoyer();

    const rows = await preview(n26File(lignes));
    expect(rows.every((r) => r.suggested_share === null)).toBe(true);

    const res = await confirmBody(
      buildConfirmBody(N26_ACCOUNT, rows, { share: { Lidl: { space_id: SHARED_SPACE } } }),
    );
    expect(res.status).toBe(400);
    expect(db.transactions).toHaveLength(0);
  });

  it("un espace commun dont on n'est pas membre est refusé (403)", async () => {
    const rows = await preview(n26File(lignes));
    const res = await confirmBody(
      buildConfirmBody(N26_ACCOUNT, rows, { share: { Lidl: { space_id: "00000000-0000-4000-8000-0000000000f4" } } }),
    );
    expect(res.status).toBe(403);
    expect(db.transactions).toHaveLength(0);
  });

  it("une règle périmée (espace quitté) ne suggère rien, sans erreur", async () => {
    ruleSharesLoyer();
    vi.mocked(withSpace).mockResolvedValue({
      supabase: db.client(),
      user: { id: USER_ID, email: "test@budget.local" },
      spaceId: SPACE_ID,
      space: { id: SPACE_ID, name: "Personnel", kind: "personal", role: "owner" },
      spaces: [{ id: SPACE_ID, name: "Personnel", kind: "personal", role: "owner" }],
    } as never);
    const rows = await preview(n26File(lignes));
    expect(rows.every((r) => r.suggested_share === null)).toBe(true);
  });

  it("atomicité : si la base refuse le partage, aucune transaction n'est créée", async () => {
    const rows = await preview(n26File(lignes));
    db.rpcError = { message: "shared expense refused", code: "23514" };
    const res = await confirmBody(buildConfirmBody(N26_ACCOUNT, rows, { share: { Lidl: { space_id: SHARED_SPACE } } }));
    expect(res.status).toBe(400);
    expect(db.transactions).toHaveLength(0);
    expect(db.sharedExpenses).toHaveLength(0);
  });
});
