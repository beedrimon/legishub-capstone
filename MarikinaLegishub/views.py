from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login
from django.contrib import messages
from django.contrib.auth.models import User

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

    return render(request, 'login.html')