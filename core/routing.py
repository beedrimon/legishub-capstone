from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/documents/', consumers.DocumentConsumer.as_asgi()),
]