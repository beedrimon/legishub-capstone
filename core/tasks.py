from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

def run_auto_approve_routine():
    """This function acts as a bridge for Django Q2 to run your command."""
    try:
        # This securely executes your auto_approve_docs.py file!
        call_command('auto_approve_docs')
        return "Auto-Approve routine completed successfully."
    except Exception as e:
        logger.error(f"Failed to run auto-approve: {e}")
        raise e