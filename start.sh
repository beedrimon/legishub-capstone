#!/usr/bin/env bash

# Start the Django Q2 worker in the background (the & symbol is crucial)
python manage.py qcluster &

# Start the Gunicorn web server in the foreground, binding to Render's dynamic port
gunicorn legishub.wsgi:application --bind 0.0.0.0:${PORT:-8000}