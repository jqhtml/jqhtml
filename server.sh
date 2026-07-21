#!/bin/bash
# JQHTML Demo Server Management Script
# Kills any existing server and starts a new one on port 3000

set -e  # Exit on any error

PORT=3000
DEMO_DIR="demo-app"
LOG_FILE="server.log"
PID_FILE="server.pid"

echo "🌐 JQHTML Demo Server Manager"
echo "=============================="

# Function to kill existing server
kill_existing_server() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "🛑 Stopping existing server (PID: $OLD_PID)..."
            kill "$OLD_PID" 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if kill -0 "$OLD_PID" 2>/dev/null; then
                kill -9 "$OLD_PID" 2>/dev/null || true
            fi
            echo "   ✓ Server stopped"
        fi
        rm -f "$PID_FILE"
    fi
    
    # Check for any process on the port using ss command (more reliable than lsof)
    echo "🔍 Checking for processes on port $PORT..."
    
    # Try to find PID using ss command
    EXISTING_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    
    # If ss didn't work, try netstat
    if [ -z "$EXISTING_PID" ]; then
        EXISTING_PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT" | awk '{print $7}' | cut -d'/' -f1 | head -1 || true)
    fi
    
    # If we still don't have a PID, try lsof as last resort
    if [ -z "$EXISTING_PID" ] && command -v lsof &> /dev/null; then
        EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null || true)
    fi
    
    if [ ! -z "$EXISTING_PID" ]; then
        echo "🛑 Found process on port $PORT (PID: $EXISTING_PID), stopping..."
        
        # Try graceful kill first
        kill "$EXISTING_PID" 2>/dev/null || true
        
        # Wait up to 5 seconds for process to terminate
        local wait_count=0
        while [ $wait_count -lt 5 ]; do
            sleep 1
            wait_count=$((wait_count + 1))
            
            # Check if process is still running
            if ! kill -0 "$EXISTING_PID" 2>/dev/null; then
                echo "   ✓ Port $PORT cleared after ${wait_count} second(s)"
                return 0
            fi
            
            echo "   ⏳ Waiting for process to terminate... (${wait_count}/5)"
        done
        
        # If still running after 5 seconds, try force kill
        echo "   ⚠️  Process didn't terminate gracefully, forcing kill..."
        kill -9 "$EXISTING_PID" 2>/dev/null || true
        sleep 1
        
        # Final check
        if kill -0 "$EXISTING_PID" 2>/dev/null; then
            echo "❌ ERROR: Unable to kill process on port $PORT (PID: $EXISTING_PID)"
            echo "   The process is still running after forced termination attempt."
            echo "   Please manually kill the process or use a different port."
            exit 1
        else
            echo "   ✓ Port $PORT forcefully cleared"
        fi
    else
        echo "   ✓ Port $PORT is available"
    fi
}

# Function to start the server
start_server() {
    echo "🚀 Starting demo server on port $PORT..."
    
    # Check if demo directory exists
    if [ ! -d "$DEMO_DIR" ]; then
        echo "❌ Error: Demo directory '$DEMO_DIR' not found!"
        echo "   Run 'npm run build' first to create the demo."
        exit 1
    fi
    
    # Check if dist directory exists
    if [ ! -d "$DEMO_DIR/dist" ]; then
        echo "⚠️  Warning: $DEMO_DIR/dist not found, building demo first..."
        cd "$DEMO_DIR"
        npm run build
        cd ..
    fi
    
    # Start Python HTTP server in background
    cd "$DEMO_DIR/dist"
    python3 -m http.server $PORT > "../../$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    cd ../..
    
    # Save PID
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait a moment to ensure server starts
    sleep 1
    
    # Check if server started successfully
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "✅ Server started successfully!"
        echo "   PID: $SERVER_PID"
        echo "   URL: http://localhost:$PORT"
        echo "   Logs: tail -f $LOG_FILE"
        echo ""
        echo "📊 Serving files from: $DEMO_DIR/dist/"
        echo ""
        echo "🛑 To stop the server, run: ./server.sh stop"
    else
        echo "❌ Failed to start server!"
        echo "   Check $LOG_FILE for details"
        exit 1
    fi
}

# Function to show server status
show_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✅ Server is running"
            echo "   PID: $PID"
            echo "   URL: http://localhost:$PORT"
            echo "   Logs: tail -f $LOG_FILE"
        else
            echo "⚠️  Server PID file exists but process is not running"
            rm -f "$PID_FILE"
        fi
    else
        echo "🛑 Server is not running"
    fi
    
    # Also check port directly using ss
    EXISTING_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    if [ ! -z "$EXISTING_PID" ]; then
        echo "   ℹ️  Port $PORT is in use by PID: $EXISTING_PID"
    fi
}

# Parse command line arguments
case "${1:-start}" in
    start)
        kill_existing_server
        start_server
        ;;
    stop)
        kill_existing_server
        echo "✅ Server stopped"
        ;;
    restart)
        kill_existing_server
        start_server
        ;;
    status)
        show_status
        ;;
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "No log file found. Server may not be running."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Kill any existing server and start a new one (default)"
        echo "  stop     - Stop the running server"
        echo "  restart  - Restart the server"
        echo "  status   - Show server status"
        echo "  logs     - Tail the server logs"
        exit 1
        ;;
esac