#!/usr/bin/env bash

# Delay the Django Q2 worker by 15 seconds to prevent memory spike crashes
# on Render's Free Tier, then run it in the background
(sleep 15 && echo "Starting Django Q2 Worker..." && python manage.py qcluster) &

# Start the Daphne ASGI server in the foreground, binding to Render's dynamic port to support WebSockets
daphne -b 0.0.0.0 -p ${PORT:-8000} legishub.asgi:application