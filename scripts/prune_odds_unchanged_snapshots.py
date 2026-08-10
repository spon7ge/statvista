"""Dry-run / apply prune of unchanged odds snapshot duplicates.

Usage:
  python scripts/prune_odds_unchanged_snapshots.py
  python scripts/prune_odds_unchanged_snapshots.py --table mlb_pinnacle --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.odds.prune_unchanged import prune_table
from src.odds.quote_specs import QUOTE_SPECS


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--table",
        choices=sorted(QUOTE_SPECS),
        help="Prune one odds table (default: all QUOTE_SPECS tables).",
    )
    p.add_argument(
        "--apply",
        action="store_true",
        help="Delete pruned rows (default: dry-run counts only).",
    )
    args = p.parse_args()

    tables = [args.table] if args.table else sorted(QUOTE_SPECS)
    mode = "apply" if args.apply else "dry-run"
    print(f"Prune unchanged odds snapshots — {mode}")

    total_rows = 0
    total_delete = 0
    for table in tables:
        rows, delete_count = prune_table(table, apply=args.apply)
        total_rows += rows
        total_delete += delete_count
        action = "deleted" if args.apply else "would delete"
        print(f"  {table}: {rows} rows, {action} {delete_count}")

    action = "Deleted" if args.apply else "Would delete"
    print(f"\n{action} {total_delete} / {total_rows} rows across {len(tables)} table(s).")


if __name__ == "__main__":
    main()
