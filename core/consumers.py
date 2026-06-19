import json
from channels.generic.websocket import AsyncWebsocketConsumer

class DocumentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'documents_group'
        # Join the broadcast group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave the broadcast group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # This function is called when the server wants to broadcast a message to the group
    async def document_uploaded(self, event):
        data = event['message']

        # Push the data to the frontend JavaScript
        await self.send(text_data=json.dumps({
            'type': 'new_document',
            'data': data
        }))

    # This function handles general system updates broadcasted by the backend
    async def system_update(self, event):
        data = event['message']
        await self.send(text_data=json.dumps({
            'type': 'system_update',
            'data': data
        }))

    # This function handles document updates
    async def document_updated(self, event):
        data = event['message']
        await self.send(text_data=json.dumps({
            'type': 'document_updated',
            'data': data
        }))

    # This function handles document deletions
    async def document_deleted(self, event):
        data = event['message']
        await self.send(text_data=json.dumps({
            'type': 'document_deleted',
            'data': data
        }))