---
title: "Use in CI"
description: "data-parity is a command-line tool with stable exit codes, so it fits a pipeline step."
---

data-parity is a command-line tool with stable exit codes, so it fits a pipeline step.

## The contract a pipeline can rely on

| Exit code | Meaning | Typical CI reaction |
|--:|---|---|
| `0` | Identical (on the whole tables, or on the checked scope: read `scope_limited`) | pass |
| `1` | Differences found | fail the step, upload the report |
| `2` | Error: no verdict (dbt failed on a side, unknown target or model, bad usage) | fail the step; **never treat as a pass** |

`parity.json` carries the same information plus `scope_limited` and per-model detail: see the
[schema](/data-parity-docs/reference/parity-json/).

:::caution[Exit 0 can be a scoped pass]
With `--last` or `--as-of` (or partitions that could not be drilled) the exit code is `0` and the verdict is
*ISO on the checked scope*. If your gate must mean "the whole table matches", also require
`"scope_limited": false` in `parity.json`.
:::

## A GitHub Actions sketch

:::danger[Untested]
This workflow is an illustration. It has not been run: it needs your own dbt profiles, credentials for both
engines, and a network path from the runner to each of them.
:::

```yaml
name: parity
on:
  workflow_dispatch:
jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install dbt-core dbt-duckdb dbt-bigquery   # whatever your two engines need
      - run: pip install git+https://github.com/camlebrun/data-parity@<tag-or-commit>
      - run: dbt deps
      - name: Compare
        run: |
          data-parity run my_model --a dev --b local --out parity-out --report parity-out/parity.md --json parity-out/parity.json
      - name: Fail if the verdict is scoped
        if: always()
        run: python -c "import json,sys; j=json.load(open('parity-out/parity.json')); sys.exit(1 if j['scope_limited'] else 0)"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: parity-report
          path: parity-out
```

Notes:

- `--report` and `--json` write exactly where you ask; `--out` is the work directory in which a fresh
  `run-<timestamp>` folder is created (raw dbt logs are kept there for a failing dbt call).
- Use a service account with read access only. The normal mode writes nothing.
- The `git+https` install form is the same as [Install](/data-parity-docs/getting-started/install/): it was **not tested**, and
  requires the CLI to be on the referenced revision.
- The report is safe to upload as an artifact in the sense that it holds only counts, hash sums, partition values,
  bucket numbers and column names. If your partition values are sensitive, treat it accordingly.
