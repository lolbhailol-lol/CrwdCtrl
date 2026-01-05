#!/bin/bash

echo "🚀 FestBuzzZ Backend Startup Script"
echo "=================================="

echo "📊 System Information:"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "Current Directory: $(pwd)"
echo "User: $(whoami)"

echo ""
echo "🔧 Environment Variables:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "MONGODB_URI: ${MONGODB_URI:0:20}..."

echo ""
echo "📁 Directory Contents:"
ls -la

echo ""
echo "📦 Package.json Check:"
if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo "❌ package.json not found"
    exit 1
fi

echo ""
echo "🗂️ Source Files Check:"
if [ -f "src/server.js" ]; then
    echo "✅ src/server.js found"
else
    echo "❌ src/server.js not found"
    exit 1
fi

echo ""
echo "🎯 Starting Node.js Application..."
exec node src/server.js