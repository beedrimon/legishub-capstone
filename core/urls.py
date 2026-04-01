from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'), 
    path('documents/', views.documents, name='documents'),
    path('archive/', views.archive_view, name='archive'),
    path('audit-logs/', views.audit_logs_view, name='audit_logs'),
    path('user-management/', views.user_management_view, name='user_management'),
]