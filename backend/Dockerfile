FROM python:3.11-slim

WORKDIR /app

# System deps needed to build psycopg2 from source if no wheel is available
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

# Run pending migrations, then start the app. If the DB is briefly not ready
# yet (container startup ordering), retry a few times before giving up.
CMD sh -c '\
  cd migrations && \
  for i in 1 2 3 4 5; do alembic upgrade head && break || sleep 3; done && \
  cd .. && \
  python run.py'
