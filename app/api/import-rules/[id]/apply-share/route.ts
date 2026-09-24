import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchRetroCandidates, RETRO_SHARE_LIMIT } from "@/lib/import/rule-retro-candidates";
import { splitShares } from "@/lib/shared-expenses/split-shares";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

// Retroactive sharing of a rule: GET previews the lines (read-only), POST
// shares the ones the user kept, all or nothing.

type Auth = NonNullable<Awaited<ReturnType<typeof withSpace>>>;

const sinceSchema = z.iso.date();

const applySchema = z.object({
  since: sinceSchema,
  transaction_ids: z.array(z.guid()).min(1).max(RETRO_SHARE_LIMIT),
});

type RuleRow = {
  id: string;
  share_space_id: string | null;
  share_category_id: string | null;
  share_payer_percent: number | null;
};

/** The rule and its target space, or the error response to return. */
const loadRule = async (auth: Auth, id: string) => {
  if (auth.space.kind !== "personal") {
    return { error: NextResponse.json({ error: "Le partage n'est possible que depuis un espace personnel" }, { status: 400 }) };
  }

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .select("id, share_space_id, share_category_id, share_payer_percent")
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .maybeSingle();
  if (error) return { error: pgErrorResponse(error) };
  const rule = data as RuleRow | null;
  if (!rule) return { error: NextResponse.json({ error: "Règle introuvable" }, { status: 404 }) };
  if (!rule.share_space_id) {
    return { error: NextResponse.json({ error: "Cette règle ne partage pas" }, { status: 400 }) };
  }

  const target = auth.spaces.find((space) => space.id === rule.share_space_id && space.kind === "shared");
  if (!target) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { rule, target };
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Erreur");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const loaded = await loadRule(auth, id);
  if (loaded.error) return loaded.error;
  const { rule, target } = loaded;

  // Default: the day the user joined the shared space, so history from before
  // it (and probably already settled) is not pulled in by surprise.
  const { data: membership, error: membershipError } = await auth.supabase
    .from("space_members")
    .select("joined_at")
    .eq("space_id", target.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (membershipError) return pgErrorResponse(membershipError);
  const joinedAt = (membership as { joined_at: string } | null)?.joined_at;
  const sinceDefault = joinedAt ? joinedAt.slice(0, 10) : "1970-01-01";

  const requested = new URL(request.url).searchParams.get("since");
  const since = requested ?? sinceDefault;
  if (!sinceSchema.safeParse(since).success) {
    return NextResponse.json({ error: "since: date invalide" }, { status: 400 });
  }

  const { data: space, error: spaceError } = await auth.supabase
    .from("spaces")
    .select("default_share_percent")
    .eq("id", target.id)
    .maybeSingle();
  if (spaceError) return pgErrorResponse(spaceError);

  let candidates;
  try {
    candidates = await fetchRetroCandidates(auth.supabase, auth.spaceId, rule.id, since);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }

  const rows = candidates.slice(0, RETRO_SHARE_LIMIT);
  return NextResponse.json({
    since,
    since_default: sinceDefault,
    target_space: { id: target.id, name: target.name },
    payer_percent:
      rule.share_payer_percent ?? (space as { default_share_percent: number } | null)?.default_share_percent ?? 50,
    rows,
    total_cents: rows.reduce((sum, row) => sum + Math.abs(row.amount_cents), 0),
    truncated: candidates.length > RETRO_SHARE_LIMIT,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const payload = applySchema.safeParse(await request.json());
  if (!payload.success) {
    const issue = payload.error.issues[0];
    const path = issue?.path?.join(".") ?? "";
    const msg = issue?.message ?? "Invalid data";
    return NextResponse.json({ error: path ? `${path}: ${msg}` : msg }, { status: 400 });
  }

  const loaded = await loadRule(auth, id);
  if (loaded.error) return loaded.error;
  const { rule, target } = loaded;

  // Never trust the client's list: recompute what the rule shares and keep
  // only the ids that are still candidates.
  let candidates;
  try {
    candidates = await fetchRetroCandidates(auth.supabase, auth.spaceId, rule.id, payload.data.since);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
  const wanted = new Set(payload.data.transaction_ids);
  const toShare = candidates.filter((candidate) => wanted.has(candidate.id));
  if (toShare.length === 0) return NextResponse.json({ ok: true, shared: 0 });

  const [membersResult, spaceResult] = await Promise.all([
    auth.supabase.from("space_members").select("user_id").eq("space_id", target.id),
    auth.supabase.from("spaces").select("default_share_percent").eq("id", target.id).maybeSingle(),
  ]);
  if (membersResult.error) return pgErrorResponse(membersResult.error);
  if (spaceResult.error) return pgErrorResponse(spaceResult.error);

  const memberIds = (membersResult.data ?? []).map((row: { user_id: string }) => row.user_id);
  const defaultPercent = (spaceResult.data as { default_share_percent: number } | null)?.default_share_percent ?? 50;

  let shares;
  try {
    shares = splitShares(auth.user.id, memberIds, rule.share_payer_percent ?? defaultPercent);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }

  const { error } = await auth.supabase.rpc("share_transactions", {
    p_shares: toShare.map((candidate) => ({
      space_id: target.id,
      source_transaction_id: candidate.id,
      category_id: rule.share_category_id,
      shares,
    })),
  });
  if (error) return pgErrorResponse(error);

  return NextResponse.json({ ok: true, shared: toShare.length });
}
