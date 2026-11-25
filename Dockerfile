FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS api
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" HOME=/home/nail TZ=Asia/Seoul
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
RUN useradd --create-home --uid 10001 nail \
    && mkdir -p /curaxel_images/img/nail /curaxel_images/img/crop /curaxel_images/img/extra \
    && chown -R nail:nail /curaxel_images /home/nail
COPY . .
USER nail
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log", "--proxy-headers", "--forwarded-allow-ips=*"]

FROM api AS ai
USER root
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN uv sync --frozen --no-dev --no-install-project --extra ai
USER nail
EXPOSE 8002
CMD ["uvicorn", "ai_service:app", "--host", "0.0.0.0", "--port", "8002", "--no-access-log"]
