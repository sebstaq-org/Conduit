# Frontend Session Data Contract

`src/app-state` is the only frontend path for backend read-model fetching and
caching. Feature modules should consume RTK Query hooks from here, not
`@conduit/session-client`, `@conduit/session-contracts`, WebSocket transport, or
raw command dispatch directly.

The product session APIs in this checkout are `useListProjectsQuery`,
`useAddProjectMutation`, `useRemoveProjectMutation`,
`useUpdateProjectMutation`, `useGetProjectSuggestionsQuery`,
`useGetSessionGroupsQuery`, `useOpenSessionMutation`,
`useReadSessionHistoryQuery`, `usePromptSessionMutation`, and
`useGetRuntimeHealthQuery`. They return
Conduit read-model shapes for UI state, not raw official ACP provider responses.

`useGetSessionGroupsQuery` is scoped by the persisted projects list. Feature UI
should add or remove projects through the project hooks instead of passing cwd
filters into the sessions query.

Do not wire feature UI to `ProviderSnapshot`, `LoadedTranscriptSnapshot`,
`lastPrompt`, `RawWireEvent`, raw command dispatch, or backend provider internals.
The product event path is `sessions/watch` and `session/watch`, surfaced through
the client subscription methods in `src/app-state`.

Session history is cursor-windowed. The latest window is fetched without a
cursor, older windows use `nextCursor`, and live `session/prompt` output is
projected into the same timeline model before feature UI renders it.

The session transport URL is required through
`EXPO_PUBLIC_CONDUIT_SESSION_WS_URL`. Frontend fails fast when the variable is
missing, empty, or not a `ws://` or `wss://` URL.
Runtime health uses the same host and port and polls `http(s)://.../health`.
