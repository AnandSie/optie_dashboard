"""
Fetch historical price data for the AEX index (^AEX) from Yahoo Finance
and save it as a CSV file.

Usage:
    python fetch_aex_history.py
    python fetch_aex_history.py --ticker ^AEX --start 2025-07-21 --end 2026-07-21
    python fetch_aex_history.py --period1 1753099216 --period2 1784635205

Requires: pip install yfinance --break-system-packages
"""

import argparse
import sys
from datetime import datetime, timezone

import yfinance as yf


def parse_args():
    p = argparse.ArgumentParser(description="Fetch historical OHLCV data from Yahoo Finance")
    p.add_argument("--ticker", default="^AEX", help="Yahoo Finance ticker symbol (default: ^AEX)")
    p.add_argument("--start", help="Start date YYYY-MM-DD")
    p.add_argument("--end", help="End date YYYY-MM-DD")
    p.add_argument("--period1", type=int, help="Start as unix timestamp (overrides --start)")
    p.add_argument("--period2", type=int, help="End as unix timestamp (overrides --end)")
    p.add_argument("--interval", default="1d", help="Data interval: 1d, 1wk, 1mo (default: 1d)")
    p.add_argument("--out", default="aex_history.csv", help="Output CSV filename")
    return p.parse_args()


def main():
    args = parse_args()

    start = args.start
    end = args.end
    if args.period1:
        start = datetime.fromtimestamp(args.period1, tz=timezone.utc).strftime("%Y-%m-%d")
    if args.period2:
        end = datetime.fromtimestamp(args.period2, tz=timezone.utc).strftime("%Y-%m-%d")

    print(f"Fetching {args.ticker} from {start or 'inception'} to {end or 'today'} ({args.interval})...")

    df = yf.download(
        args.ticker,
        start=start,
        end=end,
        interval=args.interval,
        progress=False,
        auto_adjust=False,
    )

    if df.empty:
        print("No data returned. Check ticker symbol and date range.", file=sys.stderr)
        sys.exit(1)

    # Flatten possible multi-index columns (yfinance sometimes returns them)
    if isinstance(df.columns, __import__("pandas").MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df.reset_index(inplace=True)
    df.to_csv(args.out, index=False)
    print(f"Saved {len(df)} rows to {args.out}")
    print(df.head())
    print("...")
    print(df.tail())


if __name__ == "__main__":
    main()
