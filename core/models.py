import os
from django.db import models
from django.contrib.auth.models import User # Using Django's built-in secure User table
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.db.models import Count

# ==========================================
# CUSTOM FILE RENAMING FUNCTION
# ==========================================
def document_upload_path(instance, filename):
    # Extract the file extension (e.g., 'pdf')
    ext = filename.split('.')[-1]
    # Rename the file to match the unique Document Number (replace slashes just in case)
    safe_name = instance.document_number.replace('/', '-').replace('\\', '-')
    new_filename = f"{safe_name}.{ext}"
    return os.path.join('documents/', new_filename)

class LegislativeDocument(models.Model):
    DOCUMENT_TYPES = [
        ('Ordinance', 'Ordinance'),
        ('Resolution', 'Resolution'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Pending', 'Pending'),
        ('Archived', 'Archived'),
        ('1st reading', '1st reading'),
        ('2nd reading', '2nd reading'),
        ('3rd reading', '3rd reading'),
        ('For Certification', 'For Certification'),
        ('For Signing', 'For Signing'),
        ('For Approval', 'For Approval'),
        ('Vetoed', 'Vetoed'),
    ]
    # New dropdown choices for your modal
    VISIBILITY_CHOICES = [
        ('Public Access', 'Public Access'),
        ('Internal Only', 'Internal Only'),
    ]

    title = models.CharField(max_length=255)
    document_number = models.CharField(max_length=100, unique=True)
    doc_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    year = models.IntegerField()
    
    # ==========================================
    # NEW COLUMNS ADDED TO MATCH YOUR MODAL
    # ==========================================
    date_enacted = models.DateField(null=True, blank=True)
    sponsor = models.CharField(max_length=255, null=True, blank=True)
    co_sponsors = models.CharField(max_length=500, null=True, blank=True)
    visibility = models.CharField(max_length=50, choices=VISIBILITY_CHOICES, default='Public Access')
    keywords = models.CharField(max_length=255, null=True, blank=True)
    physical_storage = models.CharField(max_length=255, null=True, blank=True)
    veto_reason = models.TextField(blank=True, null=True)
    
    # Original system columns
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    date_filed = models.DateField(auto_now_add=True)
    file_attachment = models.FileField(upload_to=document_upload_path, null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='documents')

    def __str__(self):
        return f"{self.document_number}: {self.title}"

# ==========================================
# CUSTOM FILE RENAMING FUNCTION FOR ARCHIVES
# ==========================================
def archive_upload_path(instance, filename):
    # Extract the file extension (e.g., 'pdf')
    ext = filename.split('.')[-1]
    # Rename the file to match the unique Archive ID
    safe_name = instance.archive_id.replace('/', '-').replace('\\', '-')
    new_filename = f"{safe_name}.{ext}"
    # Saves to a separate 'archives' folder instead of 'documents'
    return os.path.join('archives/', new_filename)

class ArchiveFolder(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.name

# ==========================================
# ARCHIVED DOCUMENT MODEL
# ==========================================
class ArchivedDocument(models.Model):
    RETENTION_CHOICES = [
        ('Permanent', 'Permanent'),
        ('10 Years', '10 Years'),
        ('5 Years', '5 Years'),
        ('Pending Disposal', 'Pending Disposal'),
    ]

    # 1. New Unique Archive Identifier (Replaces document_number)
    archive_id = models.CharField(max_length=100, unique=True)
    
    custom_folder = models.ForeignKey(ArchiveFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    # Optional: Keep a record of what the original Legis Number was
    original_document_number = models.CharField(max_length=100, null=True, blank=True)
    
    # 2. Mirrored Attributes from LegislativeDocument
    title = models.CharField(max_length=255)
    doc_type = models.CharField(max_length=50, choices=LegislativeDocument.DOCUMENT_TYPES)
    year = models.IntegerField()
    date_enacted = models.DateField(null=True, blank=True)
    sponsor = models.CharField(max_length=255, null=True, blank=True)
    co_sponsors = models.CharField(max_length=500, null=True, blank=True)
    visibility = models.CharField(max_length=50, choices=LegislativeDocument.VISIBILITY_CHOICES, default='Internal Only')
    keywords = models.CharField(max_length=255, null=True, blank=True)
    physical_storage = models.CharField(max_length=255, null=True, blank=True)
    veto_reason = models.TextField(blank=True, null=True)
    
    # 3. Archive-Specific Attributes
    retention_policy = models.CharField(max_length=50, choices=RETENTION_CHOICES, default='Permanent')
    original_date_filed = models.DateField(null=True, blank=True)
    date_archived = models.DateField(auto_now_add=True)
    
    # Uses the new archive upload path
    file_attachment = models.FileField(upload_to=archive_upload_path, null=True, blank=True)
    archived_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='archived_docs')

    def __str__(self):
        return f"{self.archive_id}: {self.title}"

class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('Upload', 'Upload'),
        ('Edit', 'Edit'),
        ('Delete', 'Delete'),
        ('View', 'View'),
    ]

    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    
    # --- Missing Foreign Keys added here ---
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    document = models.ForeignKey(LegislativeDocument, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user} - {self.action} - {self.document}"
    
# ==========================================
# ENFORCE UNIQUE EMAILS AND USERNAMES
# ==========================================
@receiver(pre_save, sender=User)
def enforce_unique_credentials(sender, instance, **kwargs):
    # 1. Clean up the data first (remove accidental spaces at the beginning or end)
    if instance.username:
        instance.username = instance.username.strip()
    if instance.email:
        instance.email = instance.email.strip()

    # 2. Check for duplicate Emails (case-insensitive)
    if instance.email:
        # __iexact makes it ignore uppercase/lowercase differences
        if User.objects.filter(email__iexact=instance.email).exclude(id=instance.id).exists():
            raise ValidationError(f"Account creation failed: The email '{instance.email}' is already in use.")

    # 3. Check for duplicate Usernames (case-insensitive)
    if instance.username:
        if User.objects.filter(username__iexact=instance.username).exclude(id=instance.id).exists():
            raise ValidationError(f"Account creation failed: The username '{instance.username}' is already taken. Please choose another.")