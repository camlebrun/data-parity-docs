---
title: "Trino, BigQuery and DuckDB notes"
description: "The hash recipe is identical on all three engines; what differs is the dbt setup and what has actually been tested. The full table is the engine support matrix."
---

The hash recipe is identical on all three engines; what differs is the dbt setup and what has actually been tested.
The full table is the [engine support matrix](/data-parity-docs/reference/engine-matrix/).

## DuckDB

- Works with dbt Fusion and with dbt-core + dbt-duckdb. This is the engine of the test bed and of most of the tests.
- Relative `path:` in a profile resolves against the dbt project directory (`--project`).
- A DuckDB file can only be opened by one process in write mode; close other connections if dbt reports a locked file.
- A DuckDB file written by a **newer DuckDB than your dbt binary embeds** is refused
  (`Trying to read a database file with version number ..., but we can only read versions between ...`). Rebuild the
  file with a DuckDB version your dbt supports.
- `timestamptz` partitions: the day depends on the session time zone. Set the session to UTC or partition on a DATE.

## Trino

- **dbt Fusion has no Trino support.** Use dbt-core with dbt-trino for the Trino side, and a different binary on
  the other side if you like:

  ```bash
  data-parity run --a duck --b trino \
    --dbt-a dbt-fusion --dbt-b dbt-core \
    --project-b ./trino_project --profiles-dir-b ./trino_project
  ```

- Tested only on **one Docker container** (Trino 484, `memory` catalog, dbt-trino 1.10.6). **A real cluster has not
  been tested.** Authentication methods other than the container's `none` are untested.
- The `memory` connector has no row `DELETE`, which is why the [cache](/data-parity-docs/concepts/cache/) is append-only by default.
- Timestamps below the microsecond are **rounded** by Trino (`cast(... as timestamp(6))`) where DuckDB truncates:
  columns with nanosecond precision can differ. Untested.
- Float differences: values with `abs(x * 10^6) >= 2^53` print differently on Trino. See
  [What is guaranteed](/data-parity-docs/concepts/guarantees/).
- `timestamptz` partitions follow the session time zone, as on DuckDB.

## BigQuery

- Validated by the **inline conformance test only**: the 79 synthetic rows hash identically to DuckDB and to Trino.
- A real run of the CLI with BigQuery as side A exists (see the [example](/data-parity-docs/example/agg-daily-fuel/)), but **none
  of the repository's test suites runs against BigQuery**, and **the cache has never been executed on BigQuery**. Cache writes there are untested.
- The cache never creates a BigQuery dataset: it must already exist.
- Pass 1 bills the bytes of every hashed column. Use a DATE partition column so that partition pruning applies, and
  bound the scope ([Scope and cost control](/data-parity-docs/guides/scope-and-cost/)).
- A bare `TIMESTAMP` is an instant (UTC calendar day for the partition); `DATETIME` is read as UTC.
- `NUMERIC` and `BIGNUMERIC` are rounded exactly, half away from zero.

:::note[Engine versions]
The conformance set was run with dbt Fusion 2.0.9 on BigQuery and DuckDB, dbt-core 1.11/1.12 with dbt-duckdb on
DuckDB, and dbt-core with dbt-trino 1.10.6 on Trino 484.
:::
