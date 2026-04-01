from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User


# ==========================================
# 1. LOGIN VIEW
# ==========================================
def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        try:
            user_obj = User.objects.get(email=email)
            username = user_obj.username
        except User.DoesNotExist:
            username = None

        user = authenticate(request, username=username, password=password)

        if user is not None:
            auth_login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid email or password.')

    return render(request, 'index.html')


# ==========================================
# 2. DASHBOARD VIEW
# ==========================================
@login_required(login_url='login')
def dashboard_view(request):

    recent_documents = [
        {'title': 'Ord. 2024-05: Waste Management Act', 'category': 'Ordinance', 'date_filed': 'Oct 24, 2025', 'status': 'Active'},
        {'title': 'Res. 102: Flood Mitigation Plan', 'category': 'Resolution', 'date_filed': 'Oct 22, 2025', 'status': 'Active'},
    ]

    audit_logs = [
        {'time': '10:15 AM', 'user': 'J. Moral', 'action': 'uploaded', 'target': 'Ord-2024-06'},
    ]

    
    notifications = [
        {'sender': 'Admin', 'message': 'uploaded a new document.', 'time': '2 mins ago'},
        {'sender': 'System', 'message': 'Backup completed successfully.', 'time': '1 hour ago'},
    ]

    context = {
        'total_ordinances': '1,248',
        'total_resolutions': '856',
        'pending_review': '12',
        'recent_uploads_count': '42',
        'recent_documents': recent_documents,
        'audit_logs': audit_logs,
        'notifications': notifications, 
        'last_backup_date': 'March 06, 10:00 AM',
    }

    return render(request, 'dashboard.html', context)


# ==========================================
# 3. DOCUMENTS VIEW
# ==========================================
@login_required(login_url='login')
def documents(request):

    documents_list = [
        {
            'title': 'Ord. No. 2024-001: Green City Initiative',
            'tracking_number': 'TRK-2024-001',
            'category': 'Ordinance',
            'date_filed': 'Jan 12, 2024',
            'status': 'Active'
        },
        {
            'title': 'Res. No. 045: Disaster Preparedness Budget',
            'tracking_number': 'TRK-2023-851',
            'category': 'Resolution',
            'date_filed': 'Dec 05, 2023',
            'status': 'Active'
        },
        {
            'title': 'Ord. No. 2022-078: Traffic Regulation Update',
            'tracking_number': 'TRK-2022-421',
            'category': 'Ordinance',
            'date_filed': 'Aug 20, 2022',
            'status': 'Archived'
        }
    ]

    return render(request, 'documents.html', {
        'documents': documents_list
    })


# ==========================================
# 4. ARCHIVE VIEW
# ==========================================
@login_required(login_url='login')
def archive_view(request):
    # Mock data for the category cards
    categories = [
        {'label': '1990 - 1999', 'icon': 'bi-folder2-open'},
        {'label': '2000 - 2009', 'icon': 'bi-folder2-open'},
        {'label': '2010 - 2019', 'icon': 'bi-folder2-open'},
        {'label': 'Confidential', 'icon': 'bi-shield-lock'},
    ]

    # Mock data for the archive table
    archived_documents = [
        {
            'title_prefix': 'Res 1995-01:',
            'title_main': 'River Rehabilitation',
            'archive_id': 'ARC-95-001',
            'original_date': 'June 12, 1995',
            'retention': 'PERMANENT',
            'status_class': 'badge-permanent'
        },
        {
            'title_prefix': 'Ord 2002-45:',
            'title_main': 'Public Market Cleanliness',
            'archive_id': 'ARC-02-045',
            'original_date': 'Feb 20, 2002',
            'retention': '10 YEARS LEFT',
            'status_class': 'badge-retention'
        },
        {
            'title_prefix': 'Res 1995-01:',
            'title_main': 'River Rehabilitation',
            'archive_id': 'ARC-95-001',
            'original_date': 'June 12, 1995',
            'retention': 'PERMANENT',
            'status_class': 'badge-permanent'
        },
        {
            'title_prefix': 'Ord 2002-45:',
            'title_main': 'Public Market Cleanliness',
            'archive_id': 'ARC-02-045',
            'original_date': 'Feb 20, 2002',
            'retention': '10 YEARS LEFT',
            'status_class': 'badge-retention'
        }
    ]

    context = {
        'storage_used': '3.25',
        'storage_total': '5.0',
        'storage_percentage': 65,
        'last_backup': 'Today, 04:30 AM',
        'categories': categories,
        'archived_documents': archived_documents,
    }

    return render(request, 'archive.html', context)


