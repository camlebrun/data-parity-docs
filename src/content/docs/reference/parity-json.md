---
title: "parity.json schema"
description: "Field-by-field schema of parity.json, the machine-readable result written by data-parity run."
---

`parity.json` is the machine-readable twin of `parity.md`, written by `data-parity run` in the run directory (or at
`--json FILE`). Scripts should read it rather than the Markdown. It holds only row counts, partition values, bucket numbers and
column names (not even the hash sums). UTF-8, indented by two spaces.

## Real example

The `orders` model of the test bed, with the list of differing partitions cut to two entries and the other models
omitted (`models_total` and `models_differing` still count all three):

```json
{
  "tool": "data-parity",
  "verdict": "differences",
  "exit_code": 1,
  "verdict_text": "DIFFERENCES: 3 of 3 models differ",
  "scope_limited": false,
  "scope": "whole tables",
  "started": "2026-10-25 23:10",
  "side_a": {
    "label": "engine_a",
    "target": "engine_a"
  },
  "side_b": {
    "label": "engine_b",
    "target": "engine_b"
  },
  "options": {
    "models": [],
    "buckets": 256,
    "as_of": null,
    "last": null,
    "drill_limit": 200
  },
  "command": "data-parity run --a engine_a --b engine_b",
  "models_total": 3,
  "models_differing": 3,
  "errors": [],
  "error_detail": [],
  "models": [
    {
      "model": "orders",
      "verdict": "diff",
      "rows_a": 200000,
      "rows_b": 199998,
      "delta_rows": -2,
      "primary_key": "order_id",
      "partitioned": true,
      "partitions_total": 120,
      "partitions_differing": 5,
      "partitions_not_drilled": 0,
      "columns": [
        {
          "column": "amount",
          "affected": 1
        },
        {
          "column": "price_float",
          "affected": 1
        },
        {
          "column": "status",
          "affected": 1
        }
      ],
      "differing_partitions": [
        {
          "partition": "2025-01-11",
          "kind": "rows",
          "rows_a": 1667,
          "rows_b": 1664,
          "drilled": true,
          "differing_buckets": [
            "29",
            "208",
            "233"
          ],
          "differing_columns": []
        },
        {
          "partition": "2025-01-21",
          "kind": "hash",
          "rows_a": 1667,
          "rows_b": 1667,
          "drilled": true,
          "differing_buckets": [
            "74",
            "246"
          ],
          "differing_columns": [
            "amount"
          ]
        }
      ],
      "table_level_buckets": [],
      "structure_diff": [],
      "notes": [],
      "scope": [],
      "excluded_columns": "meta_loaded_at",
      "comment": ""
    }
  ]
}
```

## Top level

| Field | Type | Meaning |
|---|---|---|
| `tool` | string | Always `"data-parity"`. |
| `verdict` | string | `identical`, `identical_scoped`, `differences` or `error`. See [Exit codes](/data-parity-docs/reference/exit-codes/). |
| `exit_code` | integer | `0`, `1` or `2`, the process exit code. |
| `verdict_text` | string | The `RESULT:` line, for example `DIFFERENCES: 3 of 3 models differ`. |
| `scope_limited` | boolean | `true` if the verdict covers a limited scope (`--last`, `--as-of`) or some differing partitions were not drilled. |
| `scope` | string | `"whole tables"` or a description such as `"last 5 partitions"` or `"last 30 partitions / before 2026-10-01"`. |
| `started` | string | Local start time, `YYYY-MM-DD HH:MM`. |
| `side_a`, `side_b` | object | `{"label": ..., "target": ...}`: the label shown in the report and the dbt target. |
| `options` | object | `models` (list, empty = every tagged model), `buckets`, `as_of` (string or null), `last` (integer or null), `drill_limit`. |
| `command` | string | The exact command to reproduce the run (default values are omitted). |
| `models_total`, `models_differing` | integer | Counts over all models compared. |
| `errors`, `error_detail` | list of strings | The error message(s) and the dbt log tails when `verdict` is `error`; otherwise empty. |
| `models` | list | One object per model, below. |

## Per model

| Field | Type | Meaning |
|---|---|---|
| `model` | string | dbt model name. |
| `verdict` | string | `iso`, `diff` or `structure` (columns, types, key or presence differ between sides). |
| `rows_a`, `rows_b` | integer or null | Total rows on each side (within the scope). |
| `delta_rows` | integer or null | `rows_b - rows_a`. |
| `primary_key` | string | Comma-separated key columns, or `none`. |
| `partitioned` | boolean | Whether the model has a partition column. |
| `partitions_total` | integer | Distinct partitions seen on either side (0 if unpartitioned). |
| `partitions_differing` | integer | Number of differing partitions, **all of them**. |
| `partitions_not_drilled` | integer | How many of those were not drilled to buckets and columns because of `--drill-limit`. |
| `columns` | list | Ranked `{"column": ..., "affected": n}`: partitions (or buckets, for an unpartitioned model) in which the column differs. When `partitions_not_drilled` is non-zero these counts are over the sampled partitions only. |
| `differing_partitions` | list | **Every** differing partition, not just the 15 listed in the Markdown. See below. |
| `table_level_buckets` | list | For an unpartitioned model: `{"bucket", "kind", "rows_a", "rows_b"}`. |
| `structure_diff` | list of strings | What differs when `verdict` is `structure`. |
| `notes` | list of strings | Informational notes from the macro (for example, no partition column). |
| `scope` | list of strings | Scope lines from the macro: `|`-separated `key=value` fields (`last`, `checked`, `total`, `from`, `to`). |
| `excluded_columns` | string | Comma-separated excluded columns. |
| `comment` | string | Rare: for example `table totals differ although no partition does; not drilled`. |

### `differing_partitions[]`

| Field | Type | Meaning |
|---|---|---|
| `partition` | string | Partition value (a date such as `2025-01-11`, or the text of the value). |
| `kind` | string | `hash`: same row count, different hashes (changed values). `rows`: row counts differ (missing or extra rows). `onlyA` / `onlyB`: the partition exists on one side only. |
| `rows_a`, `rows_b` | integer | Row counts. |
| `drilled` | boolean | Whether pass 2 and 3 ran on this partition. `false` means "not sampled". |
| `differing_buckets` | list of strings | Buckets that differ (empty if not drilled). |
| `differing_columns` | list of strings | Columns that differ (empty if not drilled, or if the row set differs). |

## Reading it from a script

```python
import json
j = json.load(open("parity.json"))
assert j["verdict"] != "error"                      # no verdict: do not treat as a pass
whole_table_ok = j["verdict"] == "identical" and not j["scope_limited"]
for m in j["models"]:
    if m["verdict"] != "iso":
        print(m["model"], m["partitions_differing"], "differing partitions")
```

## Scoped run

For comparison, the beginning of the `parity.json` of `data-parity run orders --last 5` on the same data
(`verdict` is `identical_scoped`, `scope_limited` is `true`, and the model carries a `scope` line):

```json
{
  "verdict": "identical_scoped",
  "exit_code": 0,
  "verdict_text": "ISO on the checked scope (last 5 partitions): all 1 model identical",
  "scope_limited": true,
  "scope": "last 5 partitions",
  "models": [{"model": "orders", "verdict": "iso", "rows_a": 8330, "rows_b": 8330, "scope": ["last=5|checked=5|total=120|from=2025-04-26|to=2025-04-30"], "...": "..."}]
}
```
