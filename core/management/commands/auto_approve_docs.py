from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import LegislativeDocument, AuditLog, ArchivedDocument, SystemSetting
from django.contrib.auth.models import User # <-- NEW: Imports the User database
from django.db import transaction
from core.views import send_dynamic_email
from django.core.mail import get_connection, EmailMessage
import datetime

class Command(BaseCommand):
    help = "Checks for 'For Approval' documents older than the configured review days, auto-approves them, moves them to Archives, and emails staff."

    def handle(self, *args, **kwargs):
        # 1. Calculate the date exactly configured days ago
        review_days = SystemSetting.get('review_days', 14)
        target_date = datetime.date.today() - datetime.timedelta(days=review_days)

        # 2. Find all documents that are 'For Approval' AND filed configured or more days ago
        overdue_docs = LegislativeDocument.objects.filter(
            status='For Approval',
            date_filed__lte=target_date
        )

        count = overdue_docs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS(f"No 'For Approval' documents have reached the {review_days}-day limit today."))
            return

        # ==========================================
        # NEW: FETCH ALL STAFF EMAILS DYNAMICALLY
        # ==========================================
        # This grabs the emails of all active Admins and Staff members.
        # We filter by `is_staff=True` so we don't accidentally spam read-only Legislators!
        staff_users = User.objects.filter(is_active=True, is_staff=True).exclude(email='')
        
        recipient_emails = []
        for user in staff_users:
            # Check their personal email notification preference
            wants_email = SystemSetting.get(f'email_notifications_{user.id}', True)
            if wants_email:
                recipient_emails.append(user.email)

        # Safety fallback: If no staff members have emails in the system, send it to your master email
        if not recipient_emails:
            recipient_emails = ['noreply.marikinalegishub@gmail.com']

        # Open a single persistent connection to Gmail to avoid timeouts
        email_connection = None
        if settings.EMAIL_HOST_PASSWORD:
            email_connection = get_connection()
            email_connection.open()

        # 3. Process each overdue document
        for doc in overdue_docs:
            try:
                with transaction.atomic():
                    # A. Create the Archive Record
                    archive_record = ArchivedDocument.objects.create(
                        archive_id=f"ARC-{doc.document_number}",
                        original_document_number=doc.document_number,
                        title=doc.title,
                        doc_type=doc.doc_type,
                        year=doc.year,
                        date_enacted=datetime.date.today(), # Sets the enacted date to today
                        sponsor=doc.sponsor,
                        co_sponsors=doc.co_sponsors,
                        visibility=doc.visibility,
                        keywords=doc.keywords,
                        physical_storage=doc.physical_storage,
                        original_date_filed=doc.date_filed,
                        archived_by=None # No specific user; this is a system action
                    )

                    # B. Safely move the PDF file
                    if doc.file_attachment and doc.file_attachment.name:
                        try:
                            archive_record.file_attachment.save(
                                doc.file_attachment.name.split('/')[-1],
                                doc.file_attachment.file,
                                save=True
                            )
                        except FileNotFoundError:
                            pass
                    
                    # Store variables for logging before the document is deleted
                    doc_number = doc.document_number
                    doc_title = doc.title

                    # C. Delete the original document from the active repository
                    doc.delete()

                    # D. Log the system action in the Audit Logs
                    AuditLog.objects.create(
                        user=None, 
                        action='Edit',
                        details=f"System Auto-Approve: {review_days}-day limit reached. '{doc_number}' was automatically approved and transferred to Archives."
                    )

                    # E. Send the Gmail Notification to everyone!
                    subject = f"ALERT: Auto-Approved & Archived {doc_number}"
                    message = (
                        f"Notice from Marikina LegisHub:\n\n"
                        f"The document '{doc_title}' ({doc_number}) was marked 'For Approval' for {review_days} days.\n"
                        f"Per legislative protocol, it has been automatically approved and permanently transferred to the Archives.\n\n"
                        f"Please review this document in the Archives page."
                    )
                    
                    if email_connection:
                        # Send the email using the persistent connection
                        email = EmailMessage(subject, message, settings.DEFAULT_FROM_EMAIL, recipient_emails, connection=email_connection)
                        email.send(fail_silently=True)

                    self.stdout.write(self.style.SUCCESS(f"Successfully auto-approved and archived: {doc_number}"))
            
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to process {doc.document_number}: {str(e)}"))

        if email_connection:
            email_connection.close()

        self.stdout.write(self.style.SUCCESS(f"Task Complete! {count} documents processed. Emails sent to: {', '.join(recipient_emails)}"))