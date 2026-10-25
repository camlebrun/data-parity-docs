---
title: "Engine support matrix"
description: "Which engines, dbt versions and environments have actually been tested for data-parity, and which have not."
---

What has been run, and what has not. "Tested" means exercised by a script or test suite of the repository; anything
else is stated as untested. Versions are those used when the tests were written.

| Engine / environment | Conformance (hash) | Reconcile / CLI | Cache | Notes |
|---|---|---|---|---|
| **DuckDB**, dbt Fusion 2.0.9 | tested | tested (test bed, pytest, `test_reconcile.sh`) | tested | Main test engine. |
| **DuckDB**, dbt-core 1.12 + dbt-duckdb | tested (1.11 also) | tested | tested | Gives the same per-model results as Fusion. |
| **Trino** 484 in Docker (`memory` catalog), dbt-core + dbt-trino 1.10.6 | tested, identical to DuckDB and BigQuery | tested: DuckDB vs Trino | tested (dry run, refresh, cached pass 1, verify, schema change, version bump) | dbt Fusion has **no** Trino support. The `memory` connector has no row `DELETE`. |
| **Trino**, a real cluster | untested | untested | untested | Authentication, catalogs, time zones, connector quirks: all unknown. |
| **BigQuery**, dbt Fusion | tested (inline, 79 rows, byte-identical to DuckDB and Trino) | one real manual run of `data-parity run` (BigQuery table as side A against a DuckDB table, read-only; see the [example](/data-parity-docs/example/agg-daily-fuel/)); **no automated test of the repository covers BigQuery** | **never executed** (`bigquery__` code written from the documentation); cache writes on BigQuery are untested | Pass 1 bills the bytes of every hashed column. |
| **Windows / PowerShell** | untested | untested | untested | Designed shell-free; [never run](/data-parity-docs/guides/windows/). |
| **Python 3.9** | n/a | declared minimum, **not run** | n/a | Tests ran on a newer Python. |
| Other engines (Snowflake, Postgres, Spark...) | unsupported | unsupported | unsupported | `target.type` other than duckdb, bigquery, trino is a compile error. |

## dbt versions

| dbt | Status |
|---|---|
| dbt Fusion 2.0.9 | tested with DuckDB and BigQuery (conformance) |
| dbt-core 1.11 / 1.12 | tested with DuckDB |
| dbt-core + dbt-trino 1.10.6 | tested with the Docker Trino |
| dbt Fusion + Trino | **not possible**: Fusion has no Trino adapter |

The package declares `require-dbt-version: [">=1.2.0", "<3.0.0"]`; versions between 1.2 and the tested ones were not
run. With Fusion, `tags` and `meta` must be under `config:`. MiniJinja (Fusion) and Jinja2 (dbt-core) both run the
macros with identical DuckDB output.

## Known cross-engine non-equalities

Not forced to be equal, and reported as differences when they occur: floats with `abs(x * 10^6) >= 2^53` (Trino
differs), sub-microsecond timestamps (Trino rounds, DuckDB truncates), `timestamptz` partition days that follow
the session time zone on DuckDB and Trino, string collation, normalisation and `CHAR` padding. Details:
[What is guaranteed](/data-parity-docs/concepts/guarantees/).
