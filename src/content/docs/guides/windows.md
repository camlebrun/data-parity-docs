---
title: "Windows and PowerShell"
description: "The tool uses no shell and was designed to behave identically on Windows, but it has never been executed on Windows or in PowerShell."
---

:::danger[Never run on Windows]
The tool uses no shell and was designed to behave identically on Windows, but **it has never been executed on
Windows or in PowerShell**. Every PowerShell snippet in this documentation is unverified. Treat this page as
design intent, and please report what you find.
:::

## What was designed for Windows

- **No shell is involved.** `dbt` is called with a list of arguments (`shell=False`), so the JSON in `--args` is a
  single argument with no quoting rules to learn.
- **Binary resolution** uses `PATH` and `PATHEXT`, so `dbt.exe`, `dbt.cmd` and `dbt.bat` are found. If dbt lives in a
  virtual environment that is not activated, pass the full path:

  ```powershell
  data-parity run my_model --a dev --b local --dbt-a C:\path\to\venv\Scripts\dbt.exe
  ```

  `dbt binary not found: dbt` means the name was not found: activate the environment or pass the path.
- **Console output is pure ASCII**: non-ASCII characters in the terminal summary are replaced by `\uXXXX`, so
  code pages such as cp1252 or cp850 do not produce garbage. `parity.md` and `parity.json` are written in
  **UTF-8** (emoji, bars): open them with a UTF-8 editor; in Windows PowerShell 5.1,
  `Get-Content -Encoding UTF8 parity.md`.
- Files are written with LF line endings.

## Install

```powershell
git clone https://github.com/camlebrun/data-parity
cd data-parity
pip install .
data-parity help
```

Without installing: `$env:PYTHONPATH = "C:\path\to\data-parity\src"; python -m data_parity help`.

## The manual flow in PowerShell

See the [Quickstart](/data-parity-docs/getting-started/quickstart/#without-the-cli-the-manual-dbt-flow). Two caveats:

- In Windows PowerShell 5.1, `*>` writes **UTF-16**. `Select-String` reads it back, but `sed` or Git Bash `grep` will
  not: stay in PowerShell for the whole flow.
- Put the YAML braces of `--args` between single quotes. If dbt still receives the quotes wrongly on 5.1, use the CLI.

## Tests

Set `DBT_FUSION` for the real-dbt pytest tests with `$env:DBT_FUSION = "dbt"`. The shell test scripts
(`test_reconcile.sh`, `test_cache.sh`, `test_config_guards.sh`) are bash/sh scripts: run them from WSL or Git Bash.
