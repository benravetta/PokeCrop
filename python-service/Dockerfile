# CardCrop Python processing service (FastAPI + OpenCV).
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=5001

WORKDIR /app

# OpenCV (headless) and scikit-image still need a couple of shared libs at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser \
 && chown -R appuser /app
USER appuser

EXPOSE 5001

# Single worker by default (CV work is CPU-bound). Override with UVICORN_WORKERS.
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port 5001 --workers ${UVICORN_WORKERS:-1}"]
