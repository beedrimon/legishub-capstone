from django.shortcuts import render
from django.http import JsonResponse
from django.utils.timesince import timesince
from django.utils import timezone
from django.utils.timezone import now

# Create your views here.
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from .models import LegislativeDocument, AuditLog, ArchivedDocument, ArchiveFolder
from django.core.paginator import Paginator
from django.db.models import Q, Case, IntegerField, Value, When
from django.db import transaction, IntegrityError
from django.db.models import Min, Max, Count
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
import math



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
# 2.5 FORGOT PASSWORD VIEW
# ==========================================
def forgot_password_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        if email:
            # Look up any users with this exact email
            users = User.objects.filter(email__iexact=email)
            for user in users:
                # Generate a secure one-time-use token and user ID
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                
                # Build the absolute URL for the reset link that goes in the email
                reset_link = request.build_absolute_uri(
                    reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
                )
                
                # Send the actual email through Gmail SMTP
                subject = "Password Reset Request - Marikina LegisHub"
                message = f"Hello {user.first_name or user.username},\n\nYou recently requested to reset your password for your Marikina LegisHub account.\n\nPlease click the link below to set a new password:\n{reset_link}\n\nIf you did not request this, please ignore this email."
                
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)

            messages.success(request, f"If an account exists for {email}, a password reset link has been sent.")
            return redirect('login')
            
    return render(request, 'admin_panel/forgot_password.html')

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
    # Annotate with priority: 'Urgent' gets 0 (top), others get 1
    doc_list = LegislativeDocument.objects.exclude(status__iexact='Archived').annotate(
        priority=Case(
            When(status__iexact='Urgent', then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by('priority', '-date_filed')
    
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
            Q(document_number__icontains=search_query) |
            Q(doc_type__icontains=search_query) |
            Q(keywords__icontains=search_query) |
            Q(sponsor__icontains=search_query) |
            Q(co_sponsors__icontains=search_query) |
            Q(physical_storage__icontains=search_query) |
            Q(visibility__icontains=search_query) |
            Q(date_enacted__icontains=search_query) |
            Q(date_filed__icontains=search_query) 
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
@login_required(login_url='login')
def archive_view(request):
    # Start with all archived records
    archive_list = ArchivedDocument.objects.all().order_by('-original_date_filed')
    
    # Fetch search query
    search_query = request.GET.get('q', '')
    doc_type = request.GET.get('doc_type', '')
    year = request.GET.get('year', '')
    author = request.GET.get('author', '')

    if search_query:
        archive_list = archive_list.filter(
            Q(title__icontains=search_query) | 
            Q(archive_id__icontains=search_query) |
            Q(sponsor__icontains=search_query) |
            Q(keywords__icontains=search_query) |
            Q(doc_type__icontains=search_query)
        )
    if doc_type:
        archive_list = archive_list.filter(doc_type__iexact=doc_type)
    if year:
        archive_list = archive_list.filter(year=year)
    if author:
        archive_list = archive_list.filter(sponsor__icontains=author)
    
    # UI Data: Counts and Folders
    res_count = ArchivedDocument.objects.filter(doc_type__iexact='Resolution').count()
    ord_count = ArchivedDocument.objects.filter(doc_type__iexact='Ordinance').count()
    custom_folders = ArchiveFolder.objects.all().order_by('name')

    # Pagination
    paginator = Paginator(archive_list, 5)
    page_number = request.GET.get('page')
    archives_paged = paginator.get_page(page_number)

    context = {
        'archives': archives_paged, 
        'res_count': res_count,
        'ord_count': ord_count,
        'custom_folders': custom_folders,
        'is_legislator': is_legislator(request.user),
        'search_query': search_query,
        'curent_filters': request.GET,
    }
    return render(request, 'archives/archive.html', context)

@login_required
def ordinances_view(request):
    selected_range = request.GET.get('range') # e.g., "1900-1909"
    selected_year = request.GET.get('year')   # e.g., "1905"
    search_query = request.GET.get('q', '')

    ordinances = ArchivedDocument.objects.filter(doc_type__iexact='Ordinance')

    # LEVEL 3: Show Document Table for a specific Year
    if selected_year or search_query:
        docs = ordinances
        if selected_year:
            docs = docs.filter(year=selected_year)
        if search_query:
            docs = docs.filter(
                Q(title__icontains=search_query) | 
                Q(archive_id__icontains=search_query) |
                Q(sponsor__icontains=search_query) |
                Q(keywords__icontains=search_query)
            )

        return render(request, 'archives/ordinances.html', {
            'archives': docs.order_by('-date_enacted'), # Matches {% for doc in archives %}
            'selected_year': selected_year,
            'selected_range': selected_range,
            'search_query': search_query,
            'current_view': 'doc_list'
        })
        

    # LEVEL 2: Show Year Folders for a specific Decade
    if selected_range:
        try:
            start_year, end_year = map(int, selected_range.split('-'))
            # Get years in this decade that actually have documents
            years_in_range = ordinances.filter(year__range=(start_year, end_year)) \
                                .values_list('year', flat=True) \
                                .distinct().order_by('year')
            
        except ValueError:
            years_in_range = []
                                
        
        return render(request, 'archives/ordinances.html', {
            'years_in_range': years_in_range,
            'selected_range': selected_range,
            'current_view': 'year_folders'
        })

    # LEVEL 1: Default View - Show Decade Folders (1900-1909, 1910-1919, etc.)
    # Automatically calculate decades based on available data
    year_bounds = ordinances.aggregate(min_y=Min('year'), max_y=Max('year'))
    decade_ranges = []

    if year_bounds['min_y'] and year_bounds['max_y']:
        # Round min year down to start of decade (e.g., 1905 -> 1900)
        start_decade = (year_bounds['min_y'] // 10) * 10
        # Round max year up to end of decade
        end_decade = (year_bounds['max_y'] // 10) * 10
        
        for d in range(start_decade, end_decade + 10, 10):
            decade_ranges.append(f"{d}-{d+9}")

    return render(request, 'archives/ordinances.html', {
        'decade_ranges': decade_ranges,
        'current_view': 'decade_folders'
    })

@login_required
def resolutions_view(request):
    selected_range = request.GET.get('range') # e.g., "1900-1909"
    selected_year = request.GET.get('year')   # e.g., "1905"
    search_query = request.GET.get('q', '')

    resolutions = ArchivedDocument.objects.filter(doc_type__iexact='Resolution')

    # LEVEL 3: Show Document Table for a specific Year
    if selected_year or search_query:
        docs = resolutions
        if selected_year:
            docs = docs.filter(year=selected_year)
        if search_query:
            docs = docs.filter(
                Q(title__icontains=search_query) | 
                Q(archive_id__icontains=search_query) |
                Q(sponsor__icontains=search_query) |
                Q(keywords__icontains=search_query)
            )

        return render(request, 'archives/resolutions.html', {
            'archives': docs.order_by('-date_enacted'), # Matches {% for doc in archives %}
            'selected_year': selected_year,
            'selected_range': selected_range,
            'search_query': search_query,
            'current_view': 'doc_list'
        })
        

    # LEVEL 2: Show Year Folders for a specific Decade
    if selected_range:
        try:
            start_year, end_year = map(int, selected_range.split('-'))
            # Get years in this decade that actually have documents
            years_in_range = resolutions.filter(year__range=(start_year, end_year)) \
                                .values_list('year', flat=True) \
                                .distinct().order_by('year')
            
        except ValueError:
            years_in_range = []
                                
        
        return render(request, 'archives/resolutions.html', {
            'years_in_range': years_in_range,
            'selected_range': selected_range,
            'current_view': 'year_folders'
        })

    # LEVEL 1: Default View - Show Decade Folders (1900-1909, 1910-1919, etc.)
    # Automatically calculate decades based on available data
    year_bounds = resolutions.aggregate(min_y=Min('year'), max_y=Max('year'))
    decade_ranges = []

    if year_bounds['min_y'] and year_bounds['max_y']:
        # Round min year down to start of decade (e.g., 1905 -> 1900)
        start_decade = (year_bounds['min_y'] // 10) * 10
        # Round max year up to end of decade
        end_decade = (year_bounds['max_y'] // 10) * 10
        
        for d in range(start_decade, end_decade + 10, 10):
            decade_ranges.append(f"{d}-{d+9}")

    return render(request, 'archives/resolutions.html', {
        'decade_ranges': decade_ranges,
        'current_view': 'decade_folders'
    })

@login_required
def confidential_view(request):
    """Restricted page for Internal Archives"""
    if is_legislator(request.user):
        return redirect('archive') # Legislators can't see this
        
    # Check if session is already unlocked
    unlocked = request.session.get('confidential_unlocked', False)
    
    if request.method == 'POST':
        if 'lock' in request.POST:
            request.session['confidential_unlocked'] = False
            messages.info(request, 'Confidential archives safely locked.')
            return redirect(request.path)
            
        password = request.POST.get('password')
        # Verify the user's own password for security (Sudo Mode)
        if request.user.check_password(password):
            request.session['confidential_unlocked'] = True
            messages.success(request, 'Confidential access granted.')
            return redirect(request.path)
        else:
            messages.error(request, 'Incorrect password. Access denied.')
            
    if not unlocked:
        return render(request, 'archives/confidential.html', {'unlocked': False})
        
    archives = ArchivedDocument.objects.filter(visibility='Internal Only').order_by('-date_archived')
    return render(request, 'archives/confidential.html', {'archives': archives, 'unlocked': True})

@login_required
def vetoed_view(request):
    """Restricted page for Vetoed Legislation"""
    if is_legislator(request.user):
        return redirect('archive') # Legislators can't see this
        
    # FIX: Query the main LegislativeDocument table where status='Vetoed'
    vetoed_docs = LegislativeDocument.objects.filter(status='Vetoed').order_by('-date_filed')
    
    return render(request, 'archives/vetoed.html', {'archives': vetoed_docs})

#CREATE ARCHIVE FOLDER VIEW
@login_required(login_url='login')
def create_archive_folder(request):
    if is_legislator(request.user):
        messages.error(request, 'Action Denied: Legislators cannot create folders.')
        return redirect('archive')

    if request.method == 'POST':
        folder_name = request.POST.get('new_folder_name')
        if folder_name:
            folder_name = folder_name.strip()
            if ArchiveFolder.objects.filter(name__iexact=folder_name).exists():
                messages.error(request, f"Folder '{folder_name}' already exists.")
            else:
                ArchiveFolder.objects.create(name=folder_name, created_by=request.user)
                messages.success(request, f"Folder '{folder_name}' created successfully!")
                
    return redirect('archive')


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

    # Exclude the current logged-in user from the list
    all_users = User.objects.all().exclude(id=request.user.id).order_by('-date_joined')
    
    search_query = request.GET.get('q', '')
    role_filter = request.GET.get('role', '')
    status_filter = request.GET.get('status', '')

    if search_query:
        all_users = all_users.filter(
            Q(username__icontains=search_query) | 
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(email__icontains=search_query)
        )

    if role_filter == 'admin':
        all_users = all_users.filter(is_superuser=True)
    elif role_filter == 'staff':
        all_users = all_users.filter(is_superuser=False, is_staff=True)
    elif role_filter == 'legislator':
        all_users = all_users.filter(is_superuser=False, is_staff=False)
        
    if status_filter == 'active':
        all_users = all_users.filter(is_active=True)
    elif status_filter == 'inactive':
        all_users = all_users.filter(is_active=False)

    total_records = all_users.count()
    
    # Pagination (Showing 10 users per page)
    paginator = Paginator(all_users, 5) 
    page_number = request.GET.get('page')
    paginated_users = paginator.get_page(page_number)

    context = {
        'users': paginated_users,
        'total_records': total_records,
        'current_filters': request.GET,
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
        role = request.POST.get('role')

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
            
            if role:
                if role == 'admin':
                    target_user.is_superuser = True
                    target_user.is_staff = True
                elif role == 'staff':
                    target_user.is_superuser = False
                    target_user.is_staff = True
                elif role == 'legislator':
                    target_user.is_superuser = False
                    target_user.is_staff = False

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
        status = request.POST.get('status', '1st Reading') # Default to '1st Reading' if not provided
        doc_type = request.POST.get('doc_type')
        year = request.POST.get('year')
        date_enacted = request.POST.get('date_enacted')
        sponsor = request.POST.get('sponsor')
        co_sponsors = request.POST.get('co_sponsors')
        visibility = request.POST.get('visibility')
        keywords = request.POST.get('keywords')
        physical_storage = request.POST.get('physical_storage')
        file_attachment = request.FILES.get('file_attachment')

        if LegislativeDocument.objects.filter(document_number=document_number).exists() or \
           ArchivedDocument.objects.filter(original_document_number=document_number).exists():
            messages.error(request, f'Upload failed: The Number "{document_number}" is already in use!')
            return redirect(request.META.get('HTTP_REFERER', 'dashboard'))
        
        if status == 'Archived':
            ArchivedDocument.objects.create(
                archive_id=f"ARC-{document_number}",
                original_document_number=document_number,
                title=title,
                doc_type=doc_type,
                year=year,
                date_enacted=date_enacted if date_enacted else None,
                sponsor=sponsor,
                co_sponsors=co_sponsors,
                visibility=visibility,
                keywords=keywords,
                physical_storage=physical_storage,
                file_attachment=file_attachment,
                original_date_filed=timezone.now().date(), 
                archived_by=request.user
            )
            messages.success(request, f'Document {document_number} uploaded directly to Archives.')
            return redirect('archive')

        # 3. Save the document to the database
        else:
            new_doc = LegislativeDocument.objects.create(
            title=title,
            document_number=document_number,
            doc_type=doc_type,
            year=year,                
            date_enacted=date_enacted if date_enacted else None, 
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
# 10. NOTIFICATIONS API
# ==========================================
def get_notifications(request):
    # Return 401 JSON for unauthenticated API requests instead of an HTML redirect
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    limit = int(request.GET.get('limit', 10))
    
    # Fetch recent audit logs. For simplicity, we'll use AuditLog as notifications.
    # You might want to create a dedicated Notification model for more complex scenarios.
    if is_legislator(request.user):
        # Legislators only see their own activity
        raw_notifications = AuditLog.objects.filter(user=request.user).order_by('-timestamp')[:limit + 1]
    else:
        # Admins/Staff see all activity
        raw_notifications = AuditLog.objects.all().order_by('-timestamp')[:limit + 1]

    has_more = len(raw_notifications) > limit
    notifications_to_send = raw_notifications[:limit]

    formatted_notifications = []
    for notif in notifications_to_send:
        
        # --- NEW: INCLUDE EXACT CHANGES IN NOTIFICATION ---
        doc_number = notif.document.document_number if notif.document else "a document"
        
        # SAFEGUARD: Provide a fallback name if the user account was deleted
        actor_name = notif.user.username if notif.user else "Unknown/Deleted User"
        
        if notif.action == 'Upload':
            message = f"<strong>New Upload:</strong> {doc_number} was uploaded by <strong>{actor_name}</strong>."
        elif notif.action == 'Edit':
            details_text = f"<br><span style='font-size:0.75rem; color:#888;'>{notif.details}</span>" if getattr(notif, 'details', None) else ""
            message = f"<strong>Document Updated:</strong> {doc_number} was modified by <strong>{actor_name}</strong>.{details_text}"
        else:
            message = f"<strong>System Action:</strong> {notif.action} document <strong>\"{doc_number}\"</strong>."
        
        formatted_notifications.append({
            'id': notif.id,
            'message': message,
            'time': timesince(notif.timestamp, timezone.now()) + ' ago'
        })

    return JsonResponse({
        'notifications': formatted_notifications,
        'has_more': has_more
    })

# ==========================================
# 9. EDIT DOCUMENT VIEW (WITH SMART UPDATE)
# ==========================================
@login_required(login_url='login')
def edit_document(request):
    if is_legislator(request.user):
        messages.error(request, 'Action Denied: Legislators have read-only access.')
        return redirect('documents')

    if request.method == 'POST':
        doc_id = request.POST.get('doc_id')
        try:
            doc = LegislativeDocument.objects.get(id=doc_id)
        except LegislativeDocument.DoesNotExist:
            messages.error(request, 'Document not found.')
            return redirect('documents')
        
 # --- SMART UPDATE & TRACKING LOGIC ---
        changes = []
        
        def update_field(attr_name, form_val, display_name):
            old_val = getattr(doc, attr_name)
            # Only update and log if the form provided a value AND it's different
            if form_val and str(old_val) != str(form_val):
                changes.append(f"{display_name} to '{form_val}'")
                setattr(doc, attr_name, form_val)

        update_field('title', request.POST.get('title'), 'Title')
        update_field('document_number', request.POST.get('document_number'), 'Ref No.')
        update_field('doc_type', request.POST.get('doc_type'), 'Category')
        update_field('year', request.POST.get('year'), 'Year')
        update_field('date_enacted', request.POST.get('date_enacted'), 'Date Enacted')
        update_field('sponsor', request.POST.get('sponsor'), 'Author')
        update_field('co_sponsors', request.POST.get('co_sponsors'), 'Co-Sponsors')
        update_field('keywords', request.POST.get('keywords'), 'Keywords')
        update_field('visibility', request.POST.get('visibility'), 'Visibility')
        update_field('physical_storage', request.POST.get('physical_storage'), 'Storage')
        
        old_status = doc.status
        new_status = request.POST.get('status')
        if new_status and new_status != old_status:
            changes.append(f"Status to '{new_status}'")
            doc.status = new_status

        # --- SAVE VETO REASON ---
        if doc.status == 'Vetoed':
            veto_note = request.POST.get('veto_reason')
            if veto_note and veto_note != getattr(doc, 'veto_reason', ''):
                doc.veto_reason = veto_note
                changes.append("added a Veto Reason")
        # -----------------------------

        if 'file_attachment' in request.FILES:
            doc.file_attachment = request.FILES['file_attachment']

        # --- ARCHIVING LOGIC ---
        if doc.status == 'Archived':
            try:
                with transaction.atomic():
                    archive_record = ArchivedDocument.objects.create(
                        archive_id=f"ARC-{doc.document_number}",
                        original_document_number=doc.document_number,
                        title=doc.title,
                        doc_type=doc.doc_type,
                        year=doc.year,
                        date_enacted=doc.date_enacted,
                        sponsor=doc.sponsor,
                        co_sponsors=doc.co_sponsors,
                        visibility=doc.visibility,
                        keywords=doc.keywords,
                        physical_storage=doc.physical_storage,
                        original_date_filed=doc.date_filed,
                        archived_by=request.user
                    )

                    # Safely attempt to copy the file. If missing locally, it fails gracefully.
                    if doc.file_attachment and doc.file_attachment.name:
                        try:
                            archive_record.file_attachment.save(
                                doc.file_attachment.name.split('/')[-1],
                                doc.file_attachment.file,
                                save=True
                            )
                        except FileNotFoundError:
                            pass # Missing local file, continue archiving without it
                    
                    doc.delete() # Remove original document after successful archive
                    messages.success(request, f'Document successfully moved to Archives.')
                    return redirect('archive')
                    
            except IntegrityError:
                messages.error(request, f'An archive for {doc.document_number} already exists.')
                return redirect(request.META.get('HTTP_REFERER', 'documents'))
            except Exception as e:
                messages.error(request, f'Failed to archive: {str(e)}')
                return redirect(request.META.get('HTTP_REFERER', 'documents'))
        else:
            doc.save()

            # Combine all changes into one string
            change_summary = "Changed " + ", ".join(changes) if changes else "No fields were changed"

            # --- NEW: CREATE AUDIT LOG FOR EDITS & STATUS CHANGES ---
            AuditLog.objects.create(
                user=request.user,
                action='Edit',
                document=doc,
                details=change_summary  # <-- Saves exactly what happened!
            )
            # --------------------------------------------------------

            messages.success(request, 'Document successfully updated.')
            return redirect(request.META.get('HTTP_REFERER', 'documents'))