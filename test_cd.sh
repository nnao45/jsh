#!/bin/bash

echo "🧪 Testing cd command directory synchronization"
echo ""

# 現在のディレクトリを保存
ORIGINAL_DIR=$(pwd)

echo "📁 Original directory: $ORIGINAL_DIR"
echo ""

echo "🚀 Starting InkSh demo for cd test..."
echo ""
echo "💡 Try these commands to test cd:"
echo "  1. pwd                  (show current directory)"
echo "  2. cd /tmp             (change to /tmp)"
echo "  3. pwd                  (should show /tmp)"
echo "  4. ls                   (list files in /tmp)"
echo "  5. cd ~                 (go to home)"
echo "  6. pwd                  (should show home directory)"
echo "  7. ls                   (list home directory files)"
echo ""

npm run demo