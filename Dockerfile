FROM python:3.14-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r morewax && useradd -r -g morewax -d /app morewax

WORKDIR /app

COPY server/ server/
COPY static/ static/
COPY server.py .

RUN mkdir -p data && chown -R morewax:morewax /app

ENV PYTHONUNBUFFERED=1

USER morewax

EXPOSE 8765 8766

VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:${HTTP_PORT:-8765}/')" || exit 1

CMD ["python3", "server.py"]
