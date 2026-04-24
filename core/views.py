from django.shortcuts import render

# Create your views here.
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from .models import LegislativeDocument, AuditLog, ArchivedDocument # Added ArchivedDocument
from django.core.paginator import Paginator
from django.db.models import Q

# ==========================================
# HELPER: ROLE CHECKS
# ==========================================
def is_legislator(user):
    # Legislators are regular users (not superusers and not staff)
    return not user.is_superuser and not user.is_staff

# ==========================================
# 1. LOGIN VIEW
# ==========================================
def login_view(request):
    # If the user is already logged in, send them to the dashboard
    if request.user.is_authenticated:
        if request.user.is_superuser:
            return redirect('dashboard')
        else:
            return redirect('dashboard') # Send staff to documents, or change to a staff dashboard URL

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        # SAFELY and CASE-INSENSITIVELY look up the user by email
        # __iexact ensures "Admin@gmail.com" matches "admin@gmail.com"
        user_obj = User.objects.filter(email__iexact=email).first()
        
        if user_obj:
            username = user_obj.username
        else:
            username = None

        # Authenticate the user
        user = authenticate(request, username=username, password=password)

        if user is not None:
            auth_login(request, user)
            
            # Route users based on their role upon successful login
            if user.is_superuser:
                return redirect('dashboard') # System Admin
            else:
                return redirect('documents') # Legislative Staff
        else:
            # If authentication fails, send an error message to the template
            messages.error(request, 'Invalid email or password. Please try again.')

    return render(request, 'admin_panel/index.html')

# ==========================================
# 2. LOGOUT VIEW
# ==========================================
def logout_view(request):
    # This built-in Django function destroys the user's session and securely logs them out
    auth_logout(request)
    
    # Send them back to the login page (Remember: we named this 'login' in urls.py!)
    return redirect('login')

# ==========================================
# 3. DASHBOARD VIEW
# ==========================================
@login_required(login_url='login')
def dashboard_view(request):
    
    # 1. CALCULATE REAL STATISTICS
    # Count how many of each document type exist
    total_ordinances = LegislativeDocument.objects.filter(doc_type='Ordinance').count()
    total_resolutions = LegislativeDocument.objects.filter(doc_type='Resolution').count()
    
    # Count how many are currently 'Pending'
    pending_review = LegislativeDocument.objects.filter(status='Pending').count()
    
    # 2. FETCH RECENT DOCUMENTS
    # Get all documents, order them by newest first (the minus sign means descending), and grab the top 5
    recent_documents = LegislativeDocument.objects.all().order_by('-id')[:5]

    # 3. FETCH RECENT AUDIT LOGS
    # Legislators only see their own recent logs, Admins/Staff see everyone's
    if is_legislator(request.user):
        recent_logs = AuditLog.objects.filter(user=request.user).order_by('-timestamp')[:5]
    else:
        recent_logs = AuditLog.objects.all().order_by('-timestamp')[:5]

    # 4. PASS THE REAL DATA TO THE TEMPLATE
    context = {
        'total_ordinances': total_ordinances,
        'total_resolutions': total_resolutions,
        'pending_review': pending_review,
        
        # You can calculate recent uploads by grabbing everything from this month, 
        # but for now, we'll just show the total count of everything as an example.
        'recent_uploads_count': LegislativeDocument.objects.all().count(), 
        
        'recent_documents': recent_documents,
        'audit_logs': recent_logs,
        'last_backup_date': 'Live DB Sync Active', # You can update this later when you add cloud backups
        'is_legislator': is_legislator(request.user),
    }

    return render(request, 'admin_panel/dashboard.html', context)

