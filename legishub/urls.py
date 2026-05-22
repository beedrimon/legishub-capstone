"""
URL configuration for legishub project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.login_view, name='login'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('logout/', views.logout_view, name='logout'),
    
    # Django built-in views for processing the reset link from the email
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(template_name='admin_panel/password_reset_confirm.html'), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(template_name='admin_panel/password_reset_complete.html'), name='password_reset_complete'),

    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('documents/', views.documents_view, name='documents'),
    path('audit_logs/', views.audit_logs_view, name='audit_logs'),
    path('user_management/', views.user_management_view, name='user_management'),
    path('create_user/', views.create_user_view, name='create_user'),
    path('edit_user/', views.edit_user_view, name='edit_user'),
    path('delete_user/<int:user_id>/', views.delete_user_view, name='delete_user'),
    path('toggle_permission/<int:user_id>/<str:perm_type>/', views.toggle_permission_view, name='toggle_permission'),

    #ARCHIVE VIEWS
    path('archive/', views.archive_view, name='archive'),
    path('ordinances/', views.ordinances_view, name='ordinances'),
    path('resolutions/', views.resolutions_view, name='resolutions'),
    path('confidential/', views.confidential_view, name='confidential'),
    path('vetoed/', views.vetoed_view, name='vetoed'),
    path('edit-vetoed/', views.edit_vetoed, name='edit_vetoed'),
    path('create_archive_folder/', views.create_archive_folder, name='create_archive_folder'),
 
    # USER SETTINGS/
    path('settings/general-info/', views.general_info_view, name='general_info'),
    path('settings/backup-cloud/', views.backup_cloud_view, name='backup_cloud'),
    # path('settings/metadata-tags/', views.metadata_tags_view, name='metadata_tags'),
    path('settings/security-policy/', views.security_policy_view, name='security_policy'),
    path('settings/notifications/', views.notifications_view, name='notifications'),
    path('maintenance/', views.maintenance_view, name='maintenance'),
    
    # SETTINGS API ENDPOINTS 
    # path('api/trigger-backup/', views.trigger_backup_api, name='trigger_backup'),
    path('api/test-email/', views.test_email_api, name='test_email'),
    path('api/notifications/', views.get_notifications, name='get_notifications'),

    # DOCUMENT MANAGEMENT 
    path('upload/', views.upload_document, name='upload_document'),
    path('edit-doc/', views.edit_document, name='edit_document'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
