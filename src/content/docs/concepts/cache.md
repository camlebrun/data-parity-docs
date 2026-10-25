---
title: "The closed-partition cache"
description: "Pass 1 scans every row once. On a multi-TB table that is the whole cost."
---

Pass 1 scans every row once. On a multi-TB table that is the whole cost. A **closed** partition (older than a lag,
default 3 days before a cutoff date) no longer changes, so its fingerprint can be computed once and kept. Later
runs scan only the **open** partitions, plus any closed partition the cache cannot vouch for.

:::caution[Optional, manual, and partly untested]
- The `data-parity` CLI **does not use the cache**. The cache macros are run by hand with `dbt run-operation`.
- **BigQuery: the cache implementation has never been executed.** The `bigquery__` pieces were written from the
  documentation only. Run `refresh` as a dry run first, then on a scratch dataset, before trusting it.
- The cache trusts closed partitions. A silent rewrite of one is invisible to the cached pass 1.
:::

## The three macros

```bash
dbt run-operation data_parity_cache_refresh --args '{schema: dp_cache}'               # dry run: lists what it WOULD do
dbt run-operation data_parity_cache_refresh --args '{schema: dp_cache, write: true}'  # creates the table, fills closed partitions
dbt run-operation data_parity_cached_pass1  --args '{schema: dp_cache}'               # pass-1 lines, closed ones from the cache
dbt run-operation data_parity_cache_verify  --args '{schema: dp_cache, sample: 10}'   # recompute N cached partitions, compare
```

A real dry run on the test bed (the schema `dp_cache` does not exist and is not created):

```text
NOTE|refresh|mode=DRY RUN (write=false, nothing is created or modified)|cutoff=2026-10-22|lag_days=3|schema=dp_cache|version=1
NOTE|refresh|customers|no partition column: nothing to cache
NOTE|refresh|events_nopk|closed=120|cached_valid=0|stale=0|missing=120
NOTE|refresh|events_nopk|WOULD compute+insert missing: 2025-01-01,2025-01-02,2025-01-03,2025-01-04,...(113 more),2025-04-28,2025-04-29,2025-04-30
NOTE|refresh|orders|closed=120|cached_valid=0|stale=0|missing=120
NOTE|refresh|orders|WOULD compute+insert missing: 2025-01-01,2025-01-02,2025-01-03,2025-01-04,...(113 more),2025-04-28,2025-04-29,2025-04-30
```

Arguments and defaults are in the [macros reference](/data-parity-docs/reference/macros/).

## Output contract

`PARITY|` lines from `data_parity_cached_pass1` are **byte-identical** to a full live pass 1 (tested against an
independent plain grouped query and against `data_parity_reconcile` level 1). Everything informative uses
another prefix (`NOTE|`, `VERIFY|`) so that it never reaches a diff. `sed -n 's/.*PARITY|//p'` extracts the
contract only. Check dbt's exit code and that the file is not empty, as in the
[manual flow](/data-parity-docs/getting-started/quickstart/#without-the-cli-the-manual-dbt-flow).

## Safety defaults

- **No write unless `write: true`.** The default run creates nothing.
- **No default schema.** The schema is the `schema` argument or the var `data_parity_cache_schema`; without either,
  `write: true` and `cached_pass1` refuse to run.
- **Trust rule.** A cached row is used only if its `schema_fp` and `version` equal the current ones; otherwise the
  partition is scanned live.
- **Only aggregates are stored**: counts and sums of hashes, the partition value (a date), the model name and a hash
  of the column-name/type list. No row, key or business value.
- **BigQuery**: the macro never creates the dataset (location and ACLs are a human decision); it must exist.

## The cache table

`<schema>.data_parity_cache(model, partition_value, rows_n, h1_sum, h2_sum, schema_fp, version, computed_at)`, one
table per engine, created `if not exists`. It is **append-only by default**: a recomputed partition inserts a new
row and the newest `computed_at` wins on read, because not every connector supports row `DELETE` (Trino's `memory`
does not). Set var `data_parity_cache_prune: true` to delete superseded rows first (needs `DELETE`).

## Invalidation

| # | Event | What happens |
|---|---|---|
| 1 | Schema change (column added, dropped, renamed, type class changed) | `schema_fp` differs: every cached partition of that model is recomputed. Tested on DuckDB and Trino. |
| 2 | Var `data_parity_cache_version` changed (default `'1'`) | Invalidates everything. Use after a hash definition change or a known backfill. Tested. |
| 3 | A **closed partition is rewritten** (late data older than the lag, a backfill, a fix) | The cache **cannot see it**. `data_parity_cache_verify` recomputes a random sample and reports the partition as `STALE` on a `VERIFY` line (and fails the run unless `fail_on_stale: false`). Tested. |
| 4 | Late data within `lag_days` | Picked up: those partitions are still open and always scanned live. Choose `lag_days` at least as large as your longest normal delay. |
| 5 | A cached partition that no longer exists live | Ignored, as a live scan would. |
| 6 | A model without partition column | Never cached. |

Verify is a **sample, not a proof**: with 1 stale partition out of 100 and `sample: 5`, one run catches it about
5 % of the time. Use a large sample after a known backfill, or bump the version.

## Cost model

- First `refresh --write`: one scan of all closed partitions (the cost of one full pass 1).
- Later `cached_pass1`: about the open partitions (`lag_days` and newer) plus a scan of the partition column alone to
  list the closed days, plus the small cache table. For daily partitions and `lag_days: 3` over three years that is
  about 0.3 % of the data.
- Later `refresh`: only partitions that closed since the previous refresh (about one per day).
- `verify`: `sample` partitions per model.
- Measured on the DuckDB test bed (`orders`, 120 days, `reference_date` 2025-04-10): 96 closed partitions served
  from the cache, 24 scanned live; the compiled SQL shows the only hash scan filtered with
  `"order_date" >= date '2025-04-07'`.
- The cache is tiny: one row of about 100 bytes per model and day.

## Limits

- Partition column must be a DATE, a TIMESTAMP, or castable to a date. Integer and string partitions are not supported
  by the cache.
- The partition list is passed as an `IN (date, ...)` literal: hundreds are fine, tens of thousands are not (the first
  full refresh uses a range predicate).
- No locking: two concurrent refreshes may both insert a partition (harmless, wasted work). Refresh is not atomic
  across partitions (inserts go in batches of 500).
- `NULL` partition rows are always scanned live.
- A byte-identical diff with a stale cache on both sides can hide a corruption present in both caches when they were
  computed: the cache stores what was there then.
- `pk|` and `note|` lines are mirrored from `data_parity_reconcile` only if that macro is installed.