# ==========================================
# 4. DOCUMENTS VIEW
# ==========================================
@login_required(login_url='login')
def documents_view(request):
    # 1. Start with ALL documents
    doc_list = LegislativeDocument.objects.all().order_by('-date_filed')
    
    # 2. Grab the search and filter terms from the URL
    search_query = request.GET.get('q', '')
    doc_type = request.GET.get('doc_type', '')
    year = request.GET.get('year', '')
    status = request.GET.get('status', '')
    author = request.GET.get('author', '')

    # 3. Apply the filters to our database query
    if search_query:
        # Search inside BOTH the Title and the Document Number
        doc_list = doc_list.filter(
            Q(title__icontains=search_query) | 
            Q(document_number__icontains=search_query)
        )
    
    if doc_type:
        doc_list = doc_list.filter(doc_type=doc_type)
        
    if year:
        doc_list = doc_list.filter(year=year)
        
    if status:
        doc_list = doc_list.filter(status=status)
        
    if author:
        doc_list = doc_list.filter(sponsor__icontains=author)

    # 4. Fetch dynamic dropdown choices straight from the database
    # This ensures your "Years" and "Authors" dropdowns are always accurate
    available_years = LegislativeDocument.objects.values_list('year', flat=True).distinct().order_by('-year')
    available_authors = LegislativeDocument.objects.exclude(sponsor__isnull=True).exclude(sponsor__exact='').values_list('sponsor', flat=True).distinct().order_by('sponsor')

    total_records = doc_list.count()
    
    # Pagination
    paginator = Paginator(doc_list, 5) 
    page_number = request.GET.get('page')
    documents = paginator.get_page(page_number)
    
    context = {
        'documents': documents, 
        'total_records': total_records,
        'available_years': available_years,
        'available_authors': available_authors,
        'current_filters': request.GET, # Pass the current URL parameters back to the HTML
        'is_legislator': is_legislator(request.user), # Tell the template if the user is a legislator
    }
    return render(request, 'admin_panel/documents.html', context)

# ==========================================
# 4. ARCHIVE VIEW
# ==========================================

#ARCHIVE VIEW
@login_required(login_url='login')
def archive_view(request):
    # Fetch all archives, newest first
    archives = ArchivedDocument.objects.all().order_by('-date_archived')
    return render(request, 'archives/archive.html', {
        'archives': archives, 
        'is_legislator': is_legislator(request.user)
    })

#ARCHIVE 1900-1999 VIEW
@login_required(login_url='login')
def archive_90s_view(request):
    return render(request, 'archives/archive_90s.html', {'is_legislator': is_legislator(request.user)})

#ARCHIVE YEAR DETAIL VIEW
@login_required(login_url='login')
def archive_year_detail_view(request, year):
    return render(request, 'archives/archive_year_detail.html', {'year': year, 'is_legislator': is_legislator(request.user)})


#ARCHIVE 2000-RECENT VIEW
@login_required(login_url='login')
def archive_20s_view(request):
    return render(request, 'archives/archive_20s.html', {'is_legislator': is_legislator(request.user)})

#ARCHIVE CONFIDENTIAL VIEW
@login_required(login_url='login')
def archive_confidential_view(request):
    if is_legislator(request.user):
        messages.error(request, 'Legislators do not have permission to view confidential archives.')
        return redirect('archive')
    return render(request, 'archives/archive_confidential.html')

# ==========================================
# 5. AUDIT LOGS VIEW
# ==========================================
@login_required(login_url='login')
def audit_logs_view(request):
    # Fetch all logs from the database, ordered by newest first
    if is_legislator(request.user):
        # Legislators can only see their own activity
        logs = AuditLog.objects.filter(user=request.user).select_related('document').order_by('-timestamp')
    else:
        logs = AuditLog.objects.all().select_related('user', 'document').order_by('-timestamp')
    
    # 1. Grab search and filter terms from the URL
    query = request.GET.get('q', '')
    user_filter = request.GET.get('user', '')
    action_filter = request.GET.get('action', '')
    date_filter = request.GET.get('date', '')

    # 2. Apply Search
    if query:
        logs = logs.filter(
            Q(user__username__icontains=query) | 
            Q(document__document_number__icontains=query) |
            Q(action__icontains=query)
        )

    # 3. Apply Dropdown & Date Filters
    if user_filter:
        logs = logs.filter(user__username=user_filter)
        
    if action_filter:
        logs = logs.filter(action=action_filter)
        
    if date_filter:
        # __date allows Django to check just the Year-Month-Day part of the timestamp
        logs = logs.filter(timestamp__date=date_filter)

    # 4. Fetch dynamic data for the dropdowns
    if is_legislator(request.user):
        available_users = [request.user.username]
    else:
        # Gets unique usernames of users who actually have logs
        available_users = User.objects.filter(auditlog__isnull=False).values_list('username', flat=True).distinct().order_by('username')
    
    # Gets the exact actions ('Upload', 'Edit', etc.) straight from your models.py
    available_actions = [choice[0] for choice in AuditLog.ACTION_CHOICES]

    context = {
        'audit_logs': logs,
        'available_users': available_users,
        'available_actions': available_actions,
        'current_filters': request.GET, # Passes selections back to HTML
        'is_legislator': is_legislator(request.user),
    }
    return render(request, 'admin_panel/audit_logs.html', context)

