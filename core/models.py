from django.db import models
from django.contrib.auth.models import User # Using Django's built-in secure User table

class LegislativeDocument(models.Model):
    # Dropdown choices for the Admin panel
    DOCUMENT_TYPES = [
        ('Ordinance', 'Ordinance'),
        ('Resolution', 'Resolution'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Pending', 'Pending'),
        ('Archived', 'Archived'),
    ]

    # Django automatically creates a Primary Key column named 'id'
    title = models.CharField(max_length=255)
    document_number = models.CharField(max_length=100, unique=True)
    doc_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    year = models.IntegerField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    
    # --- Suggested Additions ---
    date_filed = models.DateField(auto_now_add=True) # Automatically saves the date it was created
    file_attachment = models.FileField(upload_to='documents/', null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='documents')

    def __str__(self):
        # This makes the document look nice in the admin panel
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