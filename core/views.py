from django.shortcuts import render

# Create your views here.
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from .models import LegislativeDocument, AuditLog # <-- Add this line near your other imports

# ==========================================
# 1. LOGIN VIEW
# ==========================================
def login_view(request):
    # If the user is already logged in, send them to the dashboard
    if request.user.is_authenticated:
        return redirect('dashboard') # Replace 'dashboard' with your home URL name

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        try:
            # Django auth expects a username, so we find the user by email first
            user_obj = User.objects.get(email=email)
            username = user_obj.username
        except User.DoesNotExist:
            username = None

        # Authenticate the user
        user = authenticate(request, username=username, password=password)

        if user is not None:
            auth_login(request, user)
            return redirect('dashboard') # Replace 'dashboard' with your home URL name
        else:
            # If authentication fails, send an error message to the template
            messages.error(request, 'Invalid email or password. Please try again.')

        return redirect('dashboard')

    return render(request, 'index.html')

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
    recent_documents = LegislativeDocument.objects.all().order_by('-date_filed')[:5]

    # 3. FETCH RECENT AUDIT LOGS
    # Get the 5 most recent actions taken by users
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
    }

    return render(request, 'dashboard.html', context)

# ==========================================
# 4. DOCUMENTS VIEW
# ==========================================
@login_required(login_url='login')
def documents_view(request):
    return render(request, 'documents.html')

# ==========================================
# 4. ARCHIVE VIEW
# ==========================================
@login_required(login_url='login')
def archive_view(request):
    return render(request, 'archive.html')


# ==========================================
# 5. AUDIT LOGS VIEW
# ==========================================
@login_required(login_url='login')
def audit_logs_view(request):
    return render(request, 'audit_logs.html')

# ==========================================
# 6. USER MANAGEMENT VIEW
# ==========================================
@login_required(login_url='login')
def user_management_view(request):
    return render(request, 'user_management.html')

# ==========================================
# 7. UPLOAD DOCUMENT VIEW
# ==========================================
@login_required(login_url='login')
def upload_document(request):
    if request.method == 'POST':
        # 1. Grab all text data from the HTML form
        title = request.POST.get('title')
        document_number = request.POST.get('document_number')
        doc_type = request.POST.get('doc_type')
        year = request.POST.get('year')
        
        # New fields from your modal
        date_enacted = request.POST.get('date_enacted')
        sponsor = request.POST.get('sponsor')
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
            visibility=visibility,
            keywords=keywords,
            physical_storage=physical_storage,
            file_attachment=file_attachment,
            uploaded_by=request.user,
            status='Pending'
        )

        # 4. Save an Audit Log entry
        AuditLog.objects.create(
            user=request.user,
            action='Upload',
            document=new_doc
        )

        messages.success(request, 'Document successfully uploaded!')
        
    return redirect('dashboard')