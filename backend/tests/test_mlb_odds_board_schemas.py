from app.domains.mlb.schemas_odds import (
    MlbOddsBoard,
    MlbOddsBoardLine,
    MlbOddsBoardSide,
    MlbOddsBoardTotal,
    MlbOddsGame,
)


def test_mlb_odds_game_board_round_trip():
    board = MlbOddsBoard(
        away=MlbOddsBoardSide(
            moneyline=113,
            spread=MlbOddsBoardLine(line=1.5, price=-182),
            total=MlbOddsBoardTotal(side="over", line=7.5, price=-113),
        ),
        home=MlbOddsBoardSide(
            moneyline=-115,
            spread=MlbOddsBoardLine(line=-1.5, price=174),
            total=MlbOddsBoardTotal(side="under", line=7.5, price=108),
        ),
    )
    game = MlbOddsGame(
        home_abbrev="BAL",
        away_abbrev="LAA",
        spread_team_abbrev="BAL",
        spread_line=-1.5,
        total=7.5,
        sportsbook="pinnacle",
        board=board,
    )
    dumped = game.model_dump()
    assert dumped["board"]["away"]["moneyline"] == 113
    assert dumped["board"]["home"]["total"]["side"] == "under"
