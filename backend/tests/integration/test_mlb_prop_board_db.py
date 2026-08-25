from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


def test_empty_db_returns_no_rows(client):
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    body = res.json()
    assert body["rows"] == []
    assert "parlay_unavailable" in body["warnings"]
