# Backend Dockerfile
FROM python:2.7-slim
WORKDIR /app
COPY backend/ .
RUN pip install --upgrade pip && \
    if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
CMD ["python", "main.py"]
