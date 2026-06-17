#!/usr/bin/env bash

# Delay the Django Q2 worker by 15 seconds to prevent memory spike crashes
# on Render's Free Tier, then run it in the background
(sleep 15 && echo "Starting Django Q2 Worker..." && python manage.py qcluster) &

# Start the Gunicorn web server in the foreground, binding to Render's dynamic port
gunicorn legishub.wsgi:application --bind 0.0.0.0:${PORT:-8000}