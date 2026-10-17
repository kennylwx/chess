import os
import chess
import chess.engine
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Chess Cloud", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CHESS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["*"])

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
    legal = {move.uci(): board.san(move) for move in board.legal_moves}
    if not legal: raise HTTPException(409, "The game is over")
    payload = {
        "model": os.getenv("TYPESAFE_MODEL", "jev-latest"),
        "state": {"instruction": request.instruction, "fen": board.fen()},
        "questions": {
            "move": {
                "type": "choice",
                "instructions": "Choose a legal move only if it unambiguously matches the player's requested moving piece, destination, and capture. Never substitute another piece or a different move when the request is blocked. Choose no_match if the request is illegal, ambiguous, or cannot be matched.",
                "criteria": {**legal, "no_match": "No legal move unambiguously matches the requested piece and action"},
            }
        },
    }
    headers = {"Authorization": f"Bearer {key}"}
    url = os.getenv("TYPESAFE_BASE_URL", "https://api.typesafe.ai/v1").rstrip("/") + "/systemone"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.RequestError as exc:
        raise HTTPException(502, "Could not reach TypeSafe. Please try again.") from exc
    if response.is_error:
        messages = {
            401: "TypeSafe rejected the API key. Check TYPESAFE_API_KEY and restart pnpm dev.",
            403: "TypeSafe denied access. Check your API key's permissions.",
            404: "TypeSafe endpoint or model not found. Check TYPESAFE_BASE_URL and TYPESAFE_MODEL, then restart pnpm dev.",
            429: "TypeSafe rate limit reached. Please try again shortly.",
        }
        raise HTTPException(502, messages.get(response.status_code, f"TypeSafe request failed ({response.status_code})."))
    try:
        answer = response.json()["answers"]["move"]
        move = answer["choice"]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(502, "TypeSafe returned an invalid move response") from exc
    confidence = answer.get("confidence", 0)
    if move == "no_match" or (isinstance(move, str) and move in legal and (not isinstance(confidence, (int, float)) or not 0.85 <= confidence <= 1)):
        raise HTTPException(422, "No clear legal move matches that instruction. Try exact notation, such as exd5, or specify the starting and target squares.")
    if not isinstance(move, str) or move not in legal:
        raise HTTPException(502, "Provider returned an illegal move")
    return apply_verified(board, move, f"JEV selected {legal[move]} from the legal moves")

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
