export const MESSAGING_PERMISSIONS = [
  {
    name: 'messaging.conversations.create',
    description: 'Create conversations',
  },
  { name: 'messaging.conversations.read', description: 'Read conversations' },
  { name: 'messaging.messages.send', description: 'Send messages' },
  { name: 'messaging.messages.read', description: 'Read messages' },
  { name: 'messaging.keys.manage', description: 'Manage E2EE public keys' },
  { name: 'messaging.presence.read', description: 'Read user presence' },
  { name: 'messaging.presence.update', description: 'Update own presence' },
  {
    name: 'messaging.admin.read',
    description: 'Admin: browse all conversations',
  },
];
