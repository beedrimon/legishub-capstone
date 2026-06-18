from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

def run_auto_approve_routine():
    """This function acts as a bridge for Django Q2 to run your command."""
    print("\n🚀 [DJANGO Q2] Starting Daily Auto-Approve Routine...")
    try:
        # This securely executes your auto_approve_docs.py file!
        call_command('auto_approve_docs')
        print("✅ [DJANGO Q2] Auto-Approve Routine completed successfully.\n")
        return "Auto-Approve routine completed successfully."
    except Exception as e:
        logger.error(f"Failed to run auto-approve: {e}")
        print(f"❌ [DJANGO Q2] Error running Auto-Approve: {e}\n")
        raise e