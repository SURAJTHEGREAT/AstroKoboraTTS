# Data Management

Data persistence and management in Kokoro TTS rely on a combination of local file system storage for large binaries (like audio models) and a lightweight relational database for structured metadata and analytics.

1. **[Analytics and Metrics](5.1-analytics-and-metrics.md)**: Details how the application tracks API usage, stores metrics in SQLite, and visualizes them on the frontend.
2. **[Live RAM Metrics](5.2-live-metrics.md)**: Explains the real-time memory profiling of active sessions visualized on the frontend using transient chunk-level data.
