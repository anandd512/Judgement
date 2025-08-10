#!/bin/bash
echo "Starting Judgement Card Game Server..."
cd /home/site/wwwroot
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la
echo "Listing server directory:"
ls -la server/
echo "Starting Node.js application..."
node server/app.js