# ==========================================
# 6. USER MANAGEMENT VIEW
# ==========================================
@login_required(login_url='login')
def user_management_view(request):
    # SECURITY CHECK: Kick out non-admins
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to access User Management.')
        return redirect('documents') # Redirect staff away

    # 1. Fetch all users from the database
    # We order them by date_joined so the newest accounts appear first
    all_users = User.objects.all().order_by('-date_joined')
    
    # 2. Put the users in the context dictionary
    # The key 'users' MUST match the name used in your {% for user in users %} loop
    context = {
        'users': all_users,
    }
    
    # 3. Send the data to the template
    return render(request, 'admin_panel/user_management.html', context)

@login_required(login_url='login')
def create_user_view(request):
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to create users.')
        return redirect('dashboard')

    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')
        username = request.POST.get('username')
        password = request.POST.get('password')
        role = request.POST.get('role')

        try:
            if User.objects.filter(username__iexact=username).exists():
                messages.error(request, f"Account creation failed: The username '{username}' is already taken.")
                return redirect('user_management')
                
            if User.objects.filter(email__iexact=email).exists():
                messages.error(request, f"Account creation failed: The email '{email}' is already in use.")
                return redirect('user_management')

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )

            if role == 'admin':
                user.is_superuser = True
                user.is_staff = True
            elif role == 'staff':
                user.is_superuser = False
                user.is_staff = True
            else: # legislator
                user.is_superuser = False
                user.is_staff = False

            user.save()
            messages.success(request, f"User '{username}' successfully created!")

        except Exception as e:
            messages.error(request, f"Error creating user: {e}")
            
    return redirect('user_management')

@login_required(login_url='login')
def edit_user_view(request):
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to edit users.')
        return redirect('user_management')
        
    if request.method == 'POST':
        user_id = request.POST.get('user_id')
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')
        username = request.POST.get('username')

        try:
            target_user = User.objects.get(id=user_id)
            
            # Ensure new username/email aren't already taken by SOMEONE ELSE
            if User.objects.filter(username__iexact=username).exclude(id=user_id).exists():
                messages.error(request, f"Update failed: The username '{username}' is already taken.")
                return redirect('user_management')
                
            if User.objects.filter(email__iexact=email).exclude(id=user_id).exists():
                messages.error(request, f"Update failed: The email '{email}' is already in use.")
                return redirect('user_management')

            target_user.first_name = first_name
            target_user.last_name = last_name
            target_user.email = email
            target_user.username = username
            target_user.save()
            
            messages.success(request, f"Account for '{username}' successfully updated!")
        except User.DoesNotExist:
            messages.error(request, "Error: User not found.")
            
    return redirect('user_management')

@login_required(login_url='login')
def delete_user_view(request, user_id):
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to delete users.')
        return redirect('user_management')
        
    if request.method == 'POST':
        try:
            user_to_delete = User.objects.get(id=user_id)
            if user_to_delete == request.user:
                messages.error(request, "You cannot delete your own active session account.")
            else:
                username = user_to_delete.username
                user_to_delete.delete()
                messages.success(request, f"User '{username}' successfully deleted.")
        except User.DoesNotExist:
            messages.error(request, "Error: User not found.")
            
    return redirect('user_management')

