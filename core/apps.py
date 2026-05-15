from django.apps import AppConfig
from django.db.models.signals import post_migrate

def create_default_schedule(sender, **kwargs):
    """Automatically creates the Q2 schedule if it doesn't exist yet."""
    try:
        from django_q.models import Schedule
        
        # get_or_create ensures it only makes it once!
        Schedule.objects.get_or_create(
            name='Daily Auto-Approve Routine',
            defaults={
                'func': 'core.tasks.run_auto_approve_routine',
                'schedule_type': Schedule.DAILY,
                # '00:00:00' represents Midnight
            }
        )
    except Exception:
        # Fails silently if the django_q tables haven't been created yet
        pass

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Tells Django to run our function immediately after 'python manage.py migrate' finishes
        post_migrate.connect(create_default_schedule, sender=self)