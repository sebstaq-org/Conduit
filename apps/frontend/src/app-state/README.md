# Frontend Session Data Contract

`src/app-state` is the only frontend path for backend read-model fetching and
caching. Feature modules should consume RTK Query hooks from here, not
`@conduit/session-client`, `@conduit/session-contracts`, WebSocket transport, or
raw command dispatch directly.

The product-ready session API in this checkout is `useGetSessionGroupsQuery`.
It returns grouped sessions for the navigation UI through the Conduit read-model
shape, not the official ACP `session/list` shape.

The session transcript screen is still UI-only fixture work in this checkout.
Do not wire it to `ProviderSnapshot`, `LoadedTranscriptSnapshot`, `lastPrompt`,
`RawWireEvent`, `snapshot/get`, or `events/subscribe`; those are diagnostic or
transport surfaces until a timeline read-model endpoint exists here.

When session history is added, expose it here as RTK Query endpoints that read a
single timeline model. `session/load` replay, live `session/prompt` output, and
cancel completion should be projected by backend/client code before feature UI
renders it.
