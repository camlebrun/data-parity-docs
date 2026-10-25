---
title: "Validating the hash on a new engine"
description: "How to add a new engine: implement the canonical row text for it and prove that it hashes the conformance set exactly like the others."
---

The whole approach rests on one property: **the same canonical row text and the same MD5 slices on every engine**.
Supporting a new engine means proving that property again. Do not skip it: a wrong hash does not fail, it silently
reports differences (or, worse, hides them).

## The procedure

1. **Write the adapter pieces** in `dbt_package/macros/`: the `<adapter>__` implementations next to the existing
   `duckdb__` and `bigquery__` ones (and `default__`, which is written for Trino/ANSI) in `canonical.sql` and
   `row_hash.sql`: canonical text per type class, MD5 to hex, hex slice to integer, the string type. Add the adapter to
   the `data_parity_guard_target` list (today `duckdb`, `bigquery`, `trino`) and to `data_parity_conformance_types`
   (the 8 column types used by the conformance set).
2. **Run the conformance macro on the new engine and on a reference engine** (DuckDB is the usual one):

    ```bash
    dbt run-operation data_parity_conformance --target new   | sed -n 's/.*PARITY|//p' > new.txt
    dbt run-operation data_parity_conformance --target duck  | sed -n 's/.*PARITY|//p' > duck.txt
    wc -l new.txt duck.txt   # 79 lines each; a failed run gives 0 and a plain diff would then say "identical"
    diff new.txt duck.txt    # must print nothing
    ```

   or, equivalently, `data-parity conformance --a new --b duck`, which exits `0` with `IDENTICAL: the hash is portable
   between new and duck (79 rows)` or `1` with the differing lines.
3. **Read every differing line**: each line is one synthetic row id with `s=` (string), `i=` (bigint), `d=` (decimal),
   `f=` (float), `dt=` (date), `ts=` (timestamptz), `tn=` (naive timestamp), `b=` (boolean) and the two hashes. A
   difference in a field names the type to fix. The set covers NULLs, trailing and leading spaces, `|` characters,
   unicode (including emoji and combining characters), int64 extremes, decimal rounding on the half boundary, floats
   (`NaN`, `Infinity`, `-0.0`), dates from 0001 to 9999 and timestamps with microseconds, negative epochs, time zone
   offsets.
4. **Compare against the other engines too** (BigQuery and Trino outputs are the same 79 lines): the property is
   transitive only if every pair is identical.
5. **Extend the set deliberately.** The set intentionally excludes floats with `abs(x * 10^6) >= 2^53` (Trino differs),
   strings with single quotes or backslashes (literal escaping differs) and strings with newlines (the output is line
   oriented). If your engine shows a new non-equality, document it in `docs/canonical-spec.md` under *Known cross-engine
   non-equalities* rather than hiding it.
6. **Run the real thing** on a fixture: load the test bed into the new engine as `load_trino.py` does for Trino,
   compare it with DuckDB `engine_a` (must be identical) and with `engine_b` (must reproduce the ground truth in
   [Test bed](/data-parity-docs/contributing/test-bed/)).
7. **Cache** (optional): the adapter-specific pieces are in `cache_adapters.sql` (fully qualified names, types, date
   arithmetic, random). Test dry run, refresh, cached pass 1 and verify, the schema change and the version bump.
   Remember that not every connector supports row `DELETE`.

## When conformance reports DIFFERENT

Do not use the pair for comparisons. The usual suspects, from [the canonical form](/data-parity-docs/concepts/row-hash/): decimal
arithmetic past 38 digits, the float path, timestamp precision (rounding versus truncation), the case of the hex digits
of the MD5, string length counted in bytes instead of characters, a time zone applied to naive timestamps.

## What a pass does and does not establish

A passing conformance proves the hash for the 79 rows and the type classes they cover. It does not prove every
possible value. State in the support matrix exactly what was run.
