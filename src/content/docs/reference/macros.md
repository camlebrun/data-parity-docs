---
title: "dbt macros and arguments"
description: "The data_parity package (dbt_package/, require-dbt-version: [\">=1.2.0\", \"<3.0.0\"]) exposes six entry points, all run with dbt run-operation <macro> --args '{...}'."
---

The `data_parity` package (`dbt_package/`, `require-dbt-version: [">=1.2.0", "<3.0.0"]`) exposes six entry points,
all run with `dbt run-operation <macro> --args '{...}'`. The CLI calls the first two; the cache macros are for manual
use. Supported adapters: `duckdb`, `bigquery`, `trino`; any other `target.type` is a compile error
(`data_parity supports duckdb, bigquery and trino only`).

Output is always text lines. Lines that start with `PARITY|` are the **contract** compared across engines;
`NOTE|` and `VERIFY|` lines are informational and must never be diffed. Extract the contract with
`sed -n 's/.*PARITY|//p'` and always check dbt's exit code and that the extraction is not empty
(see [the false pass](/data-parity-docs/getting-started/quickstart/#without-the-cli-the-manual-dbt-flow)).

| Macro | Purpose | Writes? |
|---|---|---|
| [`data_parity_reconcile`](#data_parity_reconcile) | Drill-down aggregates (passes 1 to 3) for the tagged models | no |
| [`data_parity_conformance`](#data_parity_conformance) | Cross-engine check of the hash on 79 inline rows | no |
| [`data_parity_cache_refresh`](#cache-macros) | Fill the closed-partition cache | only with `write: true` |
| [`data_parity_cached_pass1`](#cache-macros) | Pass 1 with closed partitions served from the cache | no |
| [`data_parity_cache_verify`](#cache-macros) | Recompute a sample of cached partitions and compare | no |

## `data_parity_reconcile`

```bash
dbt run-operation data_parity_reconcile --args '{only: [orders], level: 1}'
```

Signature: `data_parity_reconcile(only=none, level=3, drill=none, drill_buckets=none, buckets=256, as_of=none, partitions=none)`.
All arguments are optional.

| Argument | Type | Default | Meaning |
|---|---|---|---|
| `only` | list of model names (a lone string is one model) | all tagged models | Restrict to these models. An unknown or untagged name is an error. |
| `level` | `1`, `2` or `3` | `3` | Deepest pass allowed. A pass runs only if its own argument is given. |
| `drill` | `{model: [partition, ...]}` | none | **Pass 2**: bucket aggregates of these partitions. |
| `drill_buckets` | `{model: [[partition, bucket], ...]}` | none | **Pass 3**: per-column sums of these buckets. A bucket `*` means the whole partition (models without a primary key). |
| `buckets` | integer ≥ 1 | `256` | Number of buckets. **Must be identical on both sides.** |
| `as_of` | `'YYYY-MM-DD'` (or integer) | none | Exclude rows whose partition value is `>=` this value, and NULL partitions. Needs a date, timestamp or integer partition column. Ignored (with a note) on a model without a partition column. |
| `partitions` | `{last: N}` or a non-empty list | none | Scope pass 1 and the `table` line to the N latest non-NULL partitions, or to an explicit list. Prints a `scope\|` line. Any other shape, or a selection of 0 partitions on a non-empty table, is a compile error. |

`as_of` is applied before `partitions: {last: N}`.

### Which models and what is compared

A model is in scope if it is tagged `data_parity` or has `config.meta.data_parity`; it is opted out with
`meta: {data_parity: false}` or `enabled: false`. The keys of `meta.data_parity` (`partition_column`, `primary_key`,
`exclude_columns`, `exclude_prefixes`, `enabled`) are described in [Configure your models](/data-parity-docs/guides/configure-models/).

### Output lines

Every line starts with `PARITY|` and is sorted per model:

```text
## orders
cols|amount:decimal,created_at:ts_naive,customer_id:int,is_paid:bool,order_date:date,order_id:int,price_float:float,status:string
pk|order_id
table|rows=200000|h1=1678465531614|h2=1680474608768
part|2025-01-01|rows=1666|h1=14093667896|h2=14128447316
```

| Line | Pass | Meaning |
|---|---|---|
| `## <model>` | | Starts a model. |
| `cols\|<name>:<type_class>,...` | | Column names and type classes. Differs between sides when the structure differs. |
| `pk\|<cols>` or `pk\|none` | | Primary key used. |
| `as_of\|<v>`, `scope\|...`, `note\|...` | | Scope information. |
| `table\|rows=\|h1=\|h2=` | 1 | The sum of the partition lines. |
| `part\|<p>\|rows=\|h1=\|h2=` | 1 | One line per partition. With no partition column, only `table`. |
| `buckets\|<N>` | 2/3 | Printed before the first `bucket` or `col` line. |
| `bucket\|<p>\|<b>\|rows=\|h1=\|h2=` | 2 | Aggregates per (partition, bucket). |
| `col\|<p>\|<b>\|<column>\|rows=\|h1=\|h2=` | 3 | Aggregates of the hash of key + that column. |

`NOTE|<model>|excluded=<columns>` (not a `PARITY|` line) lists the excluded columns; the CLI reads it for the
**Not checked** section.

## `data_parity_conformance`

```bash
dbt run-operation data_parity_conformance | sed -n 's/.*PARITY|//p' > engine_a.txt
```

No argument. Builds an inline synthetic dataset (`select ... union all select ...`) of 8 typed columns, reads and
creates nothing, and prints one line per row id:

```text
PARITY|<id>|s=..|i=..|d=..|f=..|dt=..|ts=..|tn=..|b=..|h1=..|h2=..
```

Run it on both engines: the two outputs (79 lines) must be byte-identical (`diff engine_a.txt engine_b.txt` empty).
This is what `data-parity conformance` automates. Floats with `abs(x * 10^6) >= 2^53` are deliberately not in the set.

## Cache macros

See [The closed-partition cache](/data-parity-docs/concepts/cache/) for the model. Common arguments:

| Argument | Default | Meaning |
|---|---|---|
| `only` | all tagged models | Restrict to these models. |
| `schema` | var `data_parity_cache_schema`, else **none** | Schema of the `data_parity_cache` table. Letters, digits, `_` and `-` only. With no schema, `write: true`, `cached_pass1` and `cache_verify` refuse to run. |
| `lag_days` | `3` | A partition is **closed** if it is older than `reference_date - lag_days`. Integer ≥ 0. |
| `reference_date` | current date | Date from which the cutoff is computed. **Not** the `as_of` of `data_parity_reconcile`: it filters no row. |

### `data_parity_cache_refresh`

`data_parity_cache_refresh(only=none, lag_days=3, reference_date=none, schema=none, write=false)`

Finds closed partitions missing from the cache or stale, computes them live and stores them. **Dry run unless
`write: true`.** `write` accepts a boolean or the strings `true` / `false`.

```bash
dbt run-operation data_parity_cache_refresh --args '{schema: dp_cache}'                 # dry run
dbt run-operation data_parity_cache_refresh --args '{schema: dp_cache, write: true}'    # writes
```

### `data_parity_cached_pass1`

`data_parity_cached_pass1(only=none, lag_days=3, reference_date=none, schema=none, as_of=none, partitions=none)`

Prints the pass-1 contract lines. Closed, trusted partitions come from the cache; open or untrusted ones are scanned
live. Never writes. Passing `as_of` or `partitions` is a **compile error** (`does not support as_of / partitions`): use
`data_parity_reconcile` for a scoped pass 1.

```bash
dbt run-operation data_parity_cached_pass1 --args '{schema: dp_cache}' | sed -n 's/.*PARITY|//p' > side.txt
```

### `data_parity_cache_verify`

`data_parity_cache_verify(only=none, sample=5, schema=none, fail_on_stale=true, lag_days=3, reference_date=none)`

Recomputes `sample` random cached partitions live and prints `VERIFY|OK|...` or `VERIFY|STALE|...`. Fails the run on
`STALE` unless `fail_on_stale: false`.

```bash
dbt run-operation data_parity_cache_verify --args '{schema: dp_cache, sample: 10}'
```

### Project vars

| Var | Default | Effect |
|---|---|---|
| `data_parity_cache_schema` | none | Default cache schema. |
| `data_parity_cache_version` | `'1'` | Bumping it invalidates every cached row. |
| `data_parity_cache_prune` | `false` | `true` deletes superseded rows before inserting (needs a connector with `DELETE`). |

```bash
dbt run-operation data_parity_cache_refresh --vars '{data_parity_cache_version: "2"}' --args '{schema: dp_cache, write: true}'
```

## Building blocks

| Macro | Signature | Use |
|---|---|---|
| `data_parity_canonical` | `(col_expr, data_type, scale=6)` | Canonical text of one value, see [the row hash](/data-parity-docs/concepts/row-hash/). |
| `data_parity_row_hash_parts` | `(columns)` with `columns = [{name: 'id', data_type: 'BIGINT'}, ...]` | Returns `{h1: <sql>, h2: <sql>}`, two integer SQL expressions in [0, 2^24). |

These are the pieces to reuse if you build your own aggregate query.
