from datetime import datetime, timezone

from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse


async def get_mlb_prop_board() -> MlbPropBoardResponse:
    return MlbPropBoardResponse(as_of=datetime.now(timezone.utc))
