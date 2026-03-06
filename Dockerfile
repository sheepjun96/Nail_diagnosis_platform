FROM ghcr.io/astral-sh/uv:python3.9-bookworm-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    locales \
    && sed -i 's/^# ko_KR.UTF-8 UTF-8/ko_KR.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=ko_KR.UTF-8
ENV LC_ALL=ko_KR.UTF-8
ENV LANGUAGE=ko_KR:ko

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev

COPY . .

ENV VIRTUAL_ENV="/app/.venv"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
