from app.schemas.mlb_game_detail import MlbGameDetail, MlbGameDetailTeam


def test_mlb_game_detail_minimal_construct():
    team = MlbGameDetailTeam(
        id="111", abbrev="BOS", name="Boston Red Sox", score=1, color="#BD3039"
    )
    detail = MlbGameDetail(
        mlb_game_pk="776543",
        status="live",
        status_label="Top 1st",
        venue="Fenway Park",
        away=team,
        home=team.model_copy(update={"id": "119", "abbrev": "LAD", "name": "Los Angeles Dodgers", "color": "#005A9C"}),
        sources=["mlb_stats_api"],
        fetched_at="2026-08-02T18:00:00+00:00",
    )
    assert detail.league == "mlb"
    assert detail.win_probability is None
