FROM python:3.14-slim@sha256:fb83750094b46fd6b8adaa80f66e2302ecbe45d513f6cece637a841e1025b4ca

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r morewax && useradd -r -g morewax -d /app morewax

WORKDIR /app

ARG BUILD_VERSION=dev
ARG BUILD_DATE=""
ARG GIT_REVISION=""

COPY server/ server/
COPY static/ static/
COPY server.py .

# Stamp version into the Python module
RUN sed -i \
    -e "s|^VERSION = .*|VERSION = \"${BUILD_VERSION}\"|" \
    -e "s|^BUILD_DATE = .*|BUILD_DATE = \"${BUILD_DATE}\"|" \
    -e "s|^GIT_REVISION = .*|GIT_REVISION = \"${GIT_REVISION}\"|" \
    server/version.py

RUN mkdir -p data && chown -R morewax:morewax /app

ENV PYTHONUNBUFFERED=1

USER morewax

EXPOSE 8765 8766

VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:${HTTP_PORT:-8765}/')" || exit 1

CMD ["python3", "server.py"]
