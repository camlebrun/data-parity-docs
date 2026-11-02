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

The report below is the real output of `data-parity run --a bq --b trino_b --schema-b local.mart_parity_test_b` on the
repository's BigQuery vs Trino test bed (see [Test bed](/data-parity-docs/contributing/test-bed/); its ground truth is
known, so every line can be checked). A real BigQuery dataset is side A, a deliberately corrupted copy in Trino is side B.
The only edit is the removal of the run date.

<details>
<summary>The full report (click to expand)</summary>

````markdown
# Parity report: BigQuery vs Trino

> ❌ **Differences found**: 3 of 3 models differ.

| | |
|---|---|
| Engine A | `BigQuery` (dbt target `bq`) |
| Engine B | `Trino` (dbt target `trino_b`) |
| Compared | row counts and a fingerprint of every row, per partition, then per column (no data leaves the warehouse) |
| Scope | whole tables |
| Models | every tagged model (3) |

## Overview

| model | verdict | rows BigQuery | rows Trino | Δ rows | partitions differing | main columns |
|---|---|--:|--:|--:|---|---|
| `dim_customers` | ❌ differs | 5,000 | 5,000 | 0 | table-level | `city` |
| `fct_events` | ❌ differs | 20,010 | 20,010 | 0 | 1/120 (0.8%) | `value` |
| `fct_orders` | ❌ differs | 200,000 | 199,998 | -2 | 5/120 (4.2%) | `amount`, `price_float`, `status` |

## Differences

### ❌ `dim_customers`

> Values differ in `city` (no partition column, so the whole table was compared).

- rows: BigQuery = 5,000, Trino = 5,000 (Δ 0)
- primary key: `customer_id`

**To inspect**: compare table `dim_customers` on BigQuery and Trino, matching rows on `customer_id`. Look at the column `city`.

**Differing columns** (ranked)

| column | buckets affected | share of differing buckets |
|---|--:|--:|
| `city` | 1 | 100% |

### ❌ `fct_events`

> Values changed in 1 of 120 days, all in `value` (1 of 1 day); column attribution covers all 1 differing day.

- rows: BigQuery = 20,010, Trino = 20,010 (Δ 0)
- primary key: none
- partitions differing: **1 of 120** (0.8%)

**To inspect**: compare table `fct_events` on BigQuery and Trino for the day `2025-01-06`, comparing whole rows. Look at the column `value`.

**Differing columns** (ranked). Shares are relative to all 1 differing day with changed values.

| column | days affected | share of differing days |
|---|--:|--:|
| `value` | 1 | 100% |

**Nature of the differences**

| nature | days |
|---|--:|
| changed values (same row count) | 1 |
| missing or extra rows | 0 |


**Differing days**.

| partition | what | rows BigQuery | rows Trino | columns |
|---|---|--:|--:|---|
| 2025-01-06 | same row count, different hashes: changed values | 168 | 168 | `value` |

### ❌ `fct_orders`

> Values changed in 3 of 120 days, over 3 columns (`amount`, `price_float`, `status`), one each (1 of 3 days); missing or extra rows in 2 days (net -2 rows); column attribution covers all 5 differing days.

- rows: BigQuery = 200,000, Trino = 199,998 (Δ -2)
- primary key: `order_id`
- partitions differing: **5 of 120** (4.2%)

**To inspect**: compare table `fct_orders` on BigQuery and Trino for the day `2025-01-11`, matching rows on `order_id`.

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

| partition | what | rows BigQuery | rows Trino | columns |
|---|---|--:|--:|---|
| 2025-01-11 | row counts differ: missing or extra rows | 1,667 | 1,664 | n/a (row set differs) |
| 2025-01-21 | same row count, different hashes: changed values | 1,667 | 1,667 | `amount` |
| 2025-01-31 | same row count, different hashes: changed values | 1,667 | 1,667 | `status` |
| 2025-02-20 | same row count, different hashes: changed values | 1,667 | 1,667 | `price_float` |
| 2025-03-02 | row counts differ: missing or extra rows | 1,667 | 1,668 | n/a (row set differs) |

## Not checked

- **Excluded columns** (by configuration, `meta.data_parity`): `dim_customers`: `meta_loaded_at`; `fct_events`: `meta_loaded_at`; `fct_orders`: `meta_loaded_at`.
- **Untagged models**: only models tagged `data_parity` (or with `meta.data_parity`) are part of the comparison.

## How to reproduce

```
data-parity run --a bq --b trino_b --schema-b local.mart_parity_test_b --label-a BigQuery --label-b Trino
```

Tool: data-parity 0.1.0. Exit codes: 0 identical, 1 differences, 2 error.

**Limits.** Identical means identical on what was compared (see the scope and "Not checked"); it does not look at the meaning of the data. A difference this small could in theory go unseen only by a rare hash collision (about 1 in 16 million per change).
````

</details>

The default report is meant to be read, not parsed: hash buckets and method details are left out. Add `--technical` to
get them back, `--no-hint` to drop the **To inspect** line and `--no-timeline` to drop the per-month table. These three
options are accepted by `data-parity run` and by `data-parity report`.


