"""
Analyze the daily |High - Open| and |Open - Low| gaps from a price history
CSV (e.g. the one produced by fetch_aex_history.py).

Steps:
1. Load CSV, compute abs(High - Open) and abs(Open - Low) per row.
2. For each gap, compute the mean and standard deviation over the full
   (untrimmed) history, and derive an upper bound at mean + k*std
   (k configurable via --sigma, default 2).
3. Measure the actual share of sessions that fall at or under that bound,
   so the "within k sigma" figure is empirical, not just a normal-curve
   assumption.
4. Write a summary file (JSON or CSV) and a detail CSV with per-row diff
   columns + a "beyond_Ksigma" flag, so you can inspect exactly which
   sessions exceed the bound.

Usage:
    python analyze_high_open_diff.py aex_history.csv
    python analyze_high_open_diff.py aex_history.csv --sigma 2 --out-format json
    python analyze_high_open_diff.py aex_history.csv --sigma 3 --out-format csv --out summary.csv
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


def parse_args():
    p = argparse.ArgumentParser(
        description="Compute mean/std and a k-sigma probability band for daily High-Open and Open-Low gaps"
    )
    p.add_argument("input", help="Path to input CSV (must have High, Open and Low columns)")
    p.add_argument("--sigma", type=float, default=2.0,
                    help="Number of standard deviations for the upper bound (default: 2)")
    p.add_argument("--out-format", choices=["json", "csv"], default="json",
                    help="Summary output format (default: json)")
    p.add_argument("--out", default=None,
                    help="Summary output filename (default: <input>_summary.<ext>)")
    p.add_argument("--detail-out", default=None,
                    help="Detail CSV filename with per-row diff + beyond-sigma flag "
                         "(default: <input>_detail.csv)")
    return p.parse_args()


def sigma_stats(series, k):
    mean = float(series.mean())
    std = float(series.std())
    upper = mean + k * std
    within_pct = float((series <= upper).mean() * 100)
    return mean, std, upper, within_pct


def main():
    args = parse_args()

    if args.sigma <= 0:
        print("--sigma must be greater than 0", file=sys.stderr)
        sys.exit(1)

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

    diff_mean, diff_std, diff_upper, diff_within_pct = sigma_stats(df["diff"], args.sigma)
    df["beyond_sigma"] = df["diff"] > diff_upper

    ol_mean, ol_std, ol_upper, ol_within_pct = sigma_stats(df["ol_diff"], args.sigma)
    df["ol_beyond_sigma"] = df["ol_diff"] > ol_upper

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input_file": str(in_path),
        "total_rows": int(before_rows),
        "rows_dropped_missing_data": int(dropped_na),
        "sigma_k": args.sigma,
        "diff_mean": round(diff_mean, 6),
        "diff_std": round(diff_std, 6),
        "diff_upper_bound": round(diff_upper, 6),
        "diff_within_sigma_pct": round(diff_within_pct, 2),
        "ol_diff_mean": round(ol_mean, 6),
        "ol_diff_std": round(ol_std, 6),
        "ol_diff_upper_bound": round(ol_upper, 6),
        "ol_diff_within_sigma_pct": round(ol_within_pct, 2),
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
