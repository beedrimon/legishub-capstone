from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from core.models import LegislativeDocument, AuditLog
import datetime

class Command(BaseCommand):
    help = 'Checks for pending documents older than 14 days, sets them to Active, and emails admins.'

    def handle(self, *args, **kwargs):
        # 1. Calculate the date exactly 14 days ago
        fourteen_days_ago = datetime.date.today() - datetime.timedelta(days=14)

        # 2. Find all documents that are 'Pending' AND filed 14 or more days ago
        # Note: __lte means "less than or equal to" (older than)
        overdue_docs = LegislativeDocument.objects.filter(
            status='Pending',
            date_filed__lte=fourteen_days_ago
        )

        count = overdue_docs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No pending documents have reached the 14-day limit today."))
            return

        # 3. Process each overdue document
        for doc in overdue_docs:
            doc.status = 'Active'
            doc.save()

            # Optional: Log it in your Audit Logs!
            AuditLog.objects.create(
                action='System Auto-Approve',
                document=doc
            )

            # 4. Send the Gmail Notification
            subject = f"ALERT: Auto-Approval for {doc.document_number}"
            message = (
                f"Notice from Marikina LegisHub:\n\n"
                f"The document '{doc.title}' ({doc.document_number}) has been pending for 14 days.\n"
                f"Per legislative protocol, its status has been automatically updated to 'Active' in the database.\n\n"
                f"Please review this document in the system."
            )
            
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=['admin@example.com'], # Change this to the email that should receive the alert!
                fail_silently=False,
            )

            self.stdout.write(self.style.SUCCESS(f"Successfully auto-approved and emailed: {doc.document_number}"))

        self.stdout.write(self.style.SUCCESS(f"Task Complete! {count} documents updated."))