@login_required(login_url='login')
def toggle_permission_view(request, user_id, perm_type):
    if not request.user.is_superuser:
        messages.error(request, 'You do not have permission to modify user access.')
        return redirect('user_management')
        
    if request.method == 'POST':
        try:
            target_user = User.objects.get(id=user_id)
            if target_user == request.user:
                messages.error(request, "You cannot modify your own permissions.")
                return redirect('user_management')
                
            if perm_type == 'superuser':
                target_user.is_superuser = not target_user.is_superuser
                if target_user.is_superuser:
                    target_user.is_staff = True  # Admins should also be staff
            elif perm_type == 'active':
                target_user.is_active = not target_user.is_active
            elif perm_type == 'staff':
                target_user.is_staff = not target_user.is_staff
                
            target_user.save()
            messages.success(request, f"Permissions updated successfully for '{target_user.username}'.")
        except User.DoesNotExist:
            messages.error(request, "Error: User not found.")
            
    return redirect('user_management')

# ==========================================
# 7. USER SETTINGS VIEW
# ==========================================

#GENERAL INFO VIEW
@login_required(login_url='login')
def general_info_view(request):
    if not request.user.is_superuser:
        return redirect('documents')
    return render(request, 'settings_page/general_info.html')

#BACKUP & CLOUD VIEW
@login_required(login_url='login')
def backup_cloud_view(request):
    if not request.user.is_superuser:
        return redirect('documents')
    return render(request, 'settings_page/backup_cloud.html')

#METADATA TAGS VIEW
@login_required(login_url='login')
def metadata_tags_view(request):
    if not request.user.is_superuser:
        return redirect('documents')
    return render(request, 'settings_page/metadata_tags.html')

#SECURITY POLICY VIEW
@login_required(login_url='login')
def security_policy_view(request):
    if not request.user.is_superuser:
        return redirect('documents')
    return render(request, 'settings_page/security_policy.html')

#NOTIFICATIONS VIEW
@login_required(login_url='login')
def notifications_view(request):
    if not request.user.is_superuser:
        return redirect('documents')
    return render(request, 'settings_page/notifications.html')


# ==========================================
# 8. UPLOAD DOCUMENT VIEW
# ==========================================
@login_required(login_url='login')
def upload_document(request):
    if is_legislator(request.user):
        messages.error(request, 'Action Denied: Legislators have read-only access and cannot upload documents.')
        return redirect('documents')

    if request.method == 'POST':
        # 1. Grab all text data from the HTML form
        title = request.POST.get('title')
        document_number = request.POST.get('document_number')
        
        # --- NEW SAFETY CHECK FOR UPLOADS ---
        # Check if a document with this number already exists
        if LegislativeDocument.objects.filter(document_number=document_number).exists():
            messages.error(request, f'Upload failed: The Legis Number "{document_number}" is already in use!')
            # Bounce them back to the exact page they were on (Dashboard or Documents)
            return redirect(request.META.get('HTTP_REFERER', 'dashboard'))
        # ------------------------------------

        doc_type = request.POST.get('doc_type')
        year = request.POST.get('year')
        
        # New fields from your modal
        date_enacted = request.POST.get('date_enacted')
        sponsor = request.POST.get('sponsor')
        co_sponsors = request.POST.get('co_sponsors')
        status = request.POST.get('status', 'Pending')
        visibility = request.POST.get('visibility')
        keywords = request.POST.get('keywords')
        physical_storage = request.POST.get('physical_storage')
        
        # 2. Grab the file
        file_attachment = request.FILES.get('file_attachment')

        # 3. Save the document to the database
        new_doc = LegislativeDocument.objects.create(
            title=title,
            document_number=document_number,
            doc_type=doc_type,
            year=year,
            date_enacted=date_enacted if date_enacted else None, # Handles empty dates safely
            sponsor=sponsor,
            co_sponsors=co_sponsors,
            visibility=visibility,
            keywords=keywords,
            physical_storage=physical_storage,
            file_attachment=file_attachment,
            uploaded_by=request.user,
            status=status
        )

        # 4. Save an Audit Log entry
        AuditLog.objects.create(
            user=request.user,
            action='Upload',
            document=new_doc
        )

        messages.success(request, 'Document successfully uploaded!')
        
    return redirect(request.META.get('HTTP_REFERER', 'dashboard'))

