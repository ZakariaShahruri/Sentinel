import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from controller.deps import get_conn
from service import game_summaries, llm_analysis

router = APIRouter()


@router.post("/game_summaries/{game_id}/analysis")
async def analyze_game(game_id: int, conn=Depends(get_conn)):
    summary = game_summaries.get_game_summary(conn, game_id)

    async def sse():
        async for chunk in llm_analysis.stream_game_analysis(dict(summary)):
            # escape newlines so each SSE event is a single line
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")
