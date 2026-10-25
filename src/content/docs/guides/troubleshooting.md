---
title: "Troubleshooting"
description: "Messages below are the ones the tool and the macros print. Every failure of the CLI exits with code 2."
---

Messages below are the ones the tool and the macros print. Every failure of the CLI exits with code `2`.
First look at the work directory printed as `data-parity: work files: <dir>`: it holds the raw dbt log
(`raw_p1_A.log`, `raw_p1_B.log`, ...) of any failed call, and the saved `p*_A.txt` / `p*_B.txt` outputs.

## Usage and setup

| Message | Cause and remedy |
|---|---|
| `give --a and --b (dbt targets), or put A= and B= in ./.data-parity.env` | Targets not given. Pass `--a` and `--b`. |
| `no dbt_project.yml in <dir> (run from your dbt project or use --project)` | Wrong directory. `cd` into the dbt project or pass `--project` (and `--project-b`). |
| `data-parity: .data-parity.env: key X ignored (only A, B and PROJECT_B are read)` | A warning. Only these three keys are read (never a binary to execute). |
| `dbt binary not found: dbt` | dbt not found for that side. Activate the environment, or give `--dbt-a` / `--dbt-b` the full path. |
| `dbt exited with code 127` / `cannot run <path>: ...` | The binary was found but could not be started. Check the path and permissions. |
| `target 'X' not found in profile '...'` (in the dbt log tail) | Target missing from `profiles.yml`. Check `--a`/`--b` and `--profiles-dir-a/-b`. |
| DuckDB: file not found or locked | DuckDB paths are relative to the project directory (`--project`). Close other connections. |
| DuckDB: `Trying to read a database file with version number ...` | The file was written by a newer DuckDB than your dbt embeds. Rebuild it with a compatible version. |

## dbt side

| Message | Cause and remedy |
|---|---|
| `dbt failed on side B (target X, pass 1): dbt exited with code 1` then `--- last log lines, side B ---` | dbt failed. Read the lines shown and `raw_p1_B.log`; run the same `dbt run-operation data_parity_reconcile --target X` by hand in the right directory. |
| `dbt produced no PARITY output (is the data_parity package installed? run dbt deps)` | Package missing (`dbt deps`), or no model selected. |
| `data_parity: 'only' names no tagged model: X (tagged: ...)` | Misspelled model, or not tagged `data_parity`. |
| `data_parity_reconcile: no model tagged data_parity` / `no model in the outputs: tag your models with data_parity` | Nothing tagged. With dbt Fusion put `tags` and `meta` under `config:`. |
| `model(s) not found in the dbt output: X (missing on side A). Check the spelling...` | The model is absent on one side (disabled, or not tagged on that side). |

## Model configuration

| Message | Cause and remedy |
|---|---|
| `data_parity: unsupported column type '...'` | array, struct, json, bytes...: add the column to `meta.data_parity.exclude_columns`. |
| `... partition column X not found (or excluded)` / `primary key column X not found (or excluded)` | Wrong column name in the meta, or the column is excluded by `exclude_columns` / `exclude_prefixes`. Also what you get if the model is **not built** on that side (no columns found): run `dbt run` first. |
| `partition column X has type class '...'; supported: date, timestamp, integer, string` | Unsupported partition type. |
| `as_of needs a date, timestamp or integer partition column` | `--as-of` on a string partition. |
| `partitions selected 0 of N partitions (check the partition values)` | The explicit `partitions:` list matches nothing. |
| `data_parity: exclude_columns must be a string or a list of strings` / `an empty prefix would exclude everything` | Malformed `meta.data_parity`. |
| `a partition value contains a quote or a backslash; refused` | Unexpected partition value. Choose another partition column. |

## Comparison results

| Symptom | Cause and remedy |
|---|---|
| The report says *structure* differs / `cols` lines differ | The two sides do not have the same columns or logical types. The deeper passes are skipped (hashes are not comparable). Align the models. |
| `malformed PARITY line (...)` | dbt output was altered. Check the tool and package versions, rerun, keep the `run-...` folder. |
| `DIFFERENT: the hash is NOT identical between A and B` (conformance) | Do not continue. See [new engine validation](/data-parity-docs/contributing/new-engine/) and check engine versions. |
| `incomplete conformance output: N rows on side A, M on side B` / `conformance run failed: ...` | A side did not return the 79 rows. Read the dbt log tail. |
| High BigQuery bill | Name the model, use `--last N` / `--as-of`, a DATE partition column, then the cache. |
| A macro of your root project cannot call a package macro | Seen in the test bed. Run package macros via `run-operation`, or copy the macro. |
| `data_parity cache: no cache schema. Pass schema: <name> or set var data_parity_cache_schema` | Intended: the cache has no default schema. |
| `VERIFY` line with `STALE` | A closed partition was rewritten. Delete its cache rows and `refresh`, or bump `data_parity_cache_version`. |

## "Everything differs, I think it is a false alarm"

Before concluding that the data is wrong, rank three hypotheses from cheapest to dearest:

1. **Freshness.** Do both sides have the same source data and the same run time? Cheapest check: rerun with
   `--as-of <date>` on both. If the gap sits in the latest partitions and disappears, it was freshness.
2. **A known cross-engine difference.** Floats beyond 2^53 after scaling, sub-microsecond timestamps, a `timestamptz`
   partition day that follows the session time zone, unicode normalisation, trailing spaces, `CHAR(n)`, an
   approximate versus an exact median, a non-deterministic deduplication. Cheapest check: rerun
   `data-parity conformance`; if it is identical, the hash is not the cause and the gap is in the data or the session.
3. **A real transformation bug.** Compare the compiled SQL of both targets (`dbt compile`) and find the first layer
   where they diverge by running `data-parity run <model>` on staging, intermediate and mart models in turn. The
   column named by pass 3 and the partition are the starting point.

The [example](/data-parity-docs/example/agg-daily-fuel/) walks through this on a real run.
