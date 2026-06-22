# GPU-Accelerated Architecture: Translation & TTS Pipeline

This document details the updated architecture optimized for NVIDIA GPU acceleration (e.g., Jetson AGX Orin). The transition from CPU-only to GPU-enabled inference involves explicit memory management and hardware-specific operator execution.

## 1. High-Level Hardware Abstraction

The system leverages a split-memory architecture, separating standard system RAM from dedicated GPU VRAM to maximize throughput.

```mermaid
graph TB
    subgraph Host_Memory [Host Memory (RAM)]
        A[Input Buffer]
        B[Phoneme/Token Cache]
        C[Audio Buffer]
    end

    subgraph Device_Memory [Device Memory (VRAM)]
        D[NLLB Model Weights - INT8]
        E[Kokoro Model Weights - ONNX]
        F[CUDA Kernels / cuDNN Ops]
    end

    A -- "Async DMA Transfer" --> D
    D -- "GPU Inference (CTranslate2)" --> B
    B -- "Async DMA Transfer" --> E
    E -- "GPU Inference (cuDNN/CUDA)" --> C
```

## 2. Updated Data Flow & Batching Pipeline

The GPU pipeline utilizes parallel batch-queuing to saturate CUDA cores. Preprocessing (tokenization and phonemization) remains asynchronous on the CPU to prevent blocking the GPU execution stream.

```mermaid
graph TD
    subgraph CPU_Preprocessing [CPU Preprocessing (Async)]
        Input[User Text] --> Split[Sentence Splitting]
        Split --> Token[NLLB Tokenization / BPE]
        Split --> Phoneme[Grapheme-to-Phoneme]
    end

    subgraph GPU_Inference_Pipeline [GPU Inference Pipeline]
        Token -- "Batch Queue" --> NMT[NLLB-200 Engine]
        NMT -- "CUDA Kernels (cuBLAS)" --> NMT_Out[Translated Tokens]

        Phoneme -- "Batch Queue" --> TTS[Kokoro TTS Engine]
        TTS -- "ONNX Runtime (CUDA/cuDNN)" --> TTS_Out[Audio Waveform]
    end

    subgraph Data_Movement [Data Movement]
        NMT_Out -- "D2H Transfer" --> Post[Post-processing]
        TTS_Out -- "D2H Transfer" --> SSE[SSE Stream]
    end

    style GPU_Inference_Pipeline fill:#f9f,stroke:#333,stroke-width:2px
```

## 3. Key GPU Optimizations

### 3.1 Memory Management
- **VRAM Residency**: Both NLLB and Kokoro models are pinned in VRAM during the application lifecycle to avoid costly re-loading.
- **Unified Memory/DMA**: Data transfers between Host and Device are optimized using asynchronous DMA transfers.

### 3.2 Inference Acceleration
- **NLLB (CTranslate2)**: Uses **INT8 Quantization** with CUDA/cuBLAS kernels optimized for SM 8.7 (Jetson AGX Orin). `translate_batch` is used to maximize parallel utilization.
- **Kokoro (ONNX Runtime)**: Utilizes the **CUDAExecutionProvider** with cuDNN convolution algorithms. Graph optimizations (`ORT_ENABLE_ALL`) are applied to fuse kernels and reduce operator overhead.

### 3.3 Batch-Queuing Mechanism
- The system implements a dynamic batch-queuing strategy. As sentences are split and pre-processed on the CPU, they are queued for the GPU. The `max_batch_size` is tuned to balance VRAM headroom and throughput.
