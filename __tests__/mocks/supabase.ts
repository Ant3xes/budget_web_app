import { vi } from "vitest";

export type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
};

export function createChainableMock(
  finalResult: { data: unknown; error: unknown } = { data: null, error: null },
): MockQueryBuilder {
  const chain = {} as MockQueryBuilder;
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.not = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.maybeSingle = vi.fn(() => Promise.resolve(finalResult));
  chain.single = vi.fn(() => Promise.resolve(finalResult));

  // Make the chain itself thenable (for `await supabase.from(...).select(...)`)
  Object.defineProperty(chain, "then", {
    get() {
      return Promise.resolve(finalResult).then.bind(Promise.resolve(finalResult));
    },
  });

  return chain;
}

export function createSupabaseMock(user = { id: "user-test-id", email: "test@test.com" }) {
  const queryBuilder = createChainableMock();

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
    },
    from: vi.fn(() => queryBuilder),
  };

  return { supabase, queryBuilder };
}
