---
title: "CLI reference"
description: "data-parity <command> [options]. Four commands: run, report, conformance, help. The help texts below are the real output of the tool (version 0.1.0)."
---

`data-parity <command> [options]`. Four commands: `run`, `report`, `conformance`, `help`. The help texts below are the
real output of the tool (version 0.1.0).

Models and options may be interleaved: `data-parity run orders --a x --b y` and `data-parity run --a x orders --b y`
are the same. Abbreviated option names are **not** accepted.

## `data-parity help`

Also `-h` and `--help`. Prints this text and exits `0`; `data-parity` with no argument prints it to stderr and exits `2`.
`data-parity --version` (also `-V`, `version`) prints `data-parity 0.1.0`.

```text
usage: data-parity <command> [options]

Check that dbt models are identical on two engines, without moving data.

commands:
  run [MODEL ...]   compare the models (every model tagged data_parity if none is given)
  report RUN_DIR    re-render parity.md from a saved run directory (no dbt call)
  conformance       check that the row hash is portable between the two engines
  help              show this help (also: data-parity <command> --help)

common options:
  --a TARGET --b TARGET     dbt targets of side A and side B
  --dbt-a BIN --dbt-b BIN   dbt binary per side (default: dbt)
  --project DIR             dbt project directory (default: current directory)
  --project-b DIR           project directory of side B, if different
  --profiles-dir-a/-b DIR   dbt profiles directory per side

run options:
  --as-of YYYY-MM-DD        exclude partitions on or after this date (freshness gap is not a content gap)
  --last N                  only the N latest partitions of each model (bounds the scan cost)
  --buckets N               hash buckets per partition (default 256)
  --drill-limit N           max partitions drilled per model (default 200); above it, the drilled
                            partitions are spread evenly from the first to the last differing one
  --detail N                partitions listed inline in the report (default and maximum 15; the
                            complete list is in parity.json)
  --out DIR                 work directory; a fresh run-<timestamp> sub-directory is created inside
  --report FILE             Markdown report path (default: <out>/run-<timestamp>/parity.md);
                            parity.json stays in the run directory
  --json FILE               also write a machine-readable result

report options:
  data-parity report RUN_DIR [--out FILE]   FILE defaults to RUN_DIR/parity.md

Defaults can be stored in ./.data-parity.env (keys A, B and PROJECT_B only):
  A=dev
  B=local

Exit code: 0 identical, 1 differences, 2 error.
```

## `data-parity run`

Compares models between two engines: pass 1 on every selected model, then passes 2 and 3 on what differs
(see [the three passes](/data-parity-docs/concepts/passes/)). Writes `parity.md` and `parity.json`, prints a summary, and exits
`0`, `1` or `2` ([Exit codes](/data-parity-docs/reference/exit-codes/)).

```text
usage: data-parity run [-h] [--a TARGET] [--b TARGET] [--dbt-a BIN]
                       [--dbt-b BIN] [--project DIR] [--project-b DIR]
                       [--profiles-dir-a DIR] [--profiles-dir-b DIR]
                       [--out DIR] [--as-of YYYY-MM-DD] [--last N]
                       [--buckets N] [--drill-limit N] [--detail N|all]
                       [--report FILE] [--json FILE]
                       [MODEL ...]

Exit code: 0 identical, 1 differences, 2 error.

positional arguments:
  MODEL                 models to compare (default: every tagged model)

options:
  -h, --help            show this help message and exit
  --a TARGET            dbt target of side A
  --b TARGET            dbt target of side B
  --dbt-a BIN           dbt binary of side A (default: dbt)
  --dbt-b BIN           dbt binary of side B (default: dbt)
  --project DIR         dbt project directory (default: current directory)
  --project-b DIR       dbt project directory of side B (default: same as
                        --project)
  --profiles-dir-a DIR  dbt profiles directory of side A
  --profiles-dir-b DIR  dbt profiles directory of side B
  --out DIR             work directory; a fresh run-<timestamp> sub-directory
                        is created inside
  --as-of YYYY-MM-DD    exclude partitions on or after this date
  --last N              only the N latest partitions of each model
  --buckets N           hash buckets per partition (default 256)
  --drill-limit N       max partitions drilled per model (default 200)
  --detail N|all        partitions listed inline in the report (default and
                        maximum 15)
  --report FILE         Markdown report path
  --json FILE           machine-readable result path
```

### Selecting what to compare

- `MODEL ...`: Names of dbt models, space or comma separated. Default: every model tagged `data_parity`. An unknown or untagged name
  is an error (exit `2`).

    ```bash
    data-parity run orders customers --a dev --b local
    data-parity run orders,customers --a dev --b local     # same
    ```

- `--a TARGET`, `--b TARGET`: dbt targets of side A and side B (names from `profiles.yml`). Required, unless `A=` and `B=` are in
  `./.data-parity.env`. They also label the two sides in the report.

- `--project DIR`, `--project-b DIR`: dbt project directory (default: the current directory) and, if side B lives in another project, its directory
  (default: the same as `--project`). Each must contain a `dbt_project.yml`; dbt is run with that directory as its
  working directory.

    ```bash
    data-parity run --a duck --b trino --project . --project-b ./trino_project
    ```

- `--dbt-a BIN`, `--dbt-b BIN`: The dbt binary of each side (default `dbt`). Resolved with `PATH` (and `PATHEXT` on Windows) or as a file path.
  Use it to mix dbt Fusion and dbt-core, which is required for Trino (dbt-core only).

