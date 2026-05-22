# Test Scenarios

This document outlines the test scenarios for the newly added analytics metrics (Total Audio Files Generated and Time To First Byte).

## Scenario 1: Capturing Time To First Byte (TTFB)
**Objective**: Ensure the `ttfb_ms` metric accurately reflects the time between the start of a request and the generation of the first audio chunk, rather than the total execution time.
**Steps**:
1. Create a new API client to authenticate with the `/api/tts` endpoint.
2. Send a long text prompt to the `/api/tts` endpoint.
3. Observe the `api_client_stats` database table and verify a record is inserted.
4. Verify the `ttfb_ms` field is populated with a reasonable value (e.g., significantly less than the total time taken to stream all audio chunks for a long prompt).

## Scenario 2: Capturing Total Audio Files Generated
**Objective**: Verify that every successful request to `/api/tts` increments the total count of audio files generated for a specific client.
**Steps**:
1. Log into the Analytics Admin Panel (`/api/analytics`).
2. Note the "Total Audio Files Generated" for a test client.
3. Make 3 successive calls to the `/api/tts` endpoint using the test client's credentials.
4. Refresh the Analytics Admin Panel.
5. Verify that the "Total Audio Files Generated" count for the test client has increased by 3.

## Scenario 3: Analytics API Accuracy
**Objective**: Ensure the `/api/analytics` endpoint accurately aggregates statistics from the `api_client_stats` and `api_clients` tables.
**Steps**:
1. Insert mock data directly into the `api_clients` and `api_client_stats` tables with known `words_processed` and `ttfb_ms` values.
2. Send a POST request to `/api/analytics` with valid admin credentials.
3. Verify the JSON response contains the correct `total_files_generated` (count of rows), `total_words_processed` (sum), and `avg_ttfb_ms` (average of `ttfb_ms`) for the mock client.

## Scenario 4: Analytics UI Rendering
**Objective**: Ensure the Recharts components render the new data correctly.
**Steps**:
1. Serve the frontend and navigate to the Analytics view.
2. Authenticate as admin.
3. Visually verify the presence of three charts:
   - "Total Audio Files Generated" (f59e0b color bar)
   - "Number of Words Processed" (4f46e5 color bar)
   - "Average Time to First Byte (ms)" (10b981 color bar)
4. Ensure the charts map their data correctly to the labels provided in the tooltip and legend.
