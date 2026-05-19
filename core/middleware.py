from django.shortcuts import render
from django.urls import reverse
from django.contrib.auth.models import User
from core.models import SystemSetting

class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip maintenance check for these paths
        skip_paths = [
            '/admin/',
            '/login/',
            '/logout/',
            '/static/',
            '/settings/',
        ]
        
        # Check if current path should be skipped
        should_skip = False
        for path in skip_paths:
            if request.path.startswith(path):
                should_skip = True
                break
        
        # Also skip login page and maintenance page
        if request.path == reverse('login') or request.path == '/maintenance/':
            should_skip = True
        
        # Check if maintenance mode is enabled (from DATABASE directly)
        try:
            maintenance_mode = SystemSetting.get('maintenance_mode', False)
        except:
            maintenance_mode = False
        
        # Allow admin users to bypass maintenance mode
        is_admin = False
        if request.user.is_authenticated:
            is_admin = request.user.is_superuser
        
        # Debug print to terminal
        if maintenance_mode:
            print(f"[MAINTENANCE] Active: {maintenance_mode}, Path: {request.path}, Is Admin: {is_admin}, Skip: {should_skip}")
        
        # If maintenance mode is on and user is not admin and not on skip path
        if maintenance_mode and not is_admin and not should_skip:
            return render(request, 'admin_panel/maintenance.html', status=503)
        
        response = self.get_response(request)
        return response