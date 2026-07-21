#!/usr/bin/env python3
"""
HTTP Server with Cache-Control headers to prevent caching
"""
import http.server
import socketserver
import sys
from datetime import datetime

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add no-cache headers
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Add timestamp to show when served
        self.send_header('X-Served-At', datetime.now().isoformat())
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress normal logging to reduce noise
        pass

if __name__ == '__main__':
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8989

    Handler = NoCacheHTTPRequestHandler

    # Allow reuse of address
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"No-cache server running on port {PORT}")
        httpd.serve_forever()