"""
Analyze the daily |High - Open| and |Open - Low| gaps from a price history
CSV (e.g. the one produced by fetch_aex_history.py).

Steps:
1. Load CSV, compute abs(High - Open) and abs(Open - Low) per row.
2. Trim the top N% largest diffs (outliers) for each gap, N configurable via
   --exclude-pct.
3. Compute the average of the remaining (trimmed) diffs, for each gap.
4. Write a summary file (JSON or CSV) and a detail CSV with per-row diff
   columns + "excluded" flags, so you can inspect exactly what was trimmed.

Usage:
    python analyze_high_open_diff.py aex_history.csv
    python analyze_high_open_diff.py aex_history.csv --exclude-pct 5 --out-format json
    python analyze_high_open_diff.py aex_history.csv --exclude-pct 10 --out-format csv --out summary.csv
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


def parse_args():
    p = argparse.ArgumentParser(description="Compute trimmed average of daily |High - Open| gap")
    p.add_argument("input", help="Path to input CSV (must have High and Open columns)")
    p.add_argument("--exclude-pct", type=float, default=5.0,
                    help="Percent of largest diffs to trim as outliers (default: 5)")
    p.add_argument("--out-format", choices=["json", "csv"], default="json",
                    help="Summary output format (default: json)")
    p.add_argument("--out", default=None,
                    help="Summary output filename (default: <input>_summary.<ext>)")
    p.add_argument("--detail-out", default=None,
                    help="Detail CSV filename with per-row diff + excluded flag "
                         "(default: <input>_detail.csv)")
    return p.parse_args()


def main():
    args = parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"Input file not found: {in_path}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(in_path)

    missing = [c for c in ("High", "Open", "Low") if c not in df.columns]
    if missing:
        print(f"Input CSV is missing required column(s): {missing}", file=sys.stderr)
        sys.exit(1)

    df["High"] = pd.to_numeric(df["High"], errors="coerce")
    df["Open"] = pd.to_numeric(df["Open"], errors="coerce")
    df["Low"] = pd.to_numeric(df["Low"], errors="coerce")
    df["diff"] = (df["High"] - df["Open"]).abs()
    df["ol_diff"] = (df["Open"] - df["Low"]).abs()

    before_rows = len(df)
    df = df.dropna(subset=["diff", "ol_diff"])
    dropped_na = before_rows - len(df)

    if args.exclude_pct < 0 or args.exclude_pct >= 100:
        print("--exclude-pct must be between 0 and 100 (exclusive)", file=sys.stderr)
        sys.exit(1)

    # Trim the top exclude_pct% largest diffs (outliers on the high side)
    threshold = df["diff"].quantile(1 - args.exclude_pct / 100)
    df["excluded"] = df["diff"] > threshold

    ol_threshold = df["ol_diff"].quantile(1 - args.exclude_pct / 100)
    df["ol_excluded"] = df["ol_diff"] > ol_threshold

    kept = df.loc[~df["excluded"], "diff"]
    avg_trimmed = kept.mean()
    avg_full = df["diff"].mean()

    ol_kept = df.loc[~df["ol_excluded"], "ol_diff"]
    ol_avg_trimmed = ol_kept.mean()
    ol_avg_full = df["ol_diff"].mean()

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input_file": str(in_path),
        "total_rows": int(before_rows),
        "rows_dropped_missing_data": int(dropped_na),
        "exclude_pct": args.exclude_pct,
        "diff_threshold": round(float(threshold), 6),
        "rows_excluded_as_outliers": int(df["excluded"].sum()),
        "rows_kept": int(len(kept)),
        "average_diff_full": round(float(avg_full), 6),
        "average_diff_trimmed": round(float(avg_trimmed), 6),
        "ol_diff_threshold": round(float(ol_threshold), 6),
        "rows_excluded_as_outliers_ol": int(df["ol_excluded"].sum()),
        "rows_kept_ol": int(len(ol_kept)),
        "average_ol_diff_full": round(float(ol_avg_full), 6),
        "average_ol_diff_trimmed": round(float(ol_avg_trimmed), 6),
    }

    ext = "json" if args.out_format == "json" else "csv"
    out_path = Path(args.out) if args.out else in_path.with_name(f"{in_path.stem}_summary.{ext}")
    detail_path = Path(args.detail_out) if args.detail_out else in_path.with_name(f"{in_path.stem}_detail.csv")

    if args.out_format == "json":
        out_path.write_text(json.dumps(summary, indent=2))
    else:
        pd.DataFrame([summary]).to_csv(out_path, index=False)

    df.to_csv(detail_path, index=False)

    print(json.dumps(summary, indent=2))
    print(f"\nSummary written to: {out_path}")
    print(f"Per-row detail written to: {detail_path}")


if __name__ == "__main__":
    main()
