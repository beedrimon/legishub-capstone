from django.contrib import admin
from .models import LegislativeDocument, AuditLog, ArchivedDocument, ArchiveFolder, VetoedDocument

# This customized class tells Django how to display the Legislative Document table
@admin.register(LegislativeDocument)
class LegislativeDocumentAdmin(admin.ModelAdmin):
    # The columns you want to see in the main list view
    list_display = ('document_number', 'title', 'doc_type', 'year', 'status', 'date_filed')
    
    # Adds a filter box on the right side of the screen
    list_filter = ('doc_type', 'status', 'year')
    
    # Adds a search bar at the top to find specific documents
    search_fields = ('document_number', 'title')
    
    # Orders the list by the newest documents first
    ordering = ('-date_filed',)

# This customized class tells Django how to display the Audit Log table
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'document')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__username', 'document__title')
    ordering = ('-timestamp',)

@admin.register(ArchivedDocument)
class ArchivedDocumentAdmin(admin.ModelAdmin):
    list_display = ('archive_id', 'title', 'doc_type', 'year', 'date_archived', 'retention_policy')
    list_filter = ('doc_type', 'year', 'retention_policy', 'visibility')
    search_fields = ('archive_id', 'title', 'original_document_number')
    ordering = ('-date_archived',)

@admin.register(ArchiveFolder)
class ArchiveFolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name',)
    ordering = ('-created_at',)


@admin.register(VetoedDocument)
class VetoedDocumentAdmin(admin.ModelAdmin):
    list_display = ('document_number', 'title', 'doc_type', 'year', 'date_vetoed', 'vetoed_by')
    list_filter = ('doc_type', 'year', 'date_vetoed')
    search_fields = ('document_number', 'title', 'sponsor', 'veto_reason')
    ordering = ('-date_vetoed',)