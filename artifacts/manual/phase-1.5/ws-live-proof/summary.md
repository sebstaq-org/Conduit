# WebSocket live provider proof

Endpoint: `ws://127.0.0.1:4199/api/session`

## codex

Commands: initialize=true, session/new=true, session/prompt=true, snapshot/get=true, provider/disconnect=true

Session: `019d7baf-3a95-7b53-a243-0bbbfa59bdf0`

Agent text:

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

Agent text:

> Here is the requested token: conduit-live-proof-copilot.

Prompt result:

```json
{
  "stopReason": "end_turn"
}
```

