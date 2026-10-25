---
title: "Scope and cost control"
description: "How to bound the cost of pass 1, which scans every hashed column of every row once per engine, before pointing the tool at a large table."
---

Pass 1 reads every hashed column of every row, once per engine. Bound it before you point the tool at a
large table.

## `--last N`: only the newest partitions

```console
$ data-parity run orders --a engine_a --b engine_b --last 5
orders                   ISO on the checked scope (last 5 partitions; 8,330 rows)

RESULT: ISO on the checked scope (last 5 partitions): all 1 model identical
scope_limited: the verdict covers the checked scope only (last 5 partitions)
```

`--last N` keeps the N latest non-NULL partitions of each model (integer partitions are ordered numerically,
string partitions as text: chronological only for ISO-like values). The result is **never** plain "ISO": the verdict
is *ISO on the checked scope*, the exit code is `0`, and `scope_limited` is `true` in `parity.json`. In the test bed
the five corrupted days are all older, so a `--last 5` run passes while the full run exits `1`. That is the cost of
a bounded scan, stated by the report.

## `--as-of YYYY-MM-DD`: ignore the freshness gap

`--as-of` excludes the partitions on or after the date (and NULL partitions). Use it when one engine was refreshed
later than the other: a freshness gap is not a content gap. The date must be YYYY-MM-DD; a value containing a quote
or a backslash is refused. It needs a date, timestamp or integer partition column (a string partition is an error).

Combine both: `--as-of 2026-10-01 --last 90` compares the 90 partitions before 1 October.
`--as-of` is applied first, then the N latest of what remains. On a model without a partition column both options
are ignored (the macro prints a note) and the whole table is compared.
`--last` first lists the distinct partition values (a scan of the partition column alone) to pick the N latest.

## `--drill-limit N` and the sampling of differing partitions

Pass 2 and pass 3 run on the differing partitions. If more than `--drill-limit` (default 200) partitions differ, only
a sample of that size is drilled:

- The sample is **spread evenly** from the first to the last differing partition, deterministically (first and last
  always included).
- The report states it: *column attribution is based on a sample of 200 of 6,479 differing days, spread evenly
  from 2007-01-03 to 2026-10-24*, and the column shares become shares of the **sampled days**.
- The verdict stays *differences*: sampling only limits how deeply the differences are explained.

Raise `--drill-limit` for a fuller attribution (more queries), lower it for speed. The reason for even spacing is
shown, with real numbers, in the [example](/data-parity-docs/example/agg-daily-fuel/#a-lesson-on-sampling).

## `--detail`: partitions listed in the report

`--detail N` (or `all`) sets how many differing partitions are listed in the Markdown report. **15 is both the
default and the ceiling**: the full list is always in `parity.json` (`differing_partitions`).

## `--buckets N`

Hash buckets per partition (default 256). Rarely needs changing; it is applied identically to both sides.

## Cost in practice

| Engine | Pass 1 cost | Levers |
|---|---|---|
| BigQuery | bytes scanned in every hashed column | `--last`, `--as-of`, a DATE partition column so pruning applies, [the cache](/data-parity-docs/concepts/cache/) (untested on BigQuery), a precise model name instead of the whole project |
| Trino / DuckDB | a full scan of the table | the same options |

Pass 1 is a single `group by` per engine (the compiled SQL shows one `group by dp_p`), so the cost of the
comparison is one grouped scan per engine, plus the small queries of passes 2 and 3 on the differing partitions only.
To estimate before running, use your engine's dry-run facility on the compiled pass-1 SQL.
