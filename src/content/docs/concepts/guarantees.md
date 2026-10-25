---
title: "What is guaranteed and what is not"
description: "What an identical verdict from data-parity does and does not prove, and the known cross-engine non-equalities."
---

An "identical" verdict from data-parity is precise and narrow. This page states exactly what it covers.

## What an identical verdict means

> For the checked scope and the compared columns, the per-partition count and the two sums of 24-bit MD5 slices of
> canonical row text are equal on both engines.

From that, you may conclude that the two tables hold the same rows **up to** the limits below.

## Limits of the statistical argument

- **Collisions.** Each row contributes 12 hex characters (48 bits) of its MD5, split into two 24-bit sums. The
  chance that a *single* changed row goes undetected by one sum is about 2^-24; the two sums are independent slices
  of the hash. Differences that cancel exactly inside a sum (for example two changed rows whose hash changes offset
  each other) are the residual risk. Drilling to buckets and columns adds further independent groupings.
- **Swaps are caught.** Exchanging a value between two rows changes both rows' whole hashes, so the sums move
  (up to the same collision probability).
- **Row identity is the whole row.** A model without a primary key is compared as a multiset of rows; a changed
  row appears in two buckets.

## What the canonical form does not cover

These are real differences the tool reports as differences, or limits it cannot see past:

| Case | Behaviour |
|---|---|
| Floats with `abs(x * 10^6) >= 2^53` | Trino differs from DuckDB and BigQuery. Not in the conformance set. |
| Floats closer than ~1e-6 | Hash identically (deliberate rounding at scale 6): a blind spot. |
| Timestamps below the microsecond | Trino rounds, DuckDB truncates. Untested. |
| `timestamptz` used as partition | The day depends on the session time zone on DuckDB and Trino (UTC on BigQuery). Set the session to UTC on both sides or partition on a DATE. |
| Strings | No normalisation, trim or collation. `'x '` differs from `'x'`; NFC differs from NFD. Case-insensitive source collations do not change stored bytes and are not applied. |
| `CHAR(n)` | Padding differs by engine: cast to varchar/string upstream. |
| Decimals past 38 digits after scaling | The engine errors. |
| float32 vs float64 | Not equal across engines even for the same number. |
| Unsupported types | array, struct, map, json, bytes, interval, geography: compile error, exclude the column. |
| Case-only column names | Two columns differing only by case are not supported. |

## What is outside the scope of the check

- Anything outside the **checked scope** (`--last`, `--as-of`, undrilled partitions): reported as
  *ISO on the checked scope*, never as plain ISO. See [Exit codes](/data-parity-docs/reference/exit-codes/).
- **Excluded columns**: `meta_*` by default, plus your `exclude_columns`.
- **Untagged models.**
- The **meaning** of the data. Two tables can be byte-for-byte equal and both wrong.
- Whether a difference is *important*. A tool that says "6,479 days differ" cannot say which of them matter.

## What the tool will not do silently

- A dbt failure on either side is exit `2` with **no verdict**, never "identical". If a model is missing on one side
  or the columns/types differ, the report says *structure* differs and skips the deeper passes.
- A partial scope can never produce a plain "ISO".
- The cache never serves a partition whose schema fingerprint or version differs from the current one.

:::caution[Known hole in the cache]
The [closed-partition cache](/data-parity-docs/concepts/cache/) trusts closed partitions. A silent rewrite of an old partition is
invisible to a cached pass 1 until `data_parity_cache_verify` (a sample) or a version bump catches it.
:::