### 1. Banner and header table

```markdown
> ❌ **Differences found**: 3 of 3 models differ.
```

The banner is the verdict. Four possible banners (details [below](#verdicts)). The table under it records the two
engines and their dbt targets (the names come from `--label-a` / `--label-b`, else the targets), what was compared
(counts and a fingerprint of every row, per partition, then per column), the **scope** (`whole tables`, or for example
`last 5 partitions`) and the models.

### 2. Overview

One row per model: verdict, row count on each side, delta, how many partitions differ, and the main differing
columns. `table-level` means the model has no partition column, so only the whole table was compared. A model found
on one side only, or whose columns differ between the sides, has its own verdict here
(see [Per-model verdicts](#per-model-verdicts)).

### 3. Per-model section

For each model that differs:

- **A one-sentence diagnosis**, for example *Values changed in 3 of 120 days, over 3 columns (`amount`, ...), one each;
  missing or extra rows in 2 days (net -2 rows)*.
- **To inspect**: where to look in your own warehouse (the table, the day, the key to match rows on, the column).
  `--no-hint` removes it.
- **Differing columns (ranked)**: for each column, in how many days (or, without a partition column, buckets) it
  differs, and the share of the differing days with changed values. When the drill was sampled (see
  [Scope and cost control](/data-parity-docs/guides/scope-and-cost/) and [the next section](#when-the-drill-is-sampled)),
  the headers become **sampled days affected** and **share of sampled days**, and the shares are relative to the
  sampled days only: see [the real example](/data-parity-docs/example/agg-daily-fuel/).
- **Nature of the differences**: `changed values (same row count)` (the day has the same number of rows on both
  sides but the hashes differ) versus `missing or extra rows` (the counts differ).
- **Timeline**: first and last differing day, and the share of differing days per period: per month when the data spans
  at most two years, else per year, else per decade, whichever first fits in 15 rows. Only models partitioned by a
  date get one. `--no-timeline` removes the table.
- **Differing days**: an inline table of at most 15 rows (`--detail` can lower this ceiling but not raise it; the
  complete list is in `parity.json`). Each row gives the partition, what kind of difference, the row counts and the
  **columns**; with `--technical` it also gives the **buckets** involved. When there are more than 15 differing days,
  the rows are chosen among the sampled days (so they all show columns), spread evenly, after up to 3 row-count-only
  days; a day that was not drilled shows `not sampled`.

A day with a missing row and a changed value in the same bucket has no attributed column (`n/a (row set differs)`),
because pass 3 only runs on buckets whose row counts are equal.

Without a primary key, a changed row lands in **two** buckets (its old and new version), so columns are compared over
the whole partition instead of per bucket; the report says so (in the method details with `--technical`).

### 4. Not checked

```markdown
## Not checked

- **Excluded columns** (by configuration, `meta.data_parity`): `dim_customers`: `meta_loaded_at`; ...
- **Untagged models**: only models tagged `data_parity` (or with `meta.data_parity`) are part of the comparison.
```

This section is the honesty clause of the report: everything that was **not** verified. It lists, when they apply:
older partitions skipped by `--last`, partitions excluded by `--as-of`, models without a partition column where
`--last` / `--as-of` do not apply, differing partitions not drilled because of `--drill-limit` (the column attribution
is then a sample), columns excluded by configuration or by `--exclude-column` / `--exclude-prefix` (by default every
column starting with `meta_`), and untagged models.

### 5. How to reproduce

The exact command, the tool version and a reminder of what the check proves and does not prove. Copy the command
to rerun the comparison.

## When the drill is sampled

By default up to 200 differing partitions per model are drilled (`--drill-limit`). Above that limit, the tool drills
a deterministic sample spread evenly from the first to the last differing day, and says so. The test bed has only
five differing days, so this run forces the situation with `--drill-limit 3` (real output, run date removed, other
sections unchanged, and with `--technical`, which adds the **buckets** column that the default report leaves out). The `orders` section then reads:

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
(the two sides are not comparable: the hashes are then not comparable and the deeper passes are skipped). A `structure`
model is one of three cases, told apart by `structure_kind` in `parity.json`:

| Overview says | `structure_kind` | Meaning |
|---|---|---|
| `only in <legacy side>` / `only in <target side>` | `only_a` / `only_b` | The model is opted in, or has a table, on one side only. A finding (exit `1`), not an error. Worded by role: *not migrated yet* for the legacy side, *no legacy counterpart* for the target side (see `--legacy`). |
| `schema mismatch` | `schema` | The compared columns (after exclusions and name normalisation) differ. The report names the columns found on one side only; it is not a data difference. |
| `structure` | other | Types, key or scope differ between the sides. |

See [Single-engine dbt projects](/data-parity-docs/guides/single-engine-projects/) for how models are matched across sides.

## Re-rendering a report

`data-parity report RUN_DIR` regenerates `parity.md` from a saved run directory without calling dbt:

```console
$ data-parity report <work dir>/run-20261025-231011
report: <work dir>/run-20261025-231011/parity.md
```

It needs `parity.json`, `p1_A.txt` and `p1_B.txt` (exit code 2 if one is missing).
