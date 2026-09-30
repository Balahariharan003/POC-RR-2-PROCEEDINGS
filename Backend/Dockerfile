# Stage 1: Build & Python Dependency Installation
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies: LibreOffice for PDF conversion, fonts, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    fonts-dejavu \
    fonts-taml \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python wheels from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy TAU-Marutham font if present into system fonts directory
COPY fonts/ /usr/share/fonts/truetype/custom/ 2>/dev/null
RUN fc-cache -f -v 2>/dev/null || true

# Copy Application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads outputs templates sample_data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