# ==========================================
# 5. AUDIT LOGS VIEW
# ==========================================
@login_required(login_url='login')
def audit_logs_view(request):
    logs = [
        {
            'timestamp': '2025-10-25 14:32:01',
            'initials': 'JH',
            'avatar_bg': '#9c27b0', # Purple
            'user': 'Jake Hafalla',
            'action': 'UPDATE',
            'class': 'action-update',
            'resource': 'Ordinance No. 2024-05 (Metadata Change)',
            'ip': '192.168.1.45'
        },
        {
            'timestamp': '2025-10-25 13:15:22',
            'initials': 'LG',
            'avatar_bg': '#4caf50', # Green
            'user': 'Luna Gaurino',
            'action': 'CREATE',
            'class': 'action-create',
            'resource': 'Uploaded: Reso-2024-102.pdf',
            'ip': '192.168.1.12'
        },
        {
            'timestamp': '2025-10-25 10:05:44',
            'initials': 'ME',
            'avatar_bg': '#ff9800', # Orange
            'user': 'Mylene Esquilona',
            'action': 'LOGIN',
            'class': 'action-login',
            'resource': 'System Session Started',
            'ip': '192.168.1.88'
        },
        {
            'timestamp': '2025-10-24 16:50:12',
            'initials': 'JM',
            'avatar_bg': '#f44336', # Red
            'user': 'Jayvee Moralitea',
            'action': 'DELETE',
            'class': 'action-delete',
            'resource': 'Archived Record: ARC-95-002 (Purged)',
            'ip': '127.0.0.1'
        },
    ]

    return render(request, 'auditlogs.html', {'logs': logs})


# ==========================================
# 6. USER MANAGEMENT VIEW
# ==========================================
@login_required(login_url='login')
def user_management_view(request):
    # Top Profile Cards
    top_users = [
        {
            'name': 'Gerald Sy',
            'email': 'gerald@marikina.gov',
            'initials': 'GS',
            'role': 'SYSTEM ADMIN',
            'role_class': 'role-admin',
            'permissions': [
                {'label': 'Full System Access', 'enabled': True},
                {'label': 'Audit Log Deletion', 'enabled': False},
                {'label': 'Archive Management', 'enabled': True},
            ]
        },
        {
            'name': 'Jayvee Moral',
            'email': 'jayvee@marikina.gov',
            'initials': 'JM',
            'role': 'LEGISLATIVE STAFF',
            'role_class': 'role-staff',
            'permissions': [
                {'label': 'Document Upload', 'enabled': True},
                {'label': 'Edit Metadata', 'enabled': True},
                {'label': 'User Management', 'enabled': False},
            ]
        },
        {
            'name': 'Mylene Esquilona',
            'email': 'mylene@marikina.gov',
            'initials': 'ME',
            'role': 'LEGISLATIVE STAFF',
            'role_class': 'role-staff',
            'permissions': [
                {'label': 'Document Upload', 'enabled': True},
                {'label': 'Edit Metadata', 'enabled': True},
                {'label': 'Delete Records', 'enabled': False},
            ]
        }
    ]

    # Bottom Table Data
    all_users = [
        {'name': 'Jake Hasley Hafalla', 'designation': 'Technical Support', 'last_activity': '2 mins ago', 'status': 'Active'},
        {'name': 'Myra Luna Gaurino', 'designation': 'Clerk II', 'last_activity': 'Yesterday, 4:00 PM', 'status': 'Active'},
    ]

    return render(request, 'usermanagement.html', {
        'top_users': top_users,
        'all_users': all_users
    })