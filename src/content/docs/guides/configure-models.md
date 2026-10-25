---
title: "Configure your models"
description: "How to select models for the comparison with the data_parity tag or a meta.data_parity block, and how to set the partition column, primary key and excluded columns."
---

A model takes part in the comparison if it is **tagged `data_parity`** or carries a `meta.data_parity` block.
Everything is read from the dbt graph, so the same configuration serves both engines.

## Minimal and full configuration

```yaml title="models/_models.yml"
models:
  - name: orders
    config:
      tags: [data_parity]
      event_time: order_date            # used as partition column when meta.data_parity.partition_column is absent
      meta:
        data_parity:
          primary_key: [order_id]       # else inferred from a unique test / unique_combination_of_columns
          partition_column: order_date
          exclude_columns: [raw_payload]    # string or list; required for array, struct, json, bytes...
          exclude_prefixes: [meta_]         # default: meta_ ; string or list; an empty prefix is refused
          enabled: true
```

:::caution[dbt Fusion: put `tags` and `meta` under `config:`]
With dbt Fusion, keys placed outside `config:` are ignored and the model silently drops out of the comparison
("no model tagged data_parity"). dbt-core accepts both layouts.
:::

| Key | Meaning | Default |
|---|---|---|
| `tags: [data_parity]` | Opts the model in. | none |
| `meta.data_parity.partition_column` | Column used for pass 1 grouping. Types: date, timestamp, integer, string. | `config.event_time` |
| `meta.data_parity.primary_key` | Column(s) defining the bucket and row identity. | inferred from a `unique` test or `dbt_utils.unique_combination_of_columns` |
| `meta.data_parity.exclude_columns` | Columns not compared. Mandatory for unsupported types. | none |
| `meta.data_parity.exclude_prefixes` | Column-name prefixes not compared. | `meta_` |
| `meta.data_parity.enabled` | `false` opts the model out. | `true` |

Opt a model out with `meta: {data_parity: false}` or `enabled: false`.

## What happens in the edge cases

- **No primary key.** Buckets come from the whole-row hash and columns are compared over the whole partition; a
  changed row appears in two buckets.
- **No partition column.** Pass 1 prints only the `table` line (a table-level comparison).
- **Unsupported column type** (array, struct, map, json, bytes, interval, geography). The run stops with a compile error
  `data_parity: unsupported column type '...'`: add the column to `exclude_columns`.
- **Different columns or types on the two sides.** The `cols|` lines differ and the report says *structure* differs;
  the deeper passes are skipped, because the hashes would not be comparable.
- **Excluded columns are never silent.** They appear in the report under **Not checked**.

## Choosing the targets

Name the dbt target of each engine, on the command line or once in `./.data-parity.env`:

```text title=".data-parity.env"
A=dev
B=local
PROJECT_B=../my_other_project
```

Only the keys `A`, `B` and `PROJECT_B` are read; any other key prints a warning and is ignored. In particular a
dbt binary is **never** read from the file: a file checked into a repository must not choose which program runs.

If the two engines live in different dbt projects, give `--project` and `--project-b`. Use `--profiles-dir-a` and
`--profiles-dir-b` when the profiles are not in the default place, and `--dbt-a` / `--dbt-b` when the two sides use
different dbt binaries (for example Fusion on one, dbt-core on the other).

:::note[Relative DuckDB paths]
The tool runs dbt with the project directory as its working directory, so a relative DuckDB `path:` in a profile
resolves against `--project`.
:::
