#!/bin/bash
set -e

# Ensure data directory exists
mkdir -p /app/data/models

# Copy model files to the mounted data volume if they don't exist
if [ ! -f "/app/data/models/kokoro-v1.0.onnx" ]; then
    echo "Copying kokoro-v1.0.onnx to /app/data/models..."
    cp /app/models_cache/kokoro-v1.0.onnx /app/data/models/
fi

if [ ! -f "/app/data/models/voices-v1.0.bin" ]; then
    echo "Copying voices-v1.0.bin to /app/data/models..."
    cp /app/models_cache/voices-v1.0.bin /app/data/models/
fi

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port 8000
