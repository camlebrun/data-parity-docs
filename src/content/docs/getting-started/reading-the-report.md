---
title: "Reading the report"
description: "A guided tour of a real parity.md report, section by section, and what each verdict and exit code means."
---

`data-parity run` prints a short summary and writes two files in the run directory: `parity.md` for people and
`parity.json` for scripts ([schema](/data-parity-docs/reference/parity-json/)). This page walks through a real `parity.md`, then
explains every verdict.

The report contains **only** counts, sums of hashes, partition values, bucket numbers and column names. No row, no
key, no business value. Partition values are printed: if they are sensitive, choose a coarse partition column.

## A real report, section by section

The report below is the real output of `data-parity run --a engine_a --b engine_b` on the repository's test bed (see
[Test bed](/data-parity-docs/contributing/test-bed/); its ground truth is known, so every line can be checked). The only edit is
the removal of the run date.

<details>
<summary>The full report (click to expand)</summary>


```markdown
# Parity report

> ❌ **Differences found**: 3 of 3 models differ.

| | |
|---|---|
| Engine A | `engine_a` (dbt target `engine_a`) |
| Engine B | `engine_b` (dbt target `engine_b`) |
| Compared | counts and sums of per-row hashes, by partition, then by hash bucket (256 buckets), then by column |
| Scope | whole tables |
| Models | every tagged model (3) |

## Not checked

- **Excluded columns** (by configuration, `meta.data_parity`): `customers`: `meta_loaded_at`; `events_nopk`: `meta_loaded_at`; `orders`: `meta_loaded_at`.
- **Untagged models**: only models tagged `data_parity` (or with `meta.data_parity`) are part of the comparison.

## Overview

| model | verdict | rows engine_a | rows engine_b | Δ rows | partitions differing | main columns |
|---|---|--:|--:|--:|---|---|
| `customers` | ❌ differs | 5,000 | 5,000 | 0 | table-level | `city` |
| `events_nopk` | ❌ differs | 20,010 | 20,010 | 0 | 1/120 (0.8%) | `value` |
| `orders` | ❌ differs | 200,000 | 199,998 | -2 | 5/120 (4.2%) | `amount`, `price_float`, `status` |

## Differences

### ❌ `customers`

> Values differ in `city` (no partition column, so the whole table was compared).

- rows: engine_a = 5,000, engine_b = 5,000 (Δ 0)
- primary key: `customer_id`
- note: no partition column: table line only, buckets are taken table-wide (partition value *)

**Differing columns** (ranked)

| column | buckets affected | share of differing buckets |
|---|--:|--:|
| `city` | 1 | 100% |

**Differing buckets**

| bucket | what | rows engine_a | rows engine_b |
|---|---|--:|--:|
| 18 | same row count, different hashes: changed values | 26 | 26 |

### ❌ `events_nopk`

> Values changed in 1 of 120 days, all in `value` (1 of all 1 differing day with changed values); column attribution covers all 1 differing day.

- rows: engine_a = 20,010, engine_b = 20,010 (Δ 0)
- primary key: none (buckets come from the full-row hash)
- partitions differing: **1 of 120** (0.8%)

No primary key: a changed row appears in TWO buckets (old and new version), so columns are compared over the whole partition, not per bucket.

**Differing columns** (ranked). Shares are relative to all 1 differing day with changed values.

| column | days affected | share of differing days |
|---|--:|--:|
| `value` | 1 | 100% |

**Nature of the differences**

| nature | days |
|---|--:|
| changed values (same row count) | 1 |
| missing or extra rows | 0 |

**Timeline**: first differing day `2025-01-06`, last `2025-01-06`.

| period | differing | of | share of the period | |
|---|--:|--:|--:|---|
| 2025-01 | 1 | 31 | 3.2% | ██████████ |

**Differing days**.

| partition | what | rows engine_a | rows engine_b | buckets | columns |
|---|---|--:|--:|---|---|
| 2025-01-06 | same row count, different hashes: changed values | 168 | 168 | 2: 16, 50 | `value` |

### ❌ `orders`

> Values changed in 3 of 120 days, spread over 3 columns (mostly `amount`, 1 of all 3 differing days with changed values); missing or extra rows in 2 days (net -2 rows); column attribution covers all 5 differing days.

- rows: engine_a = 200,000, engine_b = 199,998 (Δ -2)
- primary key: `order_id`
- partitions differing: **5 of 120** (4.2%)

**Differing columns** (ranked). Shares are relative to all 3 differing days with changed values.

| column | days affected | share of differing days |
|---|--:|--:|
| `amount` | 1 | 33% |
| `price_float` | 1 | 33% |
| `status` | 1 | 33% |

**Nature of the differences**

| nature | days |
|---|--:|
| changed values (same row count) | 3 |
| missing or extra rows | 2 |

**Timeline**: first differing day `2025-01-11`, last `2025-03-02`.

| period | differing | of | share of the period | |
|---|--:|--:|--:|---|
| 2025-01 | 3 | 31 | 9.7% | ██████████ |
| 2025-02 | 1 | 28 | 3.6% | ████░░░░░░ |
| 2025-03 | 1 | 31 | 3.2% | ███░░░░░░░ |

**Differing days**.

| partition | what | rows engine_a | rows engine_b | buckets | columns |
|---|---|--:|--:|---|---|
| 2025-01-11 | row counts differ: missing or extra rows | 1,667 | 1,664 | 3: 29, 208, 233 | n/a (row set differs) |
| 2025-01-21 | same row count, different hashes: changed values | 1,667 | 1,667 | 2: 74, 246 | `amount` |
| 2025-01-31 | same row count, different hashes: changed values | 1,667 | 1,667 | 1: 125 | `status` |
| 2025-02-20 | same row count, different hashes: changed values | 1,667 | 1,667 | 2: 135, 185 | `price_float` |
| 2025-03-02 | row counts differ: missing or extra rows | 1,667 | 1,668 | 1: 48 | n/a (row set differs) |

## How to reproduce

```
data-parity run --a engine_a --b engine_b
```

Tool: data-parity 0.1.0. Exit codes: 0 identical, 1 differences, 2 error.

**What this proves, and what it does not.** Each engine computes, per partition, the row count and the sum of per-row hashes (two independent hash sums); only these aggregates are compared, no row leaves the warehouse. Equal aggregates mean the tables are equal up to a hash collision or errors that cancel exactly inside a sum (probability about 2^-24 per sum for a single change). It does not check anything outside the scope above, excluded columns, or the meaning of the data.
```

