# Optie Dashboards — AEX History Tools

Two scripts for pulling historical AEX index data and analyzing daily price behavior. Meant as building blocks for a future investing dashboard.

## Requirements

```
pip install -r requirements.txt
```

## 1. `fetch_aex_history.py`

Downloads historical OHLCV data for a ticker (default `^AEX`) from Yahoo Finance via the `yfinance` library and saves it to CSV.

Usage:

```
python fetch_aex_history.py
python fetch_aex_history.py --ticker ^AEX --start 2025-07-21 --end 2026-07-21
python fetch_aex_history.py --period1 1753099216 --period2 1784635205
```

Options:

- `--ticker` — Yahoo Finance symbol (default `^AEX`)
- `--start` / `--end` — date range as `YYYY-MM-DD`
- `--period1` / `--period2` — date range as unix timestamps (overrides `--start`/`--end`); handy for pasting straight from a Yahoo Finance URL
- `--interval` — `1d`, `1wk`, or `1mo` (default `1d`)
- `--out` — output CSV filename (default `aex_history.csv`)

Output: a CSV with columns `Date, Open, High, Low, Close, Adj Close, Volume`.

## 2. `analyze_high_open_diff.py`

Takes a price history CSV (e.g. the output of script 1) and analyzes the daily gap between `High` and `Open`.

What it does:

1. Computes `abs(High - Open)` for every row.
2. Trims the top N% of largest diffs as outliers (N configurable, default 5%).
3. Averages the remaining ("trimmed") diffs, and also reports the untrimmed average for comparison.
4. Writes a summary file and a detail file.

Usage:

```
python analyze_high_open_diff.py aex_history.csv
python analyze_high_open_diff.py aex_history.csv --exclude-pct 5 --out-format json
python analyze_high_open_diff.py aex_history.csv --exclude-pct 10 --out-format csv --out summary.csv
```

Options:

- `input` — path to input CSV (positional, required; must have `High` and `Open` columns)
- `--exclude-pct` — percent of largest diffs to trim as outliers (default `5`)
- `--out-format` — `json` or `csv` for the summary file (default `json`)
- `--out` — summary filename (default `<input>_summary.json`)
- `--detail-out` — detail CSV filename (default `<input>_detail.csv`)

Outputs:

- Summary file — total rows, rows excluded, the diff threshold used for trimming, and both the trimmed and full average diff.
- Detail file — original data plus a `diff` column and an `excluded` boolean flag per row, so you can see exactly which rows were trimmed.

## Typical workflow

```
python fetch_aex_history.py --period1 1753099216 --period2 1784635205 --out aex_history.csv
python analyze_high_open_diff.py aex_history.csv --exclude-pct 5
```

## Notes

- Yahoo Finance's history page is JavaScript-rendered, so script 1 uses `yfinance`'s data API rather than scraping the HTML table directly — more reliable and less likely to break.
- Both scripts are read-only / stateless: rerun anytime with new date ranges or thresholds.
- Possible next step: publish the summary/detail files via GitHub Pages with a small HTML+Chart.js front end for a live dashboard.
