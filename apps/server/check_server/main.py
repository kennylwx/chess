import json
import os
import chess
import chess.engine
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Check Cloud", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CHECK_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["*"])

class ResolveRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
    fen: str
class EngineRequest(BaseModel):
    fen: str
    elo: int = Field(ge=1320, le=3190)
    depth: int = Field(default=12, ge=1, le=30)
class MoveResponse(BaseModel):
    move: str
    fen: str
    explanation: str

def board_from(fen: str) -> chess.Board:
    try: return chess.Board(fen)
    except ValueError as exc: raise HTTPException(422, f"Invalid FEN: {exc}") from exc

def apply_verified(board: chess.Board, uci: str, explanation: str) -> MoveResponse:
    try: move = chess.Move.from_uci(uci)
    except ValueError as exc: raise HTTPException(502, "Model returned malformed move") from exc
    if move not in board.legal_moves: raise HTTPException(502, "Provider returned an illegal move")
    board.push(move)
    return MoveResponse(move=uci, fen=board.fen(), explanation=explanation)

@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}

@app.post("/api/resolve", response_model=MoveResponse)
async def resolve(request: ResolveRequest) -> MoveResponse:
    board = board_from(request.fen)
    key = os.getenv("TYPESAFE_API_KEY")
    if not key: raise HTTPException(503, "TYPESAFE_API_KEY is not configured")
    legal = [{"uci": move.uci(), "san": board.san(move)} for move in board.legal_moves]
    payload = {"model": os.getenv("TYPESAFE_MODEL", "jev"), "temperature": 0, "response_format": {"type": "json_object"}, "messages": [
        {"role": "system", "content": "Resolve the instruction to one entry from legal_moves. Return JSON with move and explanation. When the literal request is blocked, choose the safest legal move that progresses its intent."},
        {"role": "user", "content": json.dumps({"instruction": request.instruction, "fen": board.fen(), "legal_moves": legal})},
    ]}
    headers = {"Authorization": f"Bearer {key}"}
    url = os.getenv("TYPESAFE_BASE_URL", "https://api.typesafe.ai/v1").rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=payload)
    if response.is_error: raise HTTPException(502, f"JEV provider failed ({response.status_code})")
    provider = response.json()
    raw = provider.get("choices", [{}])[0].get("message", {}).get("content", provider.get("output", provider))
    try: value = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError as exc: raise HTTPException(502, "JEV returned invalid JSON") from exc
    return apply_verified(board, str(value.get("move", "")), str(value.get("explanation", "Resolved by JEV")))

@app.post("/api/engine", response_model=MoveResponse)
def engine_move(request: EngineRequest) -> MoveResponse:
    board = board_from(request.fen)
    try:
        with chess.engine.SimpleEngine.popen_uci(os.getenv("STOCKFISH_PATH", "stockfish")) as engine:
            engine.configure({"UCI_LimitStrength": True, "UCI_Elo": request.elo})
            result = engine.play(board, chess.engine.Limit(depth=request.depth))
    except (FileNotFoundError, chess.engine.EngineError) as exc: raise HTTPException(503, f"Stockfish unavailable: {exc}") from exc
    if result.move is None: raise HTTPException(409, "The game is over")
    return apply_verified(board, result.move.uci(), f"Stockfish at {request.elo} ELO")
