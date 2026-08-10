from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from src.odds.change_filter import values_equal
from src.odds.quote_specs import QUOTE_SPECS, QuoteSpec


def delete_key_cols(spec: QuoteSpec) -> tuple[str, ...]:
    """Unique snapshot key: identity + line/points compare col + scraped_at."""
    line_col = spec.compare_cols[0]
    return (*spec.identity_cols, line_col, "scraped_at")


def rows_to_delete_mask(df: pd.DataFrame, spec: QuoteSpec) -> pd.Series:
    """True = delete. df must be sorted by identity cols then scraped_at ascending."""
    delete = pd.Series(False, index=df.index)
    prev_key = None
    prev_compare: dict | None = None
    for idx, row in df.iterrows():
        key = tuple(row.get(c) for c in spec.identity_cols)
        compare = {c: row.get(c) for c in spec.compare_cols}
        if key != prev_key:
            prev_key = key
            prev_compare = compare
            continue
        unchanged = all(
            values_equal(compare[c], prev_compare[c]) for c in spec.compare_cols
        )
        if unchanged:
            delete.at[idx] = True
        else:
            prev_compare = compare
    return delete


def fetch_snapshot_rows(table: str, spec: QuoteSpec) -> pd.DataFrame:
    from src.utils.db import get_engine

    cols = list(dict.fromkeys([*spec.identity_cols, *spec.compare_cols, "scraped_at"]))
    col_sql = ", ".join(f'"{c}"' for c in cols)
    identity_sql = ", ".join(f'"{c}"' for c in spec.identity_cols)
    order_sql = identity_sql + ', "scraped_at"'
    sql = text(
        f"""
SELECT {col_sql}
FROM odds.{table}
ORDER BY {order_sql}
"""
    )
    engine = get_engine()
    with engine.connect() as conn:
        return pd.read_sql(sql, conn)


def delete_pruned_rows(
    table: str,
    df: pd.DataFrame,
    delete_mask: pd.Series,
    spec: QuoteSpec,
    *,
    batch_size: int = 1000,
) -> int:
    from psycopg2.extras import execute_values

    from src.utils.db import get_engine

    key_cols = delete_key_cols(spec)
    to_delete = df.loc[delete_mask, list(key_cols)]
    if to_delete.empty:
        return 0

    col_list = ", ".join(f'"{c}"' for c in key_cols)
    match = " AND ".join(
        f't."{c}" IS NOT DISTINCT FROM v."{c}"' for c in key_cols
    )
    delete_sql = (
        f"DELETE FROM odds.{table} AS t "
        f"USING (VALUES %s) AS v({col_list}) "
        f"WHERE {match}"
    )

    rows = [tuple(row[c] for c in key_cols) for _, row in to_delete.iterrows()]
    deleted = 0
    engine = get_engine()
    conn = engine.raw_connection()
    try:
        cur = conn.cursor()
        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            execute_values(cur, delete_sql, batch, page_size=len(batch))
            deleted += cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
    return deleted


def prune_table(table: str, *, apply: bool) -> tuple[int, int]:
    spec = QUOTE_SPECS[table]
    df = fetch_snapshot_rows(table, spec)
    if df.empty:
        return 0, 0
    delete_mask = rows_to_delete_mask(df, spec)
    delete_count = int(delete_mask.sum())
    if apply and delete_count:
        delete_pruned_rows(table, df, delete_mask, spec)
    return len(df), delete_count
