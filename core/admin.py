from django.contrib import admin
from django.utils.html import format_html
from .models import LegislativeDocument, AuditLog, ArchivedDocument, ArchiveFolder, VetoedDocument, DocumentProgress, SupportTicket, SystemSetting

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


@admin.register(DocumentProgress)
class DocumentProgressAdmin(admin.ModelAdmin):
    list_display = ('document', 'status', 'update_date', 'created_by', 'file_link')
    list_filter = ('status', 'update_date', 'created_by')
    search_fields = ('document__document_number', 'document__title', 'note')
    ordering = ('-update_date',)

    def file_link(self, obj):
        if obj.file_attachment:
            return format_html('<a href="{}" target="_blank">Download</a>', obj.file_attachment.url)
        return '-'
    file_link.short_description = 'File'


@admin.register(VetoedDocument)
class VetoedDocumentAdmin(admin.ModelAdmin):
    list_display = ('document_number', 'title', 'doc_type', 'year', 'date_vetoed', 'vetoed_by')
    list_filter = ('doc_type', 'year', 'date_vetoed')
    search_fields = ('document_number', 'title', 'sponsor', 'veto_reason')
    ordering = ('-date_vetoed',)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('ticket_number', 'username', 'department', 'urgency', 'status', 'created_at', 'screenshot_link')
    list_filter = ('status', 'urgency', 'department', 'created_at')
    search_fields = ('ticket_number', 'username', 'subject', 'message', 'admin_notes')
    ordering = ('-created_at',)
    readonly_fields = ('ticket_number', 'user', 'username', 'department', 'urgency', 'subject', 'message', 'screenshot', 'created_at', 'resolved_at')
    fields = ('ticket_number', 'user', 'username', 'department', 'urgency', 'subject', 'message', 'screenshot', 'created_at', 'status', 'admin_notes', 'resolved_at')

    def screenshot_link(self, obj):
        if obj.screenshot:
            return format_html('<a href="{}" target="_blank">View File</a>', obj.screenshot.url)
        return '-'
    screenshot_link.short_description = 'Attachment'

    def save_model(self, request, obj, form, change):
        if change and 'status' in form.changed_data:
            from django.utils import timezone
            if obj.status == 'Resolved':
                obj.resolved_at = timezone.now()
            else:
                obj.resolved_at = None
        super().save_model(request, obj, form, change)


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'value_type', 'description', 'updated_at')
    list_filter = ('value_type',)
    search_fields = ('key', 'value', 'description')
    ordering = ('key',)

    def save_model(self, request, obj, form, change):
        if not change or not obj.updated_by:
            obj.updated_by = request.user
        super().save_model(request, obj, form, change)