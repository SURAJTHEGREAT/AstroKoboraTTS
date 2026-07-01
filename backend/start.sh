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

# Copy NLLB model
mkdir -p /app/data/translation_models/nllb-200-600M-ct2-int8
if [ ! -f "/app/data/translation_models/nllb-200-600M-ct2-int8/shared_vocabulary.txt" ]; then
    echo "Ensuring translation model is available in /app/data/translation_models..."
    # If the directory is empty or missing key file, copy it
    if [ -d "/app/models_cache/nllb-model" ]; then
        cp -r /app/models_cache/nllb-model/* /app/data/translation_models/nllb-200-600M-ct2-int8/
    fi
fi

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port 8000
