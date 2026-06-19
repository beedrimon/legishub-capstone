import os
from django.db import models
from django.contrib.auth.models import User # Using Django's built-in secure User table
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.db.models import Count
from django.db.models.signals import post_save, post_delete
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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
        ('Generate Report', 'Generate Report'),
        ('Share', 'Share'),
    ]

    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)

    # --- NEW FIELD TO STORE EXACT CHANGES ---
    details = models.TextField(null=True, blank=True)
    
    # --- Missing Foreign Keys added here ---
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    document = models.ForeignKey(LegislativeDocument, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user} - {self.action} - {self.document}"

    @property
    def target_resource(self):
        if self.document:
            return self.document.document_number
        
        # Try to extract the document number from details if the document link is null (due to deletion or archiving)
        import re
        if self.details:
            match = re.search(r"'(.*?)'", self.details)
            if match:
                return match.group(1)
        return "N/A"
    
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
        
# ==========================================
# VETOED DOCUMENT MODEL
# ==========================================
class VetoedDocument(models.Model):
    # Mirrors the main table so we don't lose any data
    document_number = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=255)
    doc_type = models.CharField(max_length=50, choices=LegislativeDocument.DOCUMENT_TYPES)
    year = models.IntegerField()
    date_enacted = models.DateField(null=True, blank=True)
    sponsor = models.CharField(max_length=255, null=True, blank=True)
    co_sponsors = models.CharField(max_length=500, null=True, blank=True)
    visibility = models.CharField(max_length=50, choices=LegislativeDocument.VISIBILITY_CHOICES, default='Public Access')
    keywords = models.CharField(max_length=255, null=True, blank=True)
    physical_storage = models.CharField(max_length=255, null=True, blank=True)
    veto_reason = models.TextField(blank=True, null=True)
    
    # Time tracking
    date_filed = models.DateField(null=True, blank=True) # Keeps the original date it was filed
    date_vetoed = models.DateField(auto_now_add=True)    # Records the exact day it was vetoed
    
    # Store the file in a separate 'vetoed' folder to keep things organized
    file_attachment = models.FileField(upload_to='vetoed/', null=True, blank=True)
    vetoed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='vetoed_docs')

    def __str__(self):
        return f"VETOED - {self.document_number}: {self.title}"
    
# ==========================================
# SYSTEM SETTINGS MODEL (Persistent Configuration)
# ==========================================

class SystemSetting(models.Model):
    """Store system-wide configuration settings permanently in database"""
    SETTING_TYPES = [
        ('string', 'String'),
        ('integer', 'Integer'),
        ('boolean', 'Boolean'),
        ('float', 'Float'),
    ]
    
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, null=True)
    value_type = models.CharField(max_length=20, choices=SETTING_TYPES, default='string')
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_system_settings')
    
    class Meta:
        db_table = 'system_settings'
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'
    
    def __str__(self):
        return f"{self.key}: {self.value}"
    
    def get_value(self):
        """Get the value with proper type conversion"""
        if self.value is None:
            return None
        if self.value_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes', 'on')
        elif self.value_type == 'integer':
            try:
                return int(self.value)
            except ValueError:
                return None
        elif self.value_type == 'float':
            try:
                return float(self.value)
            except ValueError:
                return None
        return self.value
    
    @classmethod
    def get(cls, key, default=None):
        """Get a setting value by key"""
        try:
            setting = cls.objects.get(key=key)
            value = setting.get_value()
            return value if value is not None else default
        except cls.DoesNotExist:
            return default
    
    @classmethod
    def set(cls, key, value, value_type='string', description='', updated_by=None):
        """Set a setting value (creates or updates)"""
        # Convert value to string for storage
        if value_type == 'boolean':
            value = 'true' if value else 'false'
        elif value_type in ('integer', 'float'):
            value = str(value)
        elif value_type == 'string' and value is not None:
            value = str(value)
        
        setting, created = cls.objects.update_or_create(
            key=key,
            defaults={
                'value': value,
                'value_type': value_type,
                'description': description,
                'updated_by': updated_by
            }
        )
        return setting
    
