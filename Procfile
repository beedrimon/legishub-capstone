web: gunicorn legishub.wsgi --log-file -
worker: python manage.py qcluster
release: python manage.py migrate