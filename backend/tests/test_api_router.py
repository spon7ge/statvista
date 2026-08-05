from fastapi import FastAPI

from app.api.router import api_router


def test_api_router_assembles_health_and_domain_routes() -> None:
    app = FastAPI()
    app.include_router(api_router, prefix="/api")
    route_paths = app.openapi()["paths"]

    assert "/api/health" in route_paths
    assert "/api/wnba/scoreboard/today" in route_paths
    assert "/api/mlb/scoreboard/today" in route_paths
    assert "/api/games/today" in route_paths
