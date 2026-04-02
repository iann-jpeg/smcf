#!/bin/bash

echo "🚀 Starting SMCF Platform..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if MongoDB is running
echo "📦 Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}✓ MongoDB is running${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB is not running. Starting MongoDB...${NC}"
    if command -v systemctl &> /dev/null; then
        sudo systemctl start mongodb
    elif command -v brew &> /dev/null; then
        brew services start mongodb-community
    else
        echo -e "${RED}✗ Could not start MongoDB. Please start it manually.${NC}"
        exit 1
    fi
fi

echo ""

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠ Backend .env not found. Creating from example...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠ Please edit backend/.env with your configuration${NC}"
fi

# Check if frontend .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Frontend .env not found. Creating from example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit .env with your configuration${NC}"
fi

echo ""

# Start backend
echo "🔧 Starting Backend Server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
echo "   Logs: backend.log"
echo "   URL: http://localhost:4000"

cd ..

echo ""

# Start frontend
echo "🎨 Starting Frontend..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend in background
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo "   Logs: frontend.log"
echo "   URL: http://localhost:5173"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ SMCF Platform is running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:4000"
echo "API Docs:  http://localhost:4000/"
echo ""
echo "To stop the servers, run: ./stop.sh"
echo "Or press Ctrl+C"
echo ""

# Save PIDs to file for stop script
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# Wait for user to stop
wait
