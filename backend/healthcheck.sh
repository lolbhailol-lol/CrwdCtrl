#!/bin/sh
# Simple health check script for Cloud Run

# Wait for the server to start
sleep 5

# Check if server is responding
curl -f http://localhost:8080/api/health || exit 1

echo "Health check passed"