import threading
import time
from django.apps import AppConfig
from django.db.models.signals import post_migrate

def start_broadcast_polling():
    def poll_broadcasts():
        # Wait a few seconds to let the application fully bootstrap
        time.sleep(5)
        while True:
            try:
                from core.models import PendingBroadcast
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                from django.db import transaction

                # Fetch and delete inside a transaction to prevent duplicates across processes
                with transaction.atomic():
                    pb = PendingBroadcast.objects.filter(processed=False).first()
                    if pb:
                        pb_id = pb.id
                        pb_group_name = pb.group_name
                        pb_event_type = pb.event_type
                        pb_payload = pb.payload
                        pb.delete()  # Remove immediately to keep database clean and prevent duplicate processing

                        # Broadcast the message in the context of the current process (which includes the Daphne web server)
                        channel_layer = get_channel_layer()
                        if channel_layer:
                            async_to_sync(channel_layer.group_send)(
                                pb_group_name,
                                {
                                    'type': pb_event_type,
                                    'message': pb_payload
                                }
                            )
            except Exception:
                # Silently catch database errors before migration runs or other transient issues
                pass
            time.sleep(1)

    thread = threading.Thread(target=poll_broadcasts, daemon=True)
    thread.start()

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
        
        # Start background polling for WebSocket notifications from background processes
        # but skip it during unit tests to avoid holding database connections open.
        import sys
        if 'test' not in sys.argv:
            start_broadcast_polling()