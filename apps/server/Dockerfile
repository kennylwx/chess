FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends stockfish && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml .
COPY chess_server chess_server
RUN pip install --no-cache-dir .
ENV STOCKFISH_PATH=/usr/games/stockfish
EXPOSE 8000
CMD ["uvicorn", "chess_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
