#!/bin/bash

echo "🧪 Testing Tab Completion with Directory Paths"
echo ""

echo "📁 Testing directory completion with trailing slashes:"
echo "  1. Type: cd /etc/ + Tab"
echo "     Expected: Show files in /etc directory"
echo ""
echo "  2. Type: ls /usr/ + Tab"  
echo "     Expected: Show contents of /usr directory"
echo ""
echo "  3. Type: cd src/ + Tab (if src dir exists)"
echo "     Expected: Show contents of src directory"
echo ""
echo "  4. Type: ls /tm + Tab"
echo "     Expected: Complete to /tmp/"
echo ""
echo "  5. Type: cd ~ + Tab"
echo "     Expected: Show home directory contents"
echo ""

echo "🚀 Starting InkSh for tab completion test..."
echo ""

npm run demo