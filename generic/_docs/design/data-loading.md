# Data loading

How data reaches a page, and the rules that keep nested routes from loading
in a waterfall: a request that can't start until another has finished. On this
platform a waterfall is expensive. A SQL warehouse query takes seconds, a
stopped warehouse can take minutes to start, and each request in a chain can pay
that wait again.

Data comes from two places, and each is loaded differently:

| Source                                                                        | Loaded by                           | Where it starts                            |
| ----------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------ |
| The app's own `/api/*` routes, and the beta `database` plugin's `databaseApi` | TanStack Query, from route loaders  | Before the route renders                   |
| AppKit's plugins (`analytics` and the others)                                 | AppKit's data hooks, through `acl/` | When the component calling the hook mounts |

## The app's own endpoints: route loaders

React Router's data routers
[run the loaders of every matched route in parallel](https://reactrouter.com/api/data-routers/createBrowserRouter)
by default. So data from the app's own endpoints is requested in loaders, and
every fetch a page needs starts before anything renders.

```ts
// client/src/acl/invoices.ts
export const openInvoicesQuery = queryOptions({
  queryKey: ["invoices", "open"],
  queryFn: async () => toInvoices(await getJson("/api/invoices?status=open")),
});

// The route's loader starts the request and waits for it.
loader: () => queryClient.query({ ...openInvoicesQuery, staleTime: "static" }),

// The page reads the same cache entry, already filled.
const { data: invoices } = useSuspenseQuery(openInvoicesQuery);
```

- The query options live in `acl/`; the loader and the component share them, so
  both use one cache entry.
- `queryClient.query` with `staleTime: 'static'` returns cached data when there
  is some and fetches when there isn't. It replaces `ensureQueryData`, which
  TanStack Query 5 deprecates and will remove in its next major version.
- **A child route's loader never uses its parent's data.** If both need the same
  thing, both ask for the same query; the cache makes the second request free.
  A child that waits for its parent's result turns two parallel requests into a
  chain.
- Use `useNavigation()` for pending UI while loaders run, and route `lazy` for
  code splitting, so a route's code and data load at the same time.

TanStack Query is installed and wired up from the start, with one `QueryClient`
at the app's root, because the first custom endpoint is close to certain (writes
need one) and because a check that only `acl/` calls `/api/*` needs a place for
those calls to go.

## AppKit's data hooks: at the top of the page

AppKit's hooks (`useAnalyticsQuery` and the others) can't run in a loader: there
is no documented client for analytics queries outside React
([platform.md](platform.md)). A hook's request starts when the component calling
it mounts, and is torn down when the last component using it unmounts. Where a
hook is called therefore decides when its request starts.

So the `acl/` hooks that wrap them are called at the top of each page component,
or in components that always render. Never put a component that fetches behind
another query's loading state:

```tsx
// Wrong: RevenueChart doesn't mount, so its query doesn't start, until the
// customers query has finished. Two warehouse round trips, one after the other.
function AccountPage() {
  const customers = useTopCustomers();
  if (customers.loading) return <Spinner />;
  return (
    <>
      <CustomerTable customers={customers.data} />
      <RevenueChart />
    </>
  );
}

// Right: both requests start when the page mounts. The spinner sits beside the
// chart instead of in front of it.
function AccountPage() {
  const customers = useTopCustomers();
  return (
    <>
      {customers.loading ? <Spinner /> : <CustomerTable customers={customers.data} />}
      <RevenueChart />
    </>
  );
}
```

Two components asking for the same query at the same time share one request,
so calling the same `acl/` hook in two places costs nothing extra while both are
mounted.

## One query, not a chain

When the data for a screen spans tables, write one SQL query with a join rather
than one query whose results feed the parameters of the next. Each round trip
to a warehouse costs seconds, and a cold warehouse reports its start-up before
answering, so every query in a chain can wait again.

## What enforces this

- A structural rule fails on any `fetch` inside a `useEffect` callback, the
  pattern that loads data after render with no cache. Databricks' own example
  code for AppKit apps uses it; this project doesn't.
- A structural rule fails on any call to `/api/*` outside `acl/`, so data from
  the app's own endpoints goes through TanStack Query.
- `@tanstack/eslint-plugin-query` checks how queries are written.
- Placing hooks at the top of a page, and spinners beside rather than in front
  of children, is left to review: no tool can tell whether a component that
  renders conditionally also fetches.