- `--profiles-dir-a DIR`, `--profiles-dir-b DIR`: Passed to dbt as `--profiles-dir` for that side.

### Bounding the scan

- `--last N`: Only the N latest partitions of each model. The verdict becomes *ISO on the checked scope* if nothing differs.

    ```bash
    data-parity run orders --a dev --b local --last 30
    ```

- `--as-of YYYY-MM-DD`: Exclude partitions on or after this date (and NULL partitions).

    ```bash
    data-parity run orders --a dev --b local --as-of 2026-10-01
    ```

- `--drill-limit N` (default 200): Maximum differing partitions drilled to buckets and columns, per model. Above it the drilled partitions are an
  evenly spread sample from the first to the last differing one.

- `--buckets N` (default 256): Hash buckets per partition. The same value is used on both sides.

See [Scope and cost control](/data-parity-docs/guides/scope-and-cost/).

### Output

- `--out DIR`: Work directory (default: `<system temp dir>/data-parity/<project name>`). A **fresh** `run-<timestamp>` sub-directory
  is created inside it (`-2`, `-3`... if it exists); nothing already there is touched. It contains `parity.md`,
  `parity.json`, the raw pass outputs `p1_A.txt`, `p1_B.txt`, `p2_*.txt`, `p3_*.txt`, and `raw_*.log` for any failed
  dbt call.

- `--report FILE`: Where to write the Markdown report (default: `<run dir>/parity.md`).

- `--json FILE`: Where to write `parity.json` (default: `<run dir>/parity.json`). When you give `--json`, no copy stays in the run
  directory. Note that `data-parity report` needs `parity.json` in the run directory.

- `--detail N|all` (default and maximum 15): Partitions listed inline in the report. The complete list is always in `parity.json`.

### Defaults file

`./.data-parity.env` provides defaults for `A`, `B` and `PROJECT_B` only (an optional `export ` prefix, quotes and
`# comments` are tolerated; the file is parsed, never executed). Command-line options win.

### What it prints

Progress goes to **stderr** (`data-parity: pass 1 ...`); the per-model summary, the `RESULT:` line, a
`scope_limited:` line when applicable and the `report:` path go to **stdout**. Terminal output is ASCII only.

## `data-parity report`

Re-renders `parity.md` from a saved run directory without calling dbt. Needs `parity.json`, `p1_A.txt` and `p1_B.txt`
in the directory (exit `2` if one is missing). Exit `0` on success.

```text
usage: data-parity report [-h] [--out FILE] RUN_DIR

Re-render parity.md from a saved run directory, without dbt.

positional arguments:
  RUN_DIR     a run directory (parity.json, p1_A.txt, p1_B.txt...)

options:
  -h, --help  show this help message and exit
  --out FILE  Markdown report path (default: RUN_DIR/parity.md)
```

```console
$ data-parity report <work dir>/run-20261025-231011
report: <work dir>/run-20261025-231011/parity.md
```

:::note[Old runs]
A run made by an older version of the tool may hold the first N differing days instead of an even sample; the
regenerated text *spread evenly* is then inexact. Only a new run gives a true even sample.
:::

## `data-parity conformance`

Checks that the row hash is portable between the two engines, on 79 synthetic rows built inline (8 typed columns; no
table is read or created). Run it first on any new pair of engines. It accepts the common options of `run`
(`--a`, `--b`, `--dbt-a`, `--dbt-b`, `--project`, `--project-b`, `--profiles-dir-a`, `--profiles-dir-b`, `--out`).

```text
usage: data-parity conformance [-h] [--a TARGET] [--b TARGET] [--dbt-a BIN]
                               [--dbt-b BIN] [--project DIR] [--project-b DIR]
                               [--profiles-dir-a DIR] [--profiles-dir-b DIR]
                               [--out DIR]

Exit code: 0 identical, 1 differences, 2 error.

options:
  -h, --help            show this help message and exit
  --a TARGET            dbt target of side A
  --b TARGET            dbt target of side B
  --dbt-a BIN           dbt binary of side A (default: dbt)
  --dbt-b BIN           dbt binary of side B (default: dbt)
  --project DIR         dbt project directory (default: current directory)
  --project-b DIR       dbt project directory of side B (default: same as
                        --project)
  --profiles-dir-a DIR  dbt profiles directory of side A
  --profiles-dir-b DIR  dbt profiles directory of side B
  --out DIR             work directory; a fresh run-<timestamp> sub-directory
                        is created inside
```

```console
$ data-parity conformance --a engine_a --b engine_b
IDENTICAL: the hash is portable between engine_a and engine_b (79 rows)
```

Exit `0` identical; `1` with `DIFFERENT: the hash is NOT identical between A and B` and the differing lines;
`2` for any failure (including `incomplete conformance output: N rows on side A, M on side B`).

## Environment

| Variable | Effect |
|---|---|
| `DATA_PARITY_DEBUG` | If set, an unexpected internal error also prints a Python traceback (otherwise only `data-parity: internal error: ...`). |
| `DBT_USE_COLORS`, `NO_COLOR`, `PYTHONIOENCODING`, `PYTHONUTF8` | Set by the tool for the dbt child process **only when you have not set them yourself**, to get plain UTF-8 output. |