</details>

### 1. Banner and header table

```markdown
> ❌ **Differences found**: 3 of 3 models differ.
```

The banner is the verdict. Four possible banners (details [below](#verdicts)). The table under it records the date,
the two engines and their dbt targets, what was compared (always: counts and sums of per-row hashes, by partition,
then by hash bucket, then by column), the **scope** (`whole tables`, or for example `the last 5 partitions per
model`) and the models.

### 2. Not checked

```markdown
## Not checked

- **Excluded columns** (by configuration, `meta.data_parity`): `customers`: `meta_loaded_at`; ...
- **Untagged models**: only models tagged `data_parity` (or with `meta.data_parity`) are part of the comparison.
```

This section is the honesty clause of the report: everything that was **not** verified. It lists, when they apply:
older partitions skipped by `--last`, partitions excluded by `--as-of`, differing partitions not drilled because of
`--drill-limit` (the column attribution is then a sample), columns excluded by configuration (by default every
column starting with `meta_`), and untagged models.

### 3. Overview

One row per model: verdict, row count on each side, delta, how many partitions differ, and the main differing
columns. `table-level` means the model has no partition column, so only the whole table was compared.

### 4. Per-model section

For each model that differs:

- **A one-sentence diagnosis**, for example *Values changed in 3 of 120 days, spread over 3 columns (mostly
  `amount`...); missing or extra rows in 2 days (net -2 rows)*.
- **Differing columns (ranked)**: for each column, in how many days (or, without a partition column, buckets) it
  differs, and the share of the differing days with changed values. When the drill was sampled (see
  [Scope and cost control](/data-parity-docs/guides/scope-and-cost/) and [the next section](#when-the-drill-is-sampled)),
  the headers become **sampled days affected** and **share of sampled days**, and the shares are relative to the
  sampled days only: see [the real example](/data-parity-docs/example/agg-daily-fuel/).
- **Nature of the differences**: `changed values (same row count)` (the day has the same number of rows on both
  sides but the hashes differ) versus `missing or extra rows` (the counts differ).
- **Timeline**: first and last differing day, and the share of differing days per period: per month when the data spans
  at most two years, else per year, else per decade, whichever first fits in 15 rows. Only models partitioned by a
  date get one.
- **Differing days**: an inline table of at most 15 rows (`--detail` can lower this ceiling but not raise it; the
  complete list is in `parity.json`). Each row gives the partition, what kind of difference, the row counts, the
  **buckets** involved and the **columns**. When there are more than 15 differing days, the rows are chosen among the
  sampled days (so they all show buckets and columns), spread evenly, after up to 3 row-count-only days; a day that
  was not drilled shows `not sampled`.

A day with a missing row and a changed value in the same bucket has no attributed column (`n/a (row set differs)`),
because pass 3 only runs on buckets whose row counts are equal.

Without a primary key, a changed row lands in **two** buckets (its old and new version), so columns are compared over
the whole partition instead of per bucket; the report says so.

### 5. How to reproduce

The exact command, the tool version and a reminder of what the check proves and does not prove. Copy the command
to rerun the comparison.

## When the drill is sampled

By default up to 200 differing partitions per model are drilled (`--drill-limit`). Above that limit, the tool drills
a deterministic sample spread evenly from the first to the last differing day, and says so. The test bed has only
five differing days, so this run forces the situation with `--drill-limit 3` (real output, run date removed, other
sections unchanged). The `orders` section then reads:

```markdown
> Values changed in 3 of 120 days, all in `status` (1 of the 1 sampled day with changed values); missing or extra rows in 2 days (net -2 rows); column attribution is based on a sample of 3 of 5 differing days, spread evenly from 2025-01-11 to 2025-03-02.

**Differing columns** (ranked). Shares are relative to the 1 sampled day with changed values.

| column | sampled days affected | share of sampled days |
|---|--:|--:|
| `status` | 1 | 100% |

**Differing days**.

| partition | what | rows engine_a | rows engine_b | buckets | columns |
|---|---|--:|--:|---|---|
| 2025-01-11 | row counts differ: missing or extra rows | 1,667 | 1,664 | 3: 29, 208, 233 | n/a (row set differs) |
| 2025-01-21 | same row count, different hashes: changed values | 1,667 | 1,667 | not sampled | not sampled |
| 2025-01-31 | same row count, different hashes: changed values | 1,667 | 1,667 | 1: 125 | `status` |
| 2025-02-20 | same row count, different hashes: changed values | 1,667 | 1,667 | not sampled | not sampled |
| 2025-03-02 | row counts differ: missing or extra rows | 1,667 | 1,668 | 1: 48 | n/a (row set differs) |
```

The **Not checked** section gains a line saying that column attribution is sampled for `orders` (`--drill-limit 3`),
the overview lists only the columns found in the sample (`status`, whereas the full run finds `amount`,
`price_float` and `status`), and the 2 unsampled days are compared at partition level only. Read the column shares
of such a report as shares of the sample, not of all differing days.

## Verdicts

The banner, the terminal `RESULT:` line, the `verdict` field of `parity.json` and the exit code always agree.

| Banner | `RESULT:` line | `verdict` (JSON) | Exit code | Meaning |
|---|---|---|--:|---|
| ✅ **Identical** | `ISO: all N models identical` | `identical` | 0 | On the whole tables, every aggregate matched on both engines. |
| ⚠️ **Identical on a limited scope** | `ISO on the checked scope (last 5 partitions): all N models identical` | `identical_scoped` | 0 | Every aggregate matched **inside the checked scope** (`--last`, `--as-of`, or partitions that were not drilled). Nothing is said about the rest. |
| ❌ **Differences found** | `DIFFERENCES: K of N models differ` | `differences` | 1 | At least one model differs, or its structure (columns, types) does. |
| 💥 **No verdict** | `ERROR: no verdict (...)` | `error` | 2 | The comparison could not complete (dbt failed on a side, unknown model or target, bad usage). Nothing is proven, in either direction. |

### "ISO on the checked scope"

A partial scope exits `0` but is **never reported as plain "ISO"**. It is what a run with `--last 5` prints on the
test bed, where the whole-table run exits `1`:

```console
$ data-parity run orders --a engine_a --b engine_b --last 5
orders                   ISO on the checked scope (last 5 partitions; 8,330 rows)

RESULT: ISO on the checked scope (last 5 partitions): all 1 model identical
scope_limited: the verdict covers the checked scope only (last 5 partitions)
```

The five corrupted days of the test bed are all older than the last five days, so a scoped run cannot see them.
That is the point: the verdict text, the banner (`⚠️`), the **Not checked** section and `"scope_limited": true` in
the JSON all say it. A script that treats exit `0` as "tables are equal" must also read `scope_limited`.

### Per-model verdicts

In the overview and in `parity.json` each model is `iso` (identical), `diff` (aggregates differ) or `structure`
(the two sides do not have the same columns, types, key or scope: the hashes are then not comparable and the
deeper passes are skipped; the report says what differs).

## Re-rendering a report

`data-parity report RUN_DIR` regenerates `parity.md` from a saved run directory without calling dbt:

```console
$ data-parity report <work dir>/run-20261025-231011
report: <work dir>/run-20261025-231011/parity.md
```

It needs `parity.json`, `p1_A.txt` and `p1_B.txt` (exit code 2 if one is missing).
