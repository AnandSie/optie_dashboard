# optie_dashboard

A static AEX-index dashboard served by GitHub Pages directly from `main`
(plain `index.html` / `script.js` / `styles.css` reading `data/*.json` and
`data/*.csv` — no build step, no `.github/workflows`, no CI).

## Data refresh architecture

There is no backend and no cron job. Freshness comes entirely from a
scheduled **Claude Code routine** that runs the `refresh-aex-data` skill
(`.claude/skills/refresh-aex-data/SKILL.md`), which:

1. Installs `scripts/requirements.txt` if needed.
2. Runs `scripts/fetch_aex_history.py` to rewrite `data/aex_history.csv`.
3. Runs `scripts/analyze_high_open_diff.py` to rewrite
   `data/aex_history_summary.json` and `data/aex_history_detail.csv`.
4. Commits and **pushes straight to `main`** if anything changed.

This is a deliberate proof-of-concept: Claude Code stands in for a real
backend/cron job. Since GitHub Pages serves `main` directly with no build
step, "the data is fresh" *is* "a commit landed on `main`" — there is
nothing else in the loop.

### Why push straight to `main` (not a branch + PR)

Confirmed with the repo owner on 2026-07-22. Do **not** route this through
a PR-and-merge flow. Reasons:

- No `.github/workflows` exist — a PR has no CI check to gate on, so
  auto-merging it is pure overhead with no safety benefit.
- The payload is pure generated data (CSV/JSON) from a deterministic
  pipeline — trivially revertible via `git log`/`git revert` if a run ever
  produces something bad. Low enough risk to automate end-to-end.
- Claude Code web/cloud sessions default to a per-session designated
  branch ("develop on branch X, never push elsewhere without permission").
  That default does **not** apply to this skill — the user has explicitly
  authorized direct-to-main pushes for this specific automated data
  refresh. If a session lands the refresh commit on a feature branch
  instead (because the session's git credentials were scoped there), the
  fix is to fast-forward `main` to that commit and push `main` directly,
  not to open a PR.
- Revisit this only if a real build/deploy Action is ever added to
  `.github/workflows` — then gating merges to `main` on that check would
  start to make sense.

### GitHub write access

Pushing to `main` requires the Claude GitHub App installation on this repo
to have **write** (Contents: read/write) access, not just read. If a
scheduled run reports push failures like:

- `git push` → `403 ... Permission ... denied`
- GitHub API calls (`create_branch`, `push_files`, etc.) →
  `403 Resource not accessible by integration`

that means the installed GitHub App only has read access. Fix: repo
owner reinstalls/reconfigures the Claude GitHub App on this repo with
write permission (GitHub → Settings → Applications → Installed GitHub
Apps → Configure). This was hit and fixed once already (2026-07-22) — if
it recurs, it's an installation-scope regression, not a code bug.

### Known environment quirk: yfinance vs. sandboxed proxies

`scripts/fetch_aex_history.py` builds its own yfinance session
(`_proxy_safe_session()`) instead of using yfinance's default. Reason:
yfinance's default session uses curl_cffi's browser-impersonation TLS
mode (mimicking Chrome's TLS fingerprint), which fails to complete a
handshake through a TLS-terminating (MITM-style) proxy — such as the one
some Claude Code sandboxes route outbound HTTPS through — even when the
proxy's CA is trusted system-wide. A plain (non-impersonating) curl_cffi
session with a normal browser `User-Agent` header works fine through such
a proxy and is still accepted by Yahoo Finance. The helper only kicks in
when `HTTPS_PROXY`/`https_proxy` is set, so it's a no-op in a normal
unproxied environment.

## Repo layout

- `index.html`, `script.js`, `styles.css` — the static dashboard, reads
  `data/*.csv`/`*.json` directly (no build step).
- `data/aex_history.csv` — full OHLCV history from Yahoo Finance (^AEX),
  refreshed from a fixed 2015-01-01 start date on every run.
- `data/aex_history_summary.json`, `data/aex_history_detail.csv` — derived
  High-Open gap analysis (trimmed/untrimmed averages, per-row detail).
- `scripts/fetch_aex_history.py`, `scripts/analyze_high_open_diff.py` —
  the two-stage refresh pipeline; see `.claude/skills/refresh-aex-data/`
  for the exact invocation.
