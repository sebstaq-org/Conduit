# WebSocket live provider proof

Endpoint: `ws://127.0.0.1:4199/api/session`

This proof includes real provider answers captured from official SDK `session_notification` chunks, surfaced at `snapshot.last_prompt.agent_text_chunks`.

## codex

Commands: initialize=true, session/new=true, session/prompt=true, snapshot/get=true, provider/disconnect=true

Session: `019d7baf-3a95-7b53-a243-0bbbfa59bdf0`

Provider answer source: `official SDK session_notification -> snapshot.last_prompt.agent_text_chunks`

Provider answer:

> conduit-live-proof-codex confirmed.

Prompt result:

```json
{
  "stopReason": "end_turn"
}
```

## copilot

Commands: initialize=true, session/new=true, session/prompt=true, snapshot/get=true, provider/disconnect=true

Session: `74ea341c-26f4-4ac0-9fd4-a3dd168e5112`

Provider answer source: `official SDK session_notification -> snapshot.last_prompt.agent_text_chunks`

Provider answer:

> Here is the requested token: conduit-live-proof-copilot.

Prompt result:

```json
{
  "stopReason": "end_turn"
}
```