# ==========================================
# 9. EDIT DOCUMENT VIEW
# ==========================================
@login_required(login_url='login')
def edit_document(request):
    if is_legislator(request.user):
        messages.error(request, 'Action Denied: Legislators have read-only access and cannot edit documents.')
        return redirect('documents')

    if request.method == 'POST':
        # Grab the hidden ID so we know which document to update
        doc_id = request.POST.get('doc_id')
        new_document_number = request.POST.get('document_number')
        
        # --- NEW SAFETY CHECK FOR EDITS ---
        # Check if the number exists AND belongs to a DIFFERENT document
        if LegislativeDocument.objects.filter(document_number=new_document_number).exclude(id=doc_id).exists():
            messages.error(request, f'Update failed: The Legis Number "{new_document_number}" is already in use by another document!')
            return redirect('documents')
        # ----------------------------------
        
        # Fetch the exact document from the database
        doc = LegislativeDocument.objects.get(id=doc_id)

        # Update the fields
        doc.title = request.POST.get('title')
        doc.document_number = new_document_number
        doc.doc_type = request.POST.get('doc_type')
        doc.year = request.POST.get('year')
        
        date_enacted = request.POST.get('date_enacted')
        doc.date_enacted = date_enacted if date_enacted else None

        doc.sponsor = request.POST.get('sponsor')
        doc.co_sponsors = request.POST.get('co_sponsors')
        doc.keywords = request.POST.get('keywords')
        doc.status = request.POST.get('status')
        doc.visibility = request.POST.get('visibility')
        doc.physical_storage = request.POST.get('physical_storage')

        # Only overwrite the file if they uploaded a new one!
        new_file = request.FILES.get('file_attachment')
        if new_file:
            doc.file_attachment = new_file

        # Update the fields
        doc.title = request.POST.get('title')
        doc.document_number = new_document_number
        doc.doc_type = request.POST.get('doc_type')
        doc.year = request.POST.get('year')
        
        date_enacted = request.POST.get('date_enacted')
        doc.date_enacted = date_enacted if date_enacted else None

        doc.sponsor = request.POST.get('sponsor')
        doc.co_sponsors = request.POST.get('co_sponsors')
        doc.keywords = request.POST.get('keywords')
        doc.visibility = request.POST.get('visibility')
        doc.physical_storage = request.POST.get('physical_storage')

        # Check the new status
        new_status = request.POST.get('status')
        
        # ==========================================
        # ARCHIVAL TRIGGER LOGIC
        # ==========================================
        if new_status == 'Archived':
            # 1. Generate a unique Archive ID (e.g., ARC-26-015)
            year_suffix = str(doc.year)[-2:]
            archive_id = f"ARC-{year_suffix}-{doc.id:03d}"
            
            # 2. Create the new record in the ArchivedDocument table
            new_archive = ArchivedDocument.objects.create(
                archive_id=archive_id,
                original_document_number=doc.document_number,
                title=doc.title,
                doc_type=doc.doc_type,
                year=doc.year,
                date_enacted=doc.date_enacted,
                sponsor=doc.sponsor,
                co_sponsors=doc.co_sponsors,
                visibility='Internal Only', # Automatically locks privacy for archives
                keywords=doc.keywords,
                physical_storage=doc.physical_storage,
                retention_policy='Permanent',
                original_date_filed=doc.date_filed,
                archived_by=request.user
            )

            # 3. Transfer the PDF File to the new /archives/ folder
            from django.core.files.base import ContentFile
            if doc.file_attachment:
                file_content = ContentFile(doc.file_attachment.read())
                file_name = doc.file_attachment.name.split('/')[-1]
                new_archive.file_attachment.save(file_name, file_content, save=True)

            # 4. Log the archival and DELETE the active document
            AuditLog.objects.create(user=request.user, action=f'Archived Document: {archive_id}')
            doc.delete()

            messages.success(request, f'Document successfully moved to Archives as {archive_id}!')
            return redirect('archive') # Send them to the archive page!

        # If it is NOT being archived, just save it normally as an Active/Pending document
        doc.status = new_status

        # Only overwrite the file if they uploaded a new one!
        new_file = request.FILES.get('file_attachment')
        if new_file:
            doc.file_attachment = new_file

        doc.save()

        # Log the edit action
        AuditLog.objects.create(
            user=request.user,
            action='Edit',
            document=doc
        )

        messages.success(request, 'Document successfully updated!')
        
    return redirect('documents')