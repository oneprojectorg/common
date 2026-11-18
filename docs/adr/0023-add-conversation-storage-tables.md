# 0023. Add conversation storage tables

Date: 2026-11-18

## Status

Proposed

## Context

## Decision

### Schema

```sql
CREATE TABLE sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid REFERENCES decision_phone_numbers (id) ON DELETE SET NULL,
  auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  counterpart_e164 text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  provider_sid text,
  segments integer,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sms_messages_provider_sid_uniq
  ON sms_messages (provider_sid)
  WHERE provider_sid IS NOT NULL;

CREATE INDEX sms_messages_line_created_idx
  ON sms_messages (phone_number_id, created_at);

CREATE TABLE conversation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES decision_chat_sessions (id) ON DELETE CASCADE,
  run_id uuid,
  kind text NOT NULL
    CHECK (kind IN ('message', 'tool_call', 'tool_output', 'command')),
  role text CHECK (role IN ('user', 'assistant')),
  content jsonb NOT NULL,
  sms_message_id uuid REFERENCES sms_messages (id) ON DELETE SET NULL,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_items_session_created_idx
  ON conversation_items (session_id, created_at);
```

### Entity diagram

```mermaid
erDiagram
  decision_phone_numbers ||--o{ sms_messages : carries
  decision_phone_numbers ||--o{ decision_chat_sessions : anchors
  decision_process_instances ||--o{ decision_chat_sessions : scopes
  profiles ||--o{ decision_chat_sessions : owns
  decision_chat_sessions ||--o{ conversation_items : holds
  sms_messages |o--o{ conversation_items : "crossed the wire as"

  sms_messages {
    uuid id PK
    uuid phone_number_id FK
    uuid auth_user_id FK
    text counterpart_e164
    text direction
    text body
    text provider_sid
    integer segments
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  conversation_items {
    uuid id PK
    uuid session_id FK
    uuid run_id
    text kind
    text role
    jsonb content
    uuid sms_message_id FK
    text prompt_version
    timestamptz created_at
  }

  decision_chat_sessions {
    uuid id PK
    uuid process_instance_id FK
    uuid profile_id FK
    uuid phone_number_id FK
    integer page_cursor
    timestamptz reopened_at
  }
```

## Consequences
