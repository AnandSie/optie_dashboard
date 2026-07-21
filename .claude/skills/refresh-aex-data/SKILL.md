---
name: refresh-aex-data
description: >
  Refreshes AEX index history data by running the local Python pipeline
  (scripts/fetch_aex_history.py then scripts/analyze_high_open_diff.py) and
  pushes the resulting CSV/JSON to GitHub so the static optie_dashboard site
  (GitHub Pages, no server) can pick up new numbers. This is a deliberate
  proof-of-concept workaround: Claude Code, run either on demand or by a
  scheduled routine, stands in for a real backend/cron job. Use this skill
  whenever the user asks to "refresh AEX data", "run the AEX pipeline",
  "update the dashboard data", "pull the latest AEX numbers", or similar —
  and always use it when a scheduled routine triggers with this task, since
  in that case there is no human present to ask anything of. Do not use this
  skill for unrelated data fetching, other tickers, or other repos.
---

# Refresh AEX data

This skill runs the two-script AEX data pipeline end to end and publishes the
result by pushing to `main`. It exists because GitHub Pages only serves static
files — it can't run Python itself — so this skill is the stand-in "refresh
job" until a real backend replaces it.

**Run every step below without pausing to ask the user anything.** This skill
is invoked both by a human typing a message and by a scheduled routine with
nobody watching, so it must complete unattended. The only things worth
surfacing to the user are the final summary and any hard failure — never a
mid-run confirmation question.

## Steps

Run these from the repository root (`optie_dashboard/`).

### 1. Make sure dependencies are installed

```
python -c "import yfinance, pandas" || pip install -r scripts/requirements.txt
```

If the import fails, install and re-check. If installation itself fails, stop
and report the pip error — don't continue to the fetch step with missing deps.

### 2. Fetch fresh history

```
python scripts/fetch_aex_history.py --ticker ^AEX --start 2015-01-01 --out data/aex_history.csv
```

Create the `data/` directory first if it doesn't exist. The start date is
fixed at `2015-01-01` so every run re-fetches the same full window through
today — that keeps the CSV self-consistent with no gap-filling logic needed.
If this command exits non-zero or prints "No data returned", stop here and
report the error clearly — do not proceed to analysis with a missing or empty
CSV.

### 3. Analyze the High/Open gap

```
python scripts/analyze_high_open_diff.py data/aex_history.csv --exclude-pct 5 --out-format json --out data/aex_history_summary.json --detail-out data/aex_history_detail.csv
```

If this errors (e.g. the CSV is missing `High`/`Open` columns), stop and
report it — don't push a partial or stale `data/` folder.

### 4. Commit and push only if something actually changed

```
git status --porcelain data/
```

- If that shows no changes, **skip commit/push entirely** and say so in the
  summary — this is the expected, non-error outcome on a day the market data
  didn't move enough to change the trimmed CSV/JSON output (or the pipeline
  re-ran on already-fresh data). Do not treat "nothing to commit" as a failure.
- If there are changes:
  ```
  git add data/aex_history.csv data/aex_history_summary.json data/aex_history_detail.csv
  git commit -m "Refresh AEX data ($(date +%Y-%m-%d))"
  git push
  ```
  If `git push` fails (auth, network, rejected/non-fast-forward), report the
  exact error to the user — this is a real failure, don't retry silently or
  force-push to work around it.

### 5. Report a short summary

Whether triggered by a human or a routine, end with a short, concrete summary
covering:
- Date range and row count fetched
- Trimmed average `High - Open` diff (and the untrimmed one, for contrast) —
  pull these from `data/aex_history_summary.json`
- Whether a push happened, and the commit message if so, or "no changes to
  push" if not
- Any error encountered, stated plainly, if a step failed

## Notes

- This skill assumes the working directory is the `optie_dashboard` repo root
  and that git remote/auth is already configured (it was set up when the repo
  was first connected) — don't attempt to reconfigure git remotes or auth as
  part of this skill.
- Re-running this skill is always safe: both scripts are stateless and the
  fetch always pulls the same fixed window, so a re-run just reproduces (or
  updates) the same three files in `data/`.
