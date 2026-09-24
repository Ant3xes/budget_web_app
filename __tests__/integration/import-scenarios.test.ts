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
 *  - `it.fails(...)` : comportement SOUHAITÉ mais aujourd'hui en défaut (bug connu).
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
    buildHistoryMatcher: vi.fn().mockResolvedValue(() => null),
    buildDefaultMatcher: vi.fn().mockReturnValue(() => null),
  };
});

import { POST as confirmPOST } from "@/app/api/import/confirm/route";
import { POST as previewPOST } from "@/app/api/import/preview/route";
import { detectTransfer } from "@/lib/import/apply-rules";
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

class FakeDb {
  transactions: Row[] = [];
  /** Comptes de l'espace actif : l'import vérifie que les comptes ciblés y appartiennent. */
  accounts: Row[] = [BNP_ACCOUNT, N26_ACCOUNT].map((id) => ({ id, space_id: SPACE_ID, deleted_at: null }));
  /** PostgREST plafonne à 1000 lignes par requête (max-rows) ; null = pas de plafond. */
  maxRows: number | null = 1000;

  client() {
    return {
      from: (table: string) => this.builder(table),
    };
  }

  private builder(table: string) {
    const source = () => (table === "transactions" ? this.transactions : table === "accounts" ? this.accounts : []);
    const filters: Array<(r: Row) => boolean> = [];
    let insertRows: Row[] | null = null;

    const run = () => {
      if (insertRows) {
        this.transactions.push(...insertRows.map((r, i) => ({ id: `tx-${this.transactions.length + i}`, ...r })));
        return { data: null, error: null };
      }
      let out = source().filter((r) => filters.every((f) => f(r)));
      if (this.maxRows !== null) out = out.slice(0, this.maxRows);
      return { data: out, error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (rows: Row[]) => {
        insertRows = rows;
        return chain;
      },
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
      order: () => chain,
      limit: () => chain,
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
};

async function preview(file: File): Promise<PreviewRow[]> {
  const fd = new FormData();
  fd.append("file", file);
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
  const rows = await preview(file);
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
    spaces: [],
  } as never);
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

  // BUG CONNU : le miroir garde le libellé BNP, la ligne N26 a un autre libellé
  // (et un signe opposé) → hash différent → pas détectée comme doublon.
  it.fails("la ligne N26 correspondant au miroir déjà créé est signalée doublon", async () => {
    await importFile(BNP_ACCOUNT, bnpFile(bnp), { counterpart: { "VIREMENT VERS N26": N26_ACCOUNT } });
    const rows = await preview(n26File(n26));
    expect(rows[0]?.is_duplicate).toBe(true);
  });

  // Même bug vu par son effet : le solde N26 ne doit pas doubler.
  it.fails("après import des deux fichiers, le solde N26 vaut +500 € (pas +1000 €)", async () => {
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

  it("ordre inverse (N26 d'abord avec contrepartie BNP, puis BNP) : même double comptage côté BNP aujourd'hui", async () => {
    await importFile(N26_ACCOUNT, n26File(n26), { counterpart: { "Romain Pereira": BNP_ACCOUNT } });
    const rows = await preview(bnpFile(bnp));
    // documente l'état actuel : la ligne BNP n'est pas vue comme doublon du miroir
    expect(rows[0]?.is_duplicate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Faux doublons (lignes légitimes écartées à tort)
// ---------------------------------------------------------------------------

describe("faux positifs de la déduplication", () => {
  // Deux cafés à 3 € le même jour au même endroit = deux vraies dépenses.
  it.fails("deux achats identiques le même jour dans un même fichier sont tous les deux importés", async () => {
    const rows = await preview(
      n26File([
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
        { date: "2026-01-05", label: "Boulangerie Paul", amount: -3 },
      ]),
    );
    expect(rows.filter((r) => r.is_duplicate)).toHaveLength(0);
  });

  // La dédup n'est pas limitée au compte : un retrait identique sur deux banques
  // le même jour est pris pour un doublon.
  it.fails("une même opération (date/libellé/montant) sur deux comptes différents n'est pas un doublon", async () => {
    await importFile(BNP_ACCOUNT, bnpFile([{ date: "05-01-2026", label: "RETRAIT DAB", amount: "-50.00" }]));
    const rows = await preview(n26File([{ date: "2026-01-05", label: "RETRAIT DAB", amount: -50 }]));
    expect(rows[0]?.is_duplicate).toBe(false);
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
  // Chaque requête de dédup est plafonnée à 1000 lignes par PostgREST : au-delà,
  // les hashes existants ne sont plus tous vus et un ré-import recrée des doublons.
  it.fails("la déduplication reste fiable au-delà de 1000 transactions déjà en base", async () => {
    for (const chunk of [manyLines(1100).slice(0, 500), manyLines(1100).slice(500, 1000), manyLines(1100).slice(1000)]) {
      await importFile(N26_ACCOUNT, n26File(chunk));
    }
    expect(db.transactions).toHaveLength(1100);

    const rows = await preview(n26File(manyLines(1100)));
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
  // Double-clic sur « Importer » ou rejeu réseau : rien côté serveur ne l'empêche.
  it.fails("confirmer deux fois le même lot n'insère pas les lignes deux fois", async () => {
    const rows = await preview(n26File([{ date: "2026-01-05", label: "Lidl", amount: -42.3 }]));
    const body = buildConfirmBody(N26_ACCOUNT, rows);
    await confirmBody(body);
    await confirmBody(body);
    expect(db.transactions).toHaveLength(1);
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
  it.fails("BNP : séparateur de milliers avec point (1.234,56)", () => {
    const [tx] = parseBnpXls(bnpBuffer([{ date: "05-01-2026", label: "LOYER", amount: "-1.234,56" }]));
    expect(tx?.amount_cents).toBe(-123456);
  });

  it.fails("N26 : séparateur de milliers avec virgule (1,234.56)", () => {
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
