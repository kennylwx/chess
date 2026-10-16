from check_server.main import board_from, apply_verified

def test_applies_verified_move():
    result = apply_verified(board_from("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), "e2e4", "test")
    assert result.move == "e2e4"
    assert "4P3" in result.fen
