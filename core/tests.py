import json
from unittest.mock import patch
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from core.models import LegislativeDocument, AuditLog, DocumentProgress
from django.core.files.uploadedfile import SimpleUploadedFile

class ShareDocumentTestCase(TestCase):
    def setUp(self):
        # Create a user
        self.user = User.objects.create_user(username='testuser', password='password123', email='testuser@example.com')
        self.client = Client()
        self.client.login(username='testuser', password='password123')
        
        # Create a document with file attachment
        self.pdf_file = SimpleUploadedFile("test_file.pdf", b"file_content", content_type="application/pdf")
        self.doc = LegislativeDocument.objects.create(
            title="Test Document",
            document_number="TEST-001",
            doc_type="Ordinance",
            year=2026,
            file_attachment=self.pdf_file,
            uploaded_by=self.user
        )

    @patch('django_q.tasks.async_task')
    def test_share_document_success(self, mock_async_task):
        url = reverse('share_document')
        payload = {
            'email': 'recipient@example.com',
            'doc_id': self.doc.id,
            'doc_number': self.doc.document_number
        }
        
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('Email has been queued', data['message'])
        
        # Verify async_task was called with correct arguments
        mock_async_task.assert_called_once_with(
            'core.views.send_shared_document_email',
            'recipient@example.com',
            self.doc.id,
            'LegislativeDocument'
        )
        
        # Verify AuditLog entry was created
        audit_log = AuditLog.objects.filter(action='Share', user=self.user).first()
        self.assertIsNotNone(audit_log)
        self.assertIn('recipient@example.com', audit_log.details)
        self.assertIn('TEST-001', audit_log.details)

    def test_share_document_missing_fields(self):
        url = reverse('share_document')
        payload = {
            'email': '',
            'doc_id': self.doc.id
        }
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['status'], 'error')

    def test_share_document_invalid_email(self):
        url = reverse('share_document')
        payload = {
            'email': 'not-an-email',
            'doc_id': self.doc.id,
            'doc_number': self.doc.document_number
        }
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['status'], 'error')

    def test_share_document_no_attachment(self):
        # Create a document without attachment
        doc_no_file = LegislativeDocument.objects.create(
            title="No File Document",
            document_number="TEST-002",
            doc_type="Ordinance",
            year=2026,
            uploaded_by=self.user
        )
        url = reverse('share_document')
        payload = {
            'email': 'recipient@example.com',
            'doc_id': doc_no_file.id,
            'doc_number': doc_no_file.document_number
        }
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['status'], 'error')
        self.assertIn('does not have a PDF file attached', response.json()['message'])


class ProgressTimelineTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='encoder1', password='password123', email='encoder@example.com', is_staff=True)
        self.client = Client()
        self.client.login(username='encoder1', password='password123')
        
        self.doc = LegislativeDocument.objects.create(
            title="Test Doc for Progress",
            document_number="TEST-PROG-001",
            doc_type="Ordinance",
            year=2026,
            uploaded_by=self.user,
            status="1st reading"
        )
        # Create initial progress
        DocumentProgress.objects.create(
            document=self.doc,
            status="1st reading",
            update_date="2026-06-22",
            created_by=self.user
        )

    def test_add_progress_duplicate_status_fails(self):
        url = reverse('add_progress')
        response = self.client.post(url, {
            'document_id': self.doc.id,
            'update_date': '2026-06-23',
            'status': '1st reading',
            'note': 'Should fail'
        })
        # Check that it redirected back with view_doc_id in URL
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        # Verify no duplicate progress was created
        self.assertEqual(DocumentProgress.objects.filter(document=self.doc, status='1st reading').count(), 1)

    def test_add_progress_new_status_success(self):
        url = reverse('add_progress')
        response = self.client.post(url, {
            'document_id': self.doc.id,
            'update_date': '2026-06-23',
            'status': '2nd reading',
            'note': 'Should succeed'
        })
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        self.assertEqual(DocumentProgress.objects.filter(document=self.doc, status='2nd reading').count(), 1)
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, '2nd reading')

    def test_edit_document_duplicate_status_fails(self):
        url = reverse('edit_document')
        # Standard save without changing status
        response = self.client.post(url, {
            'doc_id': self.doc.id,
            'title': 'Test Doc for Progress Edited',
            'document_number': 'TEST-PROG-001',
            'doc_type': 'Ordinance',
            'year': 2026,
            'status': '1st reading',  # Not changed, should succeed
        })
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        
        # Now add a new status to progress
        DocumentProgress.objects.create(
            document=self.doc,
            status="2nd reading",
            update_date="2026-06-23",
            created_by=self.user
        )
        self.doc.status = "2nd reading"
        self.doc.save()
        
        # Now try to edit document status back to "1st reading" (already used)
        response = self.client.post(url, {
            'doc_id': self.doc.id,
            'title': 'Test Doc for Progress Edited',
            'document_number': 'TEST-PROG-001',
            'doc_type': 'Ordinance',
            'year': 2026,
            'status': '1st reading',  # Changed back to 1st reading, should fail
        })
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        # Verify status did not change back
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.status, '2nd reading')

    def test_edit_document_progress_success(self):
        # The initial progress ID
        prog = DocumentProgress.objects.filter(document=self.doc, status='1st reading').first()
        url = reverse('edit_progress')
        
        response = self.client.post(url, {
            'progress_id': prog.id,
            'update_date': '2026-06-25',
            'status': '1st reading',  # Keep same status
            'note': 'Updated note'
        })
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        prog.refresh_from_db()
        self.assertEqual(str(prog.update_date), '2026-06-25')
        self.assertEqual(prog.note, 'Updated note')

    def test_edit_document_progress_duplicate_status_fails(self):
        # Create second progress step
        prog2 = DocumentProgress.objects.create(
            document=self.doc,
            status="2nd reading",
            update_date="2026-06-24",
            created_by=self.user
        )
        url = reverse('edit_progress')
        
        # Try to edit second step to "1st reading" (duplicate status)
        response = self.client.post(url, {
            'progress_id': prog2.id,
            'update_date': '2026-06-24',
            'status': '1st reading',  # Already used in first step, should fail
            'note': 'Attempt to duplicate'
        })
        self.assertIn(f'view_doc_id={self.doc.id}', response.url)
        prog2.refresh_from_db()
        self.assertEqual(prog2.status, '2nd reading')  # Validation rejected change


class HelpCenterTicketingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123', email='testuser@example.com')
        self.client = Client()
        self.client.login(username='testuser', password='password123')

    @patch('core.views.async_task')
    def test_submit_ticket_success(self, mock_async_task):
        from core.models import SupportTicket
        url = reverse('help_center')
        response = self.client.post(url, {
            'department': 'IT Support',
            'urgency': 'High',
            'subject': 'System error',
            'message': 'Cannot download PDFs'
        })
        # Check redirect
        self.assertEqual(response.status_code, 302)
        
        # Verify ticket creation
        ticket = SupportTicket.objects.filter(user=self.user).first()
        self.assertIsNotNone(ticket)
        self.assertEqual(ticket.department, 'IT Support')
        self.assertEqual(ticket.urgency, 'High')
        self.assertEqual(ticket.subject, 'System error')
        self.assertEqual(ticket.message, 'Cannot download PDFs')
        self.assertEqual(ticket.status, 'Pending')
        self.assertTrue(ticket.ticket_number.startswith('LH-TKT-'))

        # Verify async_task was called for the email
        mock_async_task.assert_called_once()
        args = mock_async_task.call_args[0]
        self.assertEqual(args[0], 'core.views.send_dynamic_email')
        self.assertIn('Support Ticket Received', args[1])
        self.assertIn('LH-TKT-', args[2])

    def test_submit_ticket_missing_fields_fails(self):
        from core.models import SupportTicket
        url = reverse('help_center')
        response = self.client.post(url, {
            'department': '',
            'urgency': 'High',
            'subject': '',
            'message': 'Cannot download PDFs'
        })
        self.assertEqual(response.status_code, 302)
        # Verify ticket was NOT created
        self.assertEqual(SupportTicket.objects.count(), 0)

    def test_submit_ticket_other_department_fallback(self):
        from core.models import SupportTicket
        url = reverse('help_center')
        response = self.client.post(url, {
            'department': 'Other',
            'other_department': 'Custom Secretariat Office',
            'urgency': 'Low',
            'subject': 'Missing feature request',
            'message': 'Add calendar'
        })
        self.assertEqual(response.status_code, 302)
        ticket = SupportTicket.objects.filter(user=self.user).first()
        self.assertIsNotNone(ticket)
        self.assertEqual(ticket.department, 'Custom Secretariat Office')
