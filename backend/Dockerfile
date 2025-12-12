# Backend Dockerfile
FROM python:2.7-slim
WORKDIR /app
COPY . .

# NOTE: The SDKs in 'sdks/' must be for Linux (not macOS) for this container to work.
# If you have Linux SDKs, ensure they are in the 'sdks' folder.
ENV PYTHONPATH="/app/sdks/pynaoqi-python2.7-2.8.6.23-linux64-20191127_142205/lib/python2.7/site-packages:${PYTHONPATH}"
ENV AL_DIR="/app/sdks/naoqi-sdk-2.8.5.10-linux64"
ENV LD_LIBRARY_PATH="${AL_DIR}/lib:${LD_LIBRARY_PATH}"

RUN pip install --upgrade pip && \
    if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
CMD ["python", "main.py"]
