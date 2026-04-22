from django.db import models
from django.contrib.auth.models import User # Using Django's built-in secure User table

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
    file_attachment = models.FileField(upload_to='documents/', null=True, blank=True)
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