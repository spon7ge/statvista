from fastapi import FastAPI

from app.api.router import api_router

_REMOVED_PATHS = (
    "/api/games/today",
    "/api/games/{date}",
    "/api/games/{date}/props",
    "/api/games/{date}/slate",
    "/api/games/{date}/with-props",
    "/api/players",
    "/api/player/{player_id}",
    "/api/matchups/{date}",
    "/api/props",
    "/api/slates/{book}",
    "/api/mlb/futures",
    "/api/mlb/standings",
    "/api/mlb/leaders",
    "/api/wnba/futures",
    "/api/wnba/standings",
    "/api/wnba/leaders",
    "/api/wnba/player/{player_id}",
)


def test_api_router_assembles_health_and_domain_routes() -> None:
    app = FastAPI()
    app.include_router(api_router, prefix="/api")
    route_paths = app.openapi()["paths"]

    assert "/api/health" in route_paths
    assert "/api/wnba/scoreboard/today" in route_paths
    assert "/api/mlb/scoreboard/today" in route_paths
    assert "/api/nba/scoreboard/today" in route_paths
    assert "/api/wnba/odds/today" in route_paths
    for path in _REMOVED_PATHS:
        assert path not in route_paths
