---
title: "Single-engine dbt projects"
description: "Compare a plain dbt repo, with no multi-engine Jinja, to tables that live on another engine: namespaces, mapping files, model matching, one-sided models and schema mismatches."
---

Your dbt project does **not** need to be written for two engines. No `target.type` branch, no `adapter.dispatch`, no
wiring shared with the other side: the project needs only the `data_parity` package, the
[opt-in](/data-parity-docs/guides/configure-models/) (tag or `meta.data_parity`) and tables that are **already built**.
Models are only *parsed* on each target, never compiled or run on the foreign one, so BigQuery-only SQL in a model body
is never sent to Trino.

This is the shape of a migration: one repo written for the new warehouse (side A, the *target*), compared to the old
tables still living in another engine (side B, the *legacy* side).

## Where each side reads its table

For a model, on one side, the table read is the first of these that exists:

1. the entry of that side's **mapping file** (`--mapping-a` / `--mapping-b`);
2. that side's **namespace** (`--schema-a` / `--schema-b`) with the model's own table name;
3. the project's own **`ref()` / `source()`** relation on that target.

Nothing is hard-coded: a side that reads the repo's own relations needs no option, a side on another engine needs one.

```bash
# one BigQuery repo; side B is Trino, whose tables live in <catalog>.<schema>
data-parity run --a bq --b trino --dbt-b dbt-core \
  --schema-b <catalog>.<schema> --label-a bigquery --label-b trino

# two independent projects, one per engine
data-parity run --a dev --b dev --project ./a --project-b ./b
```

A **namespace** is `[database.]schema`: `catalog.schema` on Trino, `project.dataset` or `dataset` on BigQuery. The
adapter of the side quotes it, so no engine syntax lives in the CLI. With one part, the database of the model's own
relation is kept. More than two parts, a quote or a backslash are refused.

A **mapping file** is for the tables that do not follow the namespace rule, one per line:

```text title="legacy_tables.txt"
# model: [database.]schema.table
fct_orders: legacy.sales.orders_v2
dim_customers: legacy.crm.customers
```

It is parsed, never executed. A model listed twice, or a line that is not `model: [db.]schema.table`, is an error.

## Roles and names

Which side is the legacy one is not a property of the letter. `--legacy a|b` (default `b`) tells the report which is
which, and `--label-a` / `--label-b` give the sides readable names (default: the dbt targets). The hash logic is
symmetric; only the wording changes.

## How models are matched

- **By key.** Models are matched across sides by `meta.data_parity.compare_as` when set, else by name. A model
  `orders_dpv` with `compare_as: orders` is compared with `orders`. Two models of one side with the same key are an
  error that names both.
- **Column names** are matched lower-cased, with every character outside `[a-z0-9_]` replaced by `_`: Trino `order/id`
  and BigQuery `order_id` are the same column, and hash the same. Only the *name* is normalised, never a value. Two
  columns of one side that collide are an error that names both.
- **Tables with no partition column** are compared whole. `--last` and `--as-of` do not apply to them, and the report
  says so under **Not checked**.

## What is a finding, what is an error

| Situation | Result |
|---|---|
| A model is opted in on one side only, or has no table on one side | **Finding**, exit `1`. `only_in_a` / `only_in_b` in [`parity.json`](/data-parity-docs/reference/parity-json/). Worded by role: *only in the legacy side (not migrated yet)* or *only in the target side (no legacy counterpart)*. |
| The compared columns differ between sides (after exclusions and normalisation) | **Finding**, exit `1`: a `schema mismatch` naming the columns of each side. Not a data difference, and the deeper passes are skipped. |
| **No** model of a side has a table | **Error**, exit `2`: the namespace or the mapping is wrong, and the message names the option to fix. |
| dbt fails on a side | **Error**, exit `2`, named by side with the cause and the fix (see [Troubleshooting](/data-parity-docs/guides/troubleshooting/#single-engine-projects)). |

## Excluding columns

Besides `meta.data_parity.exclude_columns` in the project, the command line can leave columns out on both sides:

```bash
data-parity run --a bq --b trino --schema-b <catalog>.<schema> \
  --exclude-column loaded_at --exclude-column fct_orders.raw_payload --exclude-prefix audit_
```

`COL` applies to every model, `MODEL.COL` to one. `meta_` is always excluded unless you pass `--no-default-exclude`.
Excluded columns are listed under **Not checked** in the report, never silently.

## A real run

The repository's [test bed](/data-parity-docs/contributing/test-bed/#real-bigquery-vs-trino) runs exactly this shape: a
real BigQuery dataset against Trino tables, with the corrupted copy giving the expected findings. The report it
produces is shown in [Reading the report](/data-parity-docs/getting-started/reading-the-report/).