# ==========================================
# BACKUP LOG MODEL
# ==========================================

class BackupLog(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    
    TYPE_CHOICES = [
        ('auto', 'Automatic (Login)'),
        ('manual', 'Manual'),
        ('restore', 'Restore'),
    ]
    
    backup_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    records_synced = models.IntegerField(default=0)
    documents_synced = models.IntegerField(default=0)
    archives_synced = models.IntegerField(default=0)
    audit_logs_synced = models.IntegerField(default=0)
    users_synced = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='backup_logs')
    
    class Meta:
        db_table = 'backup_logs'
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.get_backup_type_display()} backup on {self.started_at} - {self.get_status_display()}"

# ==========================================
# WEBSOCKET BROADCAST SIGNALS
# ==========================================
@receiver(post_save, sender=LegislativeDocument)
def notify_document_saved(sender, instance, created, **kwargs):
    try:
        channel_layer = get_channel_layer()
        if created:  # Document uploaded
            async_to_sync(channel_layer.group_send)(
                'documents_group',
                {
                    'type': 'document_uploaded',
                    'message': {
                        'id': instance.id,
                        'document_number': instance.document_number,
                        'title': instance.title,
                        'status': instance.status
                    }
                }
            )
            print(f"✅ SUCCESS: WebSocket broadcast sent for upload: {instance.document_number}!")
        else:  # Document edited/updated
            async_to_sync(channel_layer.group_send)(
                'documents_group',
                {
                    'type': 'document_updated',
                    'message': {
                        'id': instance.id,
                        'document_number': instance.document_number,
                        'title': instance.title,
                        'status': instance.status
                    }
                }
            )
            print(f"✅ SUCCESS: WebSocket broadcast sent for update: {instance.document_number}!")
    except Exception as e:
        print(f"❌ WEBSOCKET ERROR: Failed to broadcast document save: {e}")

@receiver(post_delete, sender=LegislativeDocument)
def notify_document_deleted(sender, instance, **kwargs):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'documents_group',
            {
                'type': 'document_deleted',
                'message': {
                    'id': instance.id,
                    'document_number': instance.document_number,
                    'title': instance.title
                }
            }
        )
        print(f"✅ SUCCESS: WebSocket broadcast sent for delete: {instance.document_number}!")
    except Exception as e:
        print(f"❌ WEBSOCKET ERROR: Failed to broadcast document delete: {e}")

@receiver(post_save, sender=AuditLog)
def notify_system_update(sender, instance, created, **kwargs):
    if created:  # Only trigger when a new audit log is created
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'documents_group',
                {
                    'type': 'system_update',
                    'message': {
                        'action': instance.action,
                        'details': instance.details,
                        'user': instance.user.username if instance.user else 'System'
                    }
                }
            )
            print(f"✅ SUCCESS: WebSocket broadcast sent for system update: {instance.action}!")
        except Exception as e:
            print(f"❌ WEBSOCKET ERROR: Failed to broadcast system update: {e}")

@receiver(post_save, sender=BackupLog)
def notify_backup_update(sender, instance, created, **kwargs):
    # Broadcast when a cloud sync completes (success or failed)
    if instance.status in ['success', 'failed']:
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'documents_group',
                {
                    'type': 'system_update',
                    'message': {
                        'action': 'Backup',
                        'details': f"Cloud sync ({instance.get_backup_type_display()}) completed with status: {instance.get_status_display()}.",
                        'user': instance.triggered_by.username if instance.triggered_by else 'System'
                    }
                }
            )
            print(f"✅ SUCCESS: WebSocket broadcast sent for BackupLog update: {instance.id}!")
        except Exception as e:
            print(f"❌ WEBSOCKET ERROR: Failed to broadcast BackupLog update: {e}")