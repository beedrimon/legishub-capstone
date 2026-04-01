from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User

# ==========================================
# 1. LOGIN VIEW
# ==========================================
def login_view(request):
    # If the user is already logged in, send them to the dashboard
    if request.user.is_authenticated:
        return redirect('dashboard') # Replace 'dashboard' with your home URL name

    if request.method == 'POST':
        """email = request.POST.get('email')
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
    """
        return redirect('dashboard')

    return render(request, 'index.html')

# ==========================================
# 2. DASHBOARD VIEW
# ==========================================
# @login_required(login_url='login')  <-- Uncomment this to force users to log in first!
def dashboard_view(request):
    
    # Dummy data for the frontend
    recent_documents = [
        {'title': 'Ord. 2024-05: Waste Management Act', 'category': 'Ordinance', 'date_filed': 'Oct 24, 2025', 'status': 'Active'},
        {'title': 'Res. 102: Flood Mitigation Plan', 'category': 'Resolution', 'date_filed': 'Oct 22, 2025', 'status': 'Active'},
    ]

    audit_logs = [
        {'time': '10:15 AM', 'user': 'J. Moral', 'action': 'uploaded', 'target': 'Ord-2024-06'},
    ]

    context = {
        'total_ordinances': '1,248',
        'total_resolutions': '856',
        'pending_review': '12',
        'recent_uploads_count': '42',
        'recent_documents': recent_documents,
        'audit_logs': audit_logs,
        'last_backup_date': 'March 06, 10:00 AM',
    }

    return render(request, 'dashboard.html', context)
