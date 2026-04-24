import os
from django.db import models
from django.contrib.auth.models import User # Using Django's built-in secure User table
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver

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
    
    # Original system columns
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    date_filed = models.DateField(auto_now_add=True)
    file_attachment = models.FileField(upload_to=document_upload_path, null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='documents')

    def __str__(self):
        return f"{self.document_number}: {self.title}"


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