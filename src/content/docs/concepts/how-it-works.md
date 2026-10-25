---
title: "How it works"
description: "How data-parity decides whether table T is the same on engine A and engine B by comparing small hash aggregates instead of rows."
---

data-parity answers one question: *are table T on engine A and table T on engine B the same?* It does so by
comparing small aggregates, never rows.

## The data flow

```mermaid
sequenceDiagram
    participant CLI as data-parity (Python)
    participant A as dbt + engine A
    participant B as dbt + engine B
    CLI->>A: dbt run-operation data_parity_reconcile (pass 1)
    CLI->>B: dbt run-operation data_parity_reconcile (pass 1)
    A-->>CLI: PARITY| lines: per partition rows, sum(h1), sum(h2)
    B-->>CLI: PARITY| lines: per partition rows, sum(h1), sum(h2)
    Note over CLI: equal partitions are done, never scanned again
    CLI->>A: pass 2 for the differing partitions only
    CLI->>B: pass 2 for the differing partitions only
    A-->>CLI: per (partition, bucket) aggregates
    B-->>CLI: per (partition, bucket) aggregates
    CLI->>A: pass 3 for the differing buckets only
    CLI->>B: pass 3 for the differing buckets only
    A-->>CLI: per (partition, bucket, column) aggregates
    B-->>CLI: per (partition, bucket, column) aggregates
    Note over CLI: parity.md + parity.json
```

Each engine runs **its own SQL, through its own dbt**, and prints text lines prefixed `PARITY|`. The CLI keeps those
lines, discards everything else dbt printed, and compares the two sets. No credentials of one engine are ever
given to the other, and there is no connection between them.

## What leaves an engine

```mermaid
flowchart LR
    subgraph engine["Inside the engine"]
      rows["rows<br/>(never leave)"] --> hash["per-row hash<br/>h1, h2 (24-bit integers)"]
      hash --> agg["count(*), sum(h1), sum(h2)<br/>per group"]
    end
    agg --> out["PARITY| lines<br/>(the only output)"]
```

A `PARITY|` line looks like this (real, from the test bed):

```text
part|2025-01-11|rows=1667|h1=13780073098|h2=14154973472
```

The report contains such counts and sums, **partition values** (here a date), **bucket numbers** and **column
names**. It never contains a row, a key or a business value. If your partition values are sensitive, partition on
a coarser column.

## The two pieces

1. **A portable row hash** (dbt macros `data_parity_canonical`, `data_parity_row_hash_parts`). Every column is first
   turned into a canonical text that is the same on every supported engine, then the row is hashed with MD5. See
   [The row hash and canonical form](/data-parity-docs/concepts/row-hash/).
2. **A drill-down** (macro `data_parity_reconcile`, driven by the CLI). Sums of hashes are order independent, so
   two tables agree on a group only if they hold (up to a collision) the same multiset of rows. The CLI starts with
   one coarse grouping and refines only where the aggregates disagree. See
   [Partitions, buckets and the three passes](/data-parity-docs/concepts/passes/).

## Why not `audit_helper` or `EXCEPT`

`audit_helper` compares two relations visible to **one** dbt connection, typically in one warehouse. It cannot compare
BigQuery with DuckDB, or Trino with BigQuery, without moving data, and its row-level comparisons go through
`EXCEPT` or joins on the rows themselves. data-parity exists for the case where the data cannot be copied or
exported and only small outputs can be shared.

## Where it runs and what it needs

- It calls `dbt run-operation` on each side, so everything dbt needs (profiles, credentials, network) must already
  work for that target.
- The mode described here **writes nothing** to either engine. Only the optional
  [closed-partition cache](/data-parity-docs/concepts/cache/) writes, and only when you pass `write: true` to a macro run by hand: the CLI
  does not use the cache.
- The comparison is deterministic: no sampling in the hash, no randomness (the only sampling is the choice of which
  differing partitions to drill when there are more than `--drill-limit`, and it is evenly spaced, not random).
