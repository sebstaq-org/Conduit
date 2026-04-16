/* eslint-disable max-lines -- generated backend-owned contract surface. */
// GENERATED FILE. DO NOT EDIT.
// Source: scripts/generate-app-protocol.ts

import Ajv2020 from "ajv/dist/2020.js";
import type { Options, ValidateFunction } from "ajv";

export namespace ClientCommandFrameTypes {
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ClientCommandFrameType".
   */
  export type ClientCommandFrameType = "command";
  /**
   * One stable wire command envelope accepted by the product transport.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ConsumerCommand".
   */
  export type ConsumerCommand =
    | {
        /**
         * Stable command discriminator.
         */
        command: "initialize";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/new";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd for the new session.
           */
          cwd: string;
          /**
           * Optional initial transcript window size.
           */
          limit?: number | null;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/set_config_option";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * ACP config option identifier.
           */
          configId: string;
          /**
           * Provider ACP session identifier.
           */
          sessionId: string;
          /**
           * Selected config value identifier.
           */
          value: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/prompt";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
          /**
           * ACP content blocks for the prompt.
           */
          prompt: ContentBlock[];
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/cancel";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Provider ACP session identifier.
           */
          session_id: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "provider/disconnect";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/add";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd to add as a project.
           */
          cwd: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/list";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/remove";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Stable project identity to remove.
           */
          projectId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/suggestions";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional result limit.
           */
          limit?: number | null;
          /**
           * Optional substring filter.
           */
          query?: string | null;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/update";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * New display label for the project.
           */
          displayName: string;
          /**
           * Stable project identity to update.
           */
          projectId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "settings/get";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "settings/update";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Default lookback window for `sessions/grouped`.
           */
          sessionGroupsUpdatedWithinDays?: number | null;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "sessions/grouped";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional lookback window in days.
           */
          updatedWithinDays?: number | null;
        };
        /**
         * Command target.
         */
        provider: ("claude" | "copilot" | "codex") | "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "sessions/watch";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "providers/config_snapshot";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/open";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd identity for the session.
           */
          cwd: string;
          /**
           * Optional transcript window size.
           */
          limit?: number | null;
          /**
           * Provider ACP session identifier.
           */
          sessionId: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/history";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional older-page cursor.
           */
          cursor?: string | null;
          /**
           * Optional history window size.
           */
          limit?: number | null;
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/watch";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      };
  /**
   * One provider target accepted by consumer commands.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ConsumerCommandTarget".
   */
  export type ConsumerCommandTarget = ("claude" | "copilot" | "codex") | "all";
  /**
   * Global provider target for commands that must fan out through Conduit.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "GlobalProviderTarget".
   */
  export type GlobalProviderTarget = "all";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "InitializeCommandLiteral".
   */
  export type InitializeCommandLiteral = "initialize";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsAddCommandLiteral".
   */
  export type ProjectsAddCommandLiteral = "projects/add";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsListCommandLiteral".
   */
  export type ProjectsListCommandLiteral = "projects/list";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsRemoveCommandLiteral".
   */
  export type ProjectsRemoveCommandLiteral = "projects/remove";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsSuggestionsCommandLiteral".
   */
  export type ProjectsSuggestionsCommandLiteral = "projects/suggestions";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsUpdateCommandLiteral".
   */
  export type ProjectsUpdateCommandLiteral = "projects/update";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProviderDisconnectCommandLiteral".
   */
  export type ProviderDisconnectCommandLiteral = "provider/disconnect";
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProvidersConfigSnapshotCommandLiteral".
   */
  export type ProvidersConfigSnapshotCommandLiteral =
    "providers/config_snapshot";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionCancelCommandLiteral".
   */
  export type SessionCancelCommandLiteral = "session/cancel";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionHistoryCommandLiteral".
   */
  export type SessionHistoryCommandLiteral = "session/history";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionNewCommandLiteral".
   */
  export type SessionNewCommandLiteral = "session/new";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionOpenCommandLiteral".
   */
  export type SessionOpenCommandLiteral = "session/open";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionPromptCommandLiteral".
   */
  export type SessionPromptCommandLiteral = "session/prompt";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionSetConfigOptionCommandLiteral".
   */
  export type SessionSetConfigOptionCommandLiteral =
    "session/set_config_option";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionWatchCommandLiteral".
   */
  export type SessionWatchCommandLiteral = "session/watch";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionsGroupedCommandLiteral".
   */
  export type SessionsGroupedCommandLiteral = "sessions/grouped";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionsWatchCommandLiteral".
   */
  export type SessionsWatchCommandLiteral = "sessions/watch";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SettingsGetCommandLiteral".
   */
  export type SettingsGetCommandLiteral = "settings/get";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SettingsUpdateCommandLiteral".
   */
  export type SettingsUpdateCommandLiteral = "settings/update";

  /**
   * Versioned WebSocket frame carrying a client command.
   */
  export interface ClientCommandFrame {
    /**
     * Consumer command payload.
     */
    command:
      | {
          /**
           * Stable command discriminator.
           */
          command: "initialize";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/new";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Absolute normalized cwd for the new session.
             */
            cwd: string;
            /**
             * Optional initial transcript window size.
             */
            limit?: number | null;
          };
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/set_config_option";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * ACP config option identifier.
             */
            configId: string;
            /**
             * Provider ACP session identifier.
             */
            sessionId: string;
            /**
             * Selected config value identifier.
             */
            value: string;
          };
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/prompt";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Open-session identity allocated by Conduit.
             */
            openSessionId: string;
            /**
             * ACP content blocks for the prompt.
             */
            prompt: ContentBlock[];
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/cancel";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Provider ACP session identifier.
             */
            session_id: string;
          };
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "provider/disconnect";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "projects/add";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Absolute normalized cwd to add as a project.
             */
            cwd: string;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "projects/list";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "projects/remove";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Stable project identity to remove.
             */
            projectId: string;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "projects/suggestions";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Optional result limit.
             */
            limit?: number | null;
            /**
             * Optional substring filter.
             */
            query?: string | null;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "projects/update";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * New display label for the project.
             */
            displayName: string;
            /**
             * Stable project identity to update.
             */
            projectId: string;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "settings/get";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "settings/update";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Default lookback window for `sessions/grouped`.
             */
            sessionGroupsUpdatedWithinDays?: number | null;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "sessions/grouped";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Optional lookback window in days.
             */
            updatedWithinDays?: number | null;
          };
          /**
           * Command target.
           */
          provider: ("claude" | "copilot" | "codex") | "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "sessions/watch";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "providers/config_snapshot";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {};
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/open";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Absolute normalized cwd identity for the session.
             */
            cwd: string;
            /**
             * Optional transcript window size.
             */
            limit?: number | null;
            /**
             * Provider ACP session identifier.
             */
            sessionId: string;
          };
          /**
           * Command target.
           */
          provider: "claude" | "copilot" | "codex";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/history";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Optional older-page cursor.
             */
            cursor?: string | null;
            /**
             * Optional history window size.
             */
            limit?: number | null;
            /**
             * Open-session identity allocated by Conduit.
             */
            openSessionId: string;
          };
          /**
           * Command target.
           */
          provider: "all";
        }
      | {
          /**
           * Stable command discriminator.
           */
          command: "session/watch";
          /**
           * Caller-owned request id echoed in the response.
           */
          id: string;
          /**
           * Command params.
           */
          params: {
            /**
             * Open-session identity allocated by Conduit.
             */
            openSessionId: string;
          };
          /**
           * Command target.
           */
          provider: "all";
        };
    /**
     * Correlation id echoed in responses.
     */
    id: string;
    /**
     * Stable frame discriminator.
     */
    type: "command";
    /**
     * Transport protocol version.
     */
    v: number;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * Empty object params for commands without a request payload.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "EmptyParams".
   */
  export interface EmptyParams {}
  /**
   * Request payload for `settings/update`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "GlobalSettingsUpdateRequest".
   */
  export interface GlobalSettingsUpdateRequest {
    /**
     * Default lookback window for `sessions/grouped`.
     */
    sessionGroupsUpdatedWithinDays?: number | null;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * Wire command envelope for `initialize`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "InitializeConsumerCommand".
   */
  export interface InitializeConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "initialize";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Request payload for `projects/add`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectAddRequest".
   */
  export interface ProjectAddRequest {
    /**
     * Absolute normalized cwd to add as a project.
     */
    cwd: string;
  }
  /**
   * Request payload for `projects/remove`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectRemoveRequest".
   */
  export interface ProjectRemoveRequest {
    /**
     * Stable project identity to remove.
     */
    projectId: string;
  }
  /**
   * Query payload for `projects/suggestions`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectSuggestionsQuery".
   */
  export interface ProjectSuggestionsQuery {
    /**
     * Optional result limit.
     */
    limit?: number | null;
    /**
     * Optional substring filter.
     */
    query?: string | null;
  }
  /**
   * Request payload for `projects/update`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectUpdateRequest".
   */
  export interface ProjectUpdateRequest {
    /**
     * New display label for the project.
     */
    displayName: string;
    /**
     * Stable project identity to update.
     */
    projectId: string;
  }
  /**
   * Wire command envelope for `projects/add`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsAddConsumerCommand".
   */
  export interface ProjectsAddConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "projects/add";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Absolute normalized cwd to add as a project.
       */
      cwd: string;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `projects/list`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsListConsumerCommand".
   */
  export interface ProjectsListConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "projects/list";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `projects/remove`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsRemoveConsumerCommand".
   */
  export interface ProjectsRemoveConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "projects/remove";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Stable project identity to remove.
       */
      projectId: string;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `projects/suggestions`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsSuggestionsConsumerCommand".
   */
  export interface ProjectsSuggestionsConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "projects/suggestions";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Optional result limit.
       */
      limit?: number | null;
      /**
       * Optional substring filter.
       */
      query?: string | null;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `projects/update`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProjectsUpdateConsumerCommand".
   */
  export interface ProjectsUpdateConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "projects/update";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * New display label for the project.
       */
      displayName: string;
      /**
       * Stable project identity to update.
       */
      projectId: string;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `provider/disconnect`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProviderDisconnectConsumerCommand".
   */
  export interface ProviderDisconnectConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "provider/disconnect";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Wire command envelope for `providers/config_snapshot`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ProvidersConfigSnapshotConsumerCommand".
   */
  export interface ProvidersConfigSnapshotConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "providers/config_snapshot";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Wire command envelope for `session/cancel`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionCancelConsumerCommand".
   */
  export interface SessionCancelConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/cancel";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Provider ACP session identifier.
       */
      session_id: string;
    };
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Request payload for `session/cancel`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionCancelRequest".
   */
  export interface SessionCancelRequest {
    /**
     * Provider ACP session identifier.
     */
    session_id: string;
  }
  /**
   * Query parameters for `sessions/grouped`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionGroupsQuery".
   */
  export interface SessionGroupsQuery {
    /**
     * Optional lookback window in days.
     */
    updatedWithinDays?: number | null;
  }
  /**
   * Wire command envelope for `session/history`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionHistoryConsumerCommand".
   */
  export interface SessionHistoryConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/history";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Optional older-page cursor.
       */
      cursor?: string | null;
      /**
       * Optional history window size.
       */
      limit?: number | null;
      /**
       * Open-session identity allocated by Conduit.
       */
      openSessionId: string;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Request payload for `session/history`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionHistoryRequest".
   */
  export interface SessionHistoryRequest {
    /**
     * Optional older-page cursor.
     */
    cursor?: string | null;
    /**
     * Optional history window size.
     */
    limit?: number | null;
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
  }
  /**
   * Wire command envelope for `session/new`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionNewConsumerCommand".
   */
  export interface SessionNewConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/new";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Absolute normalized cwd for the new session.
       */
      cwd: string;
      /**
       * Optional initial transcript window size.
       */
      limit?: number | null;
    };
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Request payload for `session/new`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionNewRequest".
   */
  export interface SessionNewRequest {
    /**
     * Absolute normalized cwd for the new session.
     */
    cwd: string;
    /**
     * Optional initial transcript window size.
     */
    limit?: number | null;
  }
  /**
   * Wire command envelope for `session/open`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionOpenConsumerCommand".
   */
  export interface SessionOpenConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/open";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Absolute normalized cwd identity for the session.
       */
      cwd: string;
      /**
       * Optional transcript window size.
       */
      limit?: number | null;
      /**
       * Provider ACP session identifier.
       */
      sessionId: string;
    };
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Request payload for `session/open`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionOpenRequest".
   */
  export interface SessionOpenRequest {
    /**
     * Absolute normalized cwd identity for the session.
     */
    cwd: string;
    /**
     * Optional transcript window size.
     */
    limit?: number | null;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
  /**
   * Wire command envelope for `session/prompt`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionPromptConsumerCommand".
   */
  export interface SessionPromptConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/prompt";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Open-session identity allocated by Conduit.
       */
      openSessionId: string;
      /**
       * ACP content blocks for the prompt.
       */
      prompt: ContentBlock[];
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Request payload for `session/prompt`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionPromptRequest".
   */
  export interface SessionPromptRequest {
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
    /**
     * ACP content blocks for the prompt.
     */
    prompt: ContentBlock[];
  }
  /**
   * Wire command envelope for `session/set_config_option`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionSetConfigOptionConsumerCommand".
   */
  export interface SessionSetConfigOptionConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/set_config_option";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * ACP config option identifier.
       */
      configId: string;
      /**
       * Provider ACP session identifier.
       */
      sessionId: string;
      /**
       * Selected config value identifier.
       */
      value: string;
    };
    /**
     * Command target.
     */
    provider: "claude" | "copilot" | "codex";
  }
  /**
   * Request payload for `session/set_config_option`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionSetConfigOptionRequest".
   */
  export interface SessionSetConfigOptionRequest {
    /**
     * ACP config option identifier.
     */
    configId: string;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
    /**
     * Selected config value identifier.
     */
    value: string;
  }
  /**
   * Wire command envelope for `session/watch`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionWatchConsumerCommand".
   */
  export interface SessionWatchConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "session/watch";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Open-session identity allocated by Conduit.
       */
      openSessionId: string;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Request payload for `session/watch`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionWatchRequest".
   */
  export interface SessionWatchRequest {
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
  }
  /**
   * Wire command envelope for `sessions/grouped`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionsGroupedConsumerCommand".
   */
  export interface SessionsGroupedConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "sessions/grouped";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Optional lookback window in days.
       */
      updatedWithinDays?: number | null;
    };
    /**
     * Command target.
     */
    provider: ("claude" | "copilot" | "codex") | "all";
  }
  /**
   * Wire command envelope for `sessions/watch`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SessionsWatchConsumerCommand".
   */
  export interface SessionsWatchConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "sessions/watch";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `settings/get`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SettingsGetConsumerCommand".
   */
  export interface SettingsGetConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "settings/get";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {};
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Wire command envelope for `settings/update`.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "SettingsUpdateConsumerCommand".
   */
  export interface SettingsUpdateConsumerCommand {
    /**
     * Stable command discriminator.
     */
    command: "settings/update";
    /**
     * Caller-owned request id echoed in the response.
     */
    id: string;
    /**
     * Command params.
     */
    params: {
      /**
       * Default lookback window for `sessions/grouped`.
       */
      sessionGroupsUpdatedWithinDays?: number | null;
    };
    /**
     * Command target.
     */
    provider: "all";
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `ClientCommandFrame`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type ClientCommandFrame = ClientCommandFrameTypes.ClientCommandFrame;

export namespace ConnectionStateTypes {
  /**
   * The current host connection state.
   */
  export type ConnectionState = "disconnected" | "ready";
}

export type ConnectionState = ConnectionStateTypes.ConnectionState;

export namespace ConsumerCommandTypes {
  /**
   * One stable wire command envelope accepted by the product transport.
   */
  export type ConsumerCommand =
    | {
        /**
         * Stable command discriminator.
         */
        command: "initialize";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/new";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd for the new session.
           */
          cwd: string;
          /**
           * Optional initial transcript window size.
           */
          limit?: number | null;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/set_config_option";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * ACP config option identifier.
           */
          configId: string;
          /**
           * Provider ACP session identifier.
           */
          sessionId: string;
          /**
           * Selected config value identifier.
           */
          value: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/prompt";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
          /**
           * ACP content blocks for the prompt.
           */
          prompt: ContentBlock[];
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/cancel";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Provider ACP session identifier.
           */
          session_id: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "provider/disconnect";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/add";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd to add as a project.
           */
          cwd: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/list";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/remove";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Stable project identity to remove.
           */
          projectId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/suggestions";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional result limit.
           */
          limit?: number | null;
          /**
           * Optional substring filter.
           */
          query?: string | null;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "projects/update";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * New display label for the project.
           */
          displayName: string;
          /**
           * Stable project identity to update.
           */
          projectId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "settings/get";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "settings/update";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Default lookback window for `sessions/grouped`.
           */
          sessionGroupsUpdatedWithinDays?: number | null;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "sessions/grouped";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional lookback window in days.
           */
          updatedWithinDays?: number | null;
        };
        /**
         * Command target.
         */
        provider: ("claude" | "copilot" | "codex") | "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "sessions/watch";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "providers/config_snapshot";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {};
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/open";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Absolute normalized cwd identity for the session.
           */
          cwd: string;
          /**
           * Optional transcript window size.
           */
          limit?: number | null;
          /**
           * Provider ACP session identifier.
           */
          sessionId: string;
        };
        /**
         * Command target.
         */
        provider: "claude" | "copilot" | "codex";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/history";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Optional older-page cursor.
           */
          cursor?: string | null;
          /**
           * Optional history window size.
           */
          limit?: number | null;
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      }
    | {
        /**
         * Stable command discriminator.
         */
        command: "session/watch";
        /**
         * Caller-owned request id echoed in the response.
         */
        id: string;
        /**
         * Command params.
         */
        params: {
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
        };
        /**
         * Command target.
         */
        provider: "all";
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;

  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
}

export type ConsumerCommand = ConsumerCommandTypes.ConsumerCommand;

export namespace ConsumerCommandNameTypes {
  /**
   * Stable set of supported consumer command names.
   */
  export type ConsumerCommandName =
    | "initialize"
    | "session/new"
    | "session/set_config_option"
    | "session/prompt"
    | "session/cancel"
    | "provider/disconnect"
    | "projects/add"
    | "projects/list"
    | "projects/remove"
    | "projects/suggestions"
    | "projects/update"
    | "settings/get"
    | "settings/update"
    | "sessions/grouped"
    | "sessions/watch"
    | "providers/config_snapshot"
    | "session/open"
    | "session/history"
    | "session/watch";
}

export type ConsumerCommandName = ConsumerCommandNameTypes.ConsumerCommandName;

export namespace ConsumerCommandTargetTypes {
  /**
   * One provider target accepted by consumer commands.
   */
  export type ConsumerCommandTarget = ("claude" | "copilot" | "codex") | "all";
}

export type ConsumerCommandTarget =
  ConsumerCommandTargetTypes.ConsumerCommandTarget;

export namespace ConsumerErrorTypes {
  /**
   * Stable consumer error envelope.
   */
  export interface ConsumerError {
    /**
     * Stable machine-readable error code.
     */
    code: string;
    /**
     * Human-readable error details.
     */
    message: string;
  }
}

export type ConsumerError = ConsumerErrorTypes.ConsumerError;

export namespace ConsumerResponseTypes {
  /**
   * Describes an available authentication method.
   *
   * The `type` field acts as the discriminator in the serialized JSON form.
   * When no `type` is present, the method is treated as `agent`.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "AuthMethod".
   */
  export type AuthMethod = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  };
  /**
   * The current host connection state.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ConnectionState".
   */
  export type ConnectionState = "disconnected" | "ready";
  /**
   * The normalized prompt lifecycle state for a single session turn.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "PromptLifecycleState".
   */
  export type PromptLifecycleState =
    | "idle"
    | "running"
    | "completed"
    | "cancelled";
  /**
   * Protocol version identifier.
   *
   * This version is only bumped for breaking changes.
   * Non-breaking changes should be introduced via capabilities.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ProtocolVersion".
   */
  export type ProtocolVersion = number;
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * One stable consumer response envelope.
   */
  export interface ConsumerResponse {
    /**
     * Stable error payload when `ok` is false.
     */
    error?: ConsumerError | null;
    /**
     * Caller-owned request id echoed from the command.
     */
    id: string;
    /**
     * Whether the command completed successfully.
     */
    ok: boolean;
    /**
     * ACP result payload or Conduit-owned command result.
     */
    result: {
      [k: string]: unknown;
    };
    /**
     * Read-side snapshot after command handling when available.
     */
    snapshot?: ProviderSnapshot | null;
  }
  /**
   * Stable consumer error envelope.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ConsumerError".
   */
  export interface ConsumerError {
    /**
     * Stable machine-readable error code.
     */
    code: string;
    /**
     * Human-readable error details.
     */
    message: string;
  }
  /**
   * The current provider snapshot exposed to apps and proof tooling.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ProviderSnapshot".
   */
  export interface ProviderSnapshot {
    /**
     * The provider-reported auth methods from the live initialize result.
     */
    auth_methods: unknown[];
    /**
     * The provider-reported capabilities from the live initialize result.
     */
    capabilities: {
      [k: string]: unknown;
    };
    /**
     * The current connection state.
     */
    connection_state: "disconnected" | "ready";
    /**
     * The locked launcher truth and initialize probe provenance.
     */
    discovery: {
      /**
       * Human-readable auth hints surfaced by the adapter.
       */
      auth_hints: string[];
      /**
       * The raw initialize result when probing succeeded.
       */
      initialize_probe: {
        /**
         * The measured initialize response time in milliseconds.
         */
        elapsed_ms: number;
        /**
         * The typed initialize response payload.
         */
        payload: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Capabilities supported by the agent.
           */
          agentCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/load`.
             */
            loadSession?: boolean;
            /**
             * MCP capabilities supported by the agent.
             */
            mcpCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`McpServer::Http`].
               */
              http?: boolean;
              /**
               * Agent supports [`McpServer::Sse`].
               */
              sse?: boolean;
              [k: string]: unknown;
            };
            /**
             * Prompt capabilities supported by the agent.
             */
            promptCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`ContentBlock::Audio`].
               */
              audio?: boolean;
              /**
               * Agent supports embedded context in `session/prompt` requests.
               *
               * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
               * in prompt requests for pieces of context that are referenced in the message.
               */
              embeddedContext?: boolean;
              /**
               * Agent supports [`ContentBlock::Image`].
               */
              image?: boolean;
              [k: string]: unknown;
            };
            /**
             * Session capabilities supported by the agent.
             *
             * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
             *
             * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
             *
             * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
             *
             * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
             */
            sessionCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Whether the agent supports `session/list`.
               */
              list?: SessionListCapabilities | null;
              [k: string]: unknown;
            };
            [k: string]: unknown;
          };
          /**
           * Information about the Agent name and version sent to the Client.
           *
           * Note: in future versions of the protocol, this will be required.
           */
          agentInfo?: Implementation | null;
          /**
           * Authentication methods supported by the agent.
           */
          authMethods?: AuthMethod[];
          /**
           * The protocol version the client specified if supported by the agent,
           * or the latest protocol version supported by the agent.
           *
           * The client should disconnect, if it doesn't support this version.
           */
          protocolVersion: number;
          [k: string]: unknown;
        };
        /**
         * The raw initialize response envelope.
         */
        response: {
          [k: string]: unknown;
        };
        /**
         * The raw stderr lines observed during initialize.
         */
        stderr_lines: string[];
        /**
         * The raw stdout lines observed during initialize.
         */
        stdout_lines: string[];
        [k: string]: unknown;
      };
      /**
       * Whether `initialize` completed successfully.
       */
      initialize_viable: boolean;
      /**
       * The launcher command locked by policy.
       */
      launcher: {
        /**
         * The actual argv that Conduit will pass after the executable.
         */
        args: string[];
        /**
         * The human-readable command string fixed by policy.
         */
        display: string;
        /**
         * The resolved executable path after discovery.
         */
        executable: string;
        [k: string]: unknown;
      };
      /**
       * The provider identifier.
       */
      provider: "claude" | "copilot" | "codex";
      /**
       * The resolved binary path.
       */
      resolved_path: string;
      /**
       * Diagnostics gathered during probing.
       */
      transport_diagnostics: string[];
      /**
       * The version reported by the adapter.
       */
      version: string;
      [k: string]: unknown;
    };
    /**
     * The last observed prompt lifecycle, if any.
     */
    last_prompt?: PromptLifecycleSnapshot | null;
    /**
     * The live sessions currently tracked in memory.
     */
    live_sessions: LiveSessionSnapshot[];
    /**
     * Transcript replays captured during `session/load`.
     */
    loaded_transcripts?: LoadedTranscriptSnapshot[];
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * Capabilities for the `session/list` method.
   *
   * By supplying `{}` it means that the agent supports listing of sessions.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "SessionListCapabilities".
   */
  export interface SessionListCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  }
  /**
   * Metadata about the implementation of the client or agent.
   * Describes the name and version of an MCP implementation, with an optional
   * title for UI representation.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "Implementation".
   */
  export interface Implementation {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Intended for programmatic or logical use, but can be used as a display
     * name fallback if title isn’t present.
     */
    name: string;
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood.
     *
     * If not provided, the name should be used for display.
     */
    title?: string | null;
    /**
     * Version of the implementation. Can be displayed to the user or used
     * for debugging or metrics purposes. (e.g. "1.0.0").
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * A normalized prompt lifecycle snapshot backed by raw ACP updates.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "PromptLifecycleSnapshot".
   */
  export interface PromptLifecycleSnapshot {
    /**
     * Agent-authored text chunks observed through official SDK notifications.
     */
    agent_text_chunks?: string[];
    /**
     * The session the prompt belongs to.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of raw session/update notifications observed during the turn.
     */
    raw_update_count: number;
    /**
     * The current lifecycle state.
     */
    state: "idle" | "running" | "completed" | "cancelled";
    /**
     * The ACP stop reason when available.
     */
    stop_reason?: string | null;
    /**
     * Ordered raw ACP `session/update` notifications observed during the turn.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "TranscriptUpdateSnapshot".
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * A normalized live session snapshot anchored to ACP truth.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "LiveSessionSnapshot".
   */
  export interface LiveSessionSnapshot {
    /**
     * The provider-reported or Conduit-observed working directory.
     */
    cwd: string;
    /**
     * The exact live identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * Whether the session was observed via `new`, `list`, or `load`.
     */
    observed_via: string;
    /**
     * The provider-reported title when available.
     */
    title?: string | null;
    [k: string]: unknown;
  }
  /**
   * Read-side transcript replay captured while loading a session.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "LoadedTranscriptSnapshot".
   */
  export interface LoadedTranscriptSnapshot {
    /**
     * The loaded session identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of official SDK notifications observed during load.
     */
    raw_update_count: number;
    /**
     * Replayed updates in provider emission order.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * Capabilities supported by the agent.
   *
   * Advertised during initialization to inform the client about
   * available features and content types.
   *
   * See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "AgentCapabilities".
   */
  export interface AgentCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/load`.
     */
    loadSession?: boolean;
    /**
     * MCP capabilities supported by the agent.
     */
    mcpCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`McpServer::Http`].
       */
      http?: boolean;
      /**
       * Agent supports [`McpServer::Sse`].
       */
      sse?: boolean;
      [k: string]: unknown;
    };
    /**
     * Prompt capabilities supported by the agent.
     */
    promptCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`ContentBlock::Audio`].
       */
      audio?: boolean;
      /**
       * Agent supports embedded context in `session/prompt` requests.
       *
       * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
       * in prompt requests for pieces of context that are referenced in the message.
       */
      embeddedContext?: boolean;
      /**
       * Agent supports [`ContentBlock::Image`].
       */
      image?: boolean;
      [k: string]: unknown;
    };
    /**
     * Session capabilities supported by the agent.
     *
     * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
     *
     * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
     *
     * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
     *
     * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
     */
    sessionCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/list`.
       */
      list?: SessionListCapabilities | null;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }
  /**
   * Agent handles authentication itself.
   *
   * This is the default authentication method type.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "AuthMethodAgent".
   */
  export interface AuthMethodAgent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  }
  /**
   * The initialize probe result returned by discovery.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "InitializeProbe".
   */
  export interface InitializeProbe {
    /**
     * The measured initialize response time in milliseconds.
     */
    elapsed_ms: number;
    /**
     * The typed initialize response payload.
     */
    payload: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Capabilities supported by the agent.
       */
      agentCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/load`.
         */
        loadSession?: boolean;
        /**
         * MCP capabilities supported by the agent.
         */
        mcpCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`McpServer::Http`].
           */
          http?: boolean;
          /**
           * Agent supports [`McpServer::Sse`].
           */
          sse?: boolean;
          [k: string]: unknown;
        };
        /**
         * Prompt capabilities supported by the agent.
         */
        promptCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`ContentBlock::Audio`].
           */
          audio?: boolean;
          /**
           * Agent supports embedded context in `session/prompt` requests.
           *
           * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
           * in prompt requests for pieces of context that are referenced in the message.
           */
          embeddedContext?: boolean;
          /**
           * Agent supports [`ContentBlock::Image`].
           */
          image?: boolean;
          [k: string]: unknown;
        };
        /**
         * Session capabilities supported by the agent.
         *
         * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
         *
         * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
         *
         * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
         *
         * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
         */
        sessionCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/list`.
           */
          list?: SessionListCapabilities | null;
          [k: string]: unknown;
        };
        [k: string]: unknown;
      };
      /**
       * Information about the Agent name and version sent to the Client.
       *
       * Note: in future versions of the protocol, this will be required.
       */
      agentInfo?: Implementation | null;
      /**
       * Authentication methods supported by the agent.
       */
      authMethods?: AuthMethod[];
      /**
       * The protocol version the client specified if supported by the agent,
       * or the latest protocol version supported by the agent.
       *
       * The client should disconnect, if it doesn't support this version.
       */
      protocolVersion: number;
      [k: string]: unknown;
    };
    /**
     * The raw initialize response envelope.
     */
    response: {
      [k: string]: unknown;
    };
    /**
     * The raw stderr lines observed during initialize.
     */
    stderr_lines: string[];
    /**
     * The raw stdout lines observed during initialize.
     */
    stdout_lines: string[];
    [k: string]: unknown;
  }
  /**
   * Response to the `initialize` method.
   *
   * Contains the negotiated protocol version and agent capabilities.
   *
   * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "InitializeResponse".
   */
  export interface InitializeResponse {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Capabilities supported by the agent.
     */
    agentCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/load`.
       */
      loadSession?: boolean;
      /**
       * MCP capabilities supported by the agent.
       */
      mcpCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`McpServer::Http`].
         */
        http?: boolean;
        /**
         * Agent supports [`McpServer::Sse`].
         */
        sse?: boolean;
        [k: string]: unknown;
      };
      /**
       * Prompt capabilities supported by the agent.
       */
      promptCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`ContentBlock::Audio`].
         */
        audio?: boolean;
        /**
         * Agent supports embedded context in `session/prompt` requests.
         *
         * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
         * in prompt requests for pieces of context that are referenced in the message.
         */
        embeddedContext?: boolean;
        /**
         * Agent supports [`ContentBlock::Image`].
         */
        image?: boolean;
        [k: string]: unknown;
      };
      /**
       * Session capabilities supported by the agent.
       *
       * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
       *
       * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
       *
       * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
       *
       * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
       */
      sessionCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/list`.
         */
        list?: SessionListCapabilities | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    /**
     * Information about the Agent name and version sent to the Client.
     *
     * Note: in future versions of the protocol, this will be required.
     */
    agentInfo?: Implementation | null;
    /**
     * Authentication methods supported by the agent.
     */
    authMethods?: AuthMethod[];
    /**
     * The protocol version the client specified if supported by the agent,
     * or the latest protocol version supported by the agent.
     *
     * The client should disconnect, if it doesn't support this version.
     */
    protocolVersion: number;
    [k: string]: unknown;
  }
  /**
   * The exact launcher command Conduit is allowed to run for a provider.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "LauncherCommand".
   */
  export interface LauncherCommand {
    /**
     * The actual argv that Conduit will pass after the executable.
     */
    args: string[];
    /**
     * The human-readable command string fixed by policy.
     */
    display: string;
    /**
     * The resolved executable path after discovery.
     */
    executable: string;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * MCP capabilities supported by the agent
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "McpCapabilities".
   */
  export interface McpCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`McpServer::Http`].
     */
    http?: boolean;
    /**
     * Agent supports [`McpServer::Sse`].
     */
    sse?: boolean;
    [k: string]: unknown;
  }
  /**
   * Prompt capabilities supported by the agent in `session/prompt` requests.
   *
   * Baseline agent functionality requires support for [`ContentBlock::Text`]
   * and [`ContentBlock::ResourceLink`] in prompt requests.
   *
   * Other variants must be explicitly opted in to.
   * Capabilities for different types of content in prompt requests.
   *
   * Indicates which content types beyond the baseline (text and resource links)
   * the agent can process.
   *
   * See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "PromptCapabilities".
   */
  export interface PromptCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`ContentBlock::Audio`].
     */
    audio?: boolean;
    /**
     * Agent supports embedded context in `session/prompt` requests.
     *
     * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
     * in prompt requests for pieces of context that are referenced in the message.
     */
    embeddedContext?: boolean;
    /**
     * Agent supports [`ContentBlock::Image`].
     */
    image?: boolean;
    [k: string]: unknown;
  }
  /**
   * The discovery output for a provider.
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "ProviderDiscovery".
   */
  export interface ProviderDiscovery {
    /**
     * Human-readable auth hints surfaced by the adapter.
     */
    auth_hints: string[];
    /**
     * The raw initialize result when probing succeeded.
     */
    initialize_probe: {
      /**
       * The measured initialize response time in milliseconds.
       */
      elapsed_ms: number;
      /**
       * The typed initialize response payload.
       */
      payload: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Capabilities supported by the agent.
         */
        agentCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/load`.
           */
          loadSession?: boolean;
          /**
           * MCP capabilities supported by the agent.
           */
          mcpCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`McpServer::Http`].
             */
            http?: boolean;
            /**
             * Agent supports [`McpServer::Sse`].
             */
            sse?: boolean;
            [k: string]: unknown;
          };
          /**
           * Prompt capabilities supported by the agent.
           */
          promptCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`ContentBlock::Audio`].
             */
            audio?: boolean;
            /**
             * Agent supports embedded context in `session/prompt` requests.
             *
             * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
             * in prompt requests for pieces of context that are referenced in the message.
             */
            embeddedContext?: boolean;
            /**
             * Agent supports [`ContentBlock::Image`].
             */
            image?: boolean;
            [k: string]: unknown;
          };
          /**
           * Session capabilities supported by the agent.
           *
           * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
           *
           * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
           *
           * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
           *
           * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
           */
          sessionCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/list`.
             */
            list?: SessionListCapabilities | null;
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        /**
         * Information about the Agent name and version sent to the Client.
         *
         * Note: in future versions of the protocol, this will be required.
         */
        agentInfo?: Implementation | null;
        /**
         * Authentication methods supported by the agent.
         */
        authMethods?: AuthMethod[];
        /**
         * The protocol version the client specified if supported by the agent,
         * or the latest protocol version supported by the agent.
         *
         * The client should disconnect, if it doesn't support this version.
         */
        protocolVersion: number;
        [k: string]: unknown;
      };
      /**
       * The raw initialize response envelope.
       */
      response: {
        [k: string]: unknown;
      };
      /**
       * The raw stderr lines observed during initialize.
       */
      stderr_lines: string[];
      /**
       * The raw stdout lines observed during initialize.
       */
      stdout_lines: string[];
      [k: string]: unknown;
    };
    /**
     * Whether `initialize` completed successfully.
     */
    initialize_viable: boolean;
    /**
     * The launcher command locked by policy.
     */
    launcher: {
      /**
       * The actual argv that Conduit will pass after the executable.
       */
      args: string[];
      /**
       * The human-readable command string fixed by policy.
       */
      display: string;
      /**
       * The resolved executable path after discovery.
       */
      executable: string;
      [k: string]: unknown;
    };
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * The resolved binary path.
     */
    resolved_path: string;
    /**
     * Diagnostics gathered during probing.
     */
    transport_diagnostics: string[];
    /**
     * The version reported by the adapter.
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * Session capabilities supported by the agent.
   *
   * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
   *
   * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
   *
   * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
   *
   * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
   *
   * This interface was referenced by `ConsumerResponse`'s JSON-Schema
   * via the `definition` "SessionCapabilities".
   */
  export interface SessionCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/list`.
     */
    list?: SessionListCapabilities | null;
    [k: string]: unknown;
  }
}

export type ConsumerResponse = ConsumerResponseTypes.ConsumerResponse;

export namespace ContentBlockTypes {
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;

  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
}

export type ContentBlock = ContentBlockTypes.ContentBlock;

export namespace EmptyParamsTypes {
  /**
   * Empty object params for commands without a request payload.
   */
  export interface EmptyParams {}
}

export type EmptyParams = EmptyParamsTypes.EmptyParams;

export namespace GlobalProviderTargetTypes {
  /**
   * Global provider target for commands that must fan out through Conduit.
   */
  export type GlobalProviderTarget = "all";
}

export type GlobalProviderTarget =
  GlobalProviderTargetTypes.GlobalProviderTarget;

export namespace GlobalSettingsUpdateRequestTypes {
  /**
   * Request payload for `settings/update`.
   */
  export interface GlobalSettingsUpdateRequest {
    /**
     * Default lookback window for `sessions/grouped`.
     */
    sessionGroupsUpdatedWithinDays?: number | null;
  }
}

export type GlobalSettingsUpdateRequest =
  GlobalSettingsUpdateRequestTypes.GlobalSettingsUpdateRequest;

export namespace GlobalSettingsViewTypes {
  /**
   * Persisted global settings for Conduit's session browser.
   */
  export interface GlobalSettings {
    /**
     * Default session lookback window in days for `sessions/grouped`.
     */
    sessionGroupsUpdatedWithinDays?: number | null;
    [k: string]: unknown;
  }
}

export type GlobalSettingsView = GlobalSettingsViewTypes.GlobalSettings;

export namespace LauncherCommandTypes {
  /**
   * The exact launcher command Conduit is allowed to run for a provider.
   */
  export interface LauncherCommand {
    /**
     * The actual argv that Conduit will pass after the executable.
     */
    args: string[];
    /**
     * The human-readable command string fixed by policy.
     */
    display: string;
    /**
     * The resolved executable path after discovery.
     */
    executable: string;
    [k: string]: unknown;
  }
}

export type LauncherCommand = LauncherCommandTypes.LauncherCommand;

export namespace LiveSessionIdentityTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `LiveSessionIdentity`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * The exact live session identity rule for Conduit.
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
}

export type LiveSessionIdentity = LiveSessionIdentityTypes.LiveSessionIdentity;

export namespace LiveSessionSnapshotTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `LiveSessionSnapshot`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * A normalized live session snapshot anchored to ACP truth.
   */
  export interface LiveSessionSnapshot {
    /**
     * The provider-reported or Conduit-observed working directory.
     */
    cwd: string;
    /**
     * The exact live identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * Whether the session was observed via `new`, `list`, or `load`.
     */
    observed_via: string;
    /**
     * The provider-reported title when available.
     */
    title?: string | null;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `LiveSessionSnapshot`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
}

export type LiveSessionSnapshot = LiveSessionSnapshotTypes.LiveSessionSnapshot;

export namespace LoadedTranscriptSnapshotTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `LoadedTranscriptSnapshot`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * Read-side transcript replay captured while loading a session.
   */
  export interface LoadedTranscriptSnapshot {
    /**
     * The loaded session identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of official SDK notifications observed during load.
     */
    raw_update_count: number;
    /**
     * Replayed updates in provider emission order.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   *
   * This interface was referenced by `LoadedTranscriptSnapshot`'s JSON-Schema
   * via the `definition` "TranscriptUpdateSnapshot".
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `LoadedTranscriptSnapshot`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
}

export type LoadedTranscriptSnapshot =
  LoadedTranscriptSnapshotTypes.LoadedTranscriptSnapshot;

export namespace ProjectAddRequestTypes {
  /**
   * Request payload for `projects/add`.
   */
  export interface ProjectAddRequest {
    /**
     * Absolute normalized cwd to add as a project.
     */
    cwd: string;
  }
}

export type ProjectAddRequest = ProjectAddRequestTypes.ProjectAddRequest;

export namespace ProjectListViewTypes {
  /**
   * Project list read model.
   */
  export interface ProjectListView {
    /**
     * Persisted projects in display order.
     */
    projects: ProjectRow[];
  }
  /**
   * One persisted cwd selected for Conduit's session browser.
   *
   * This interface was referenced by `ProjectListView`'s JSON-Schema
   * via the `definition` "ProjectRow".
   */
  export interface ProjectRow {
    /**
     * Absolute normalized cwd represented by this project.
     */
    cwd: string;
    /**
     * User-facing project label.
     */
    displayName: string;
    /**
     * Stable render and mutation identity for the project.
     */
    projectId: string;
    [k: string]: unknown;
  }
}

export type ProjectListView = ProjectListViewTypes.ProjectListView;

export namespace ProjectRemoveRequestTypes {
  /**
   * Request payload for `projects/remove`.
   */
  export interface ProjectRemoveRequest {
    /**
     * Stable project identity to remove.
     */
    projectId: string;
  }
}

export type ProjectRemoveRequest =
  ProjectRemoveRequestTypes.ProjectRemoveRequest;

export namespace ProjectRowTypes {
  /**
   * One persisted cwd selected for Conduit's session browser.
   */
  export interface ProjectRow {
    /**
     * Absolute normalized cwd represented by this project.
     */
    cwd: string;
    /**
     * User-facing project label.
     */
    displayName: string;
    /**
     * Stable render and mutation identity for the project.
     */
    projectId: string;
    [k: string]: unknown;
  }
}

export type ProjectRow = ProjectRowTypes.ProjectRow;

export namespace ProjectSuggestionTypes {
  /**
   * One addable cwd suggestion for the session browser.
   */
  export interface ProjectSuggestion {
    /**
     * Absolute normalized cwd represented by this suggestion.
     */
    cwd: string;
    /**
     * Stable render identity for the suggestion.
     */
    suggestionId: string;
    [k: string]: unknown;
  }
}

export type ProjectSuggestion = ProjectSuggestionTypes.ProjectSuggestion;

export namespace ProjectSuggestionsQueryTypes {
  /**
   * Query payload for `projects/suggestions`.
   */
  export interface ProjectSuggestionsQuery {
    /**
     * Optional result limit.
     */
    limit?: number | null;
    /**
     * Optional substring filter.
     */
    query?: string | null;
  }
}

export type ProjectSuggestionsQuery =
  ProjectSuggestionsQueryTypes.ProjectSuggestionsQuery;

export namespace ProjectSuggestionsViewTypes {
  /**
   * Project suggestions read model.
   */
  export interface ProjectSuggestionsView {
    /**
     * Addable project suggestions.
     */
    suggestions: ProjectSuggestion[];
  }
  /**
   * One addable cwd suggestion for the session browser.
   *
   * This interface was referenced by `ProjectSuggestionsView`'s JSON-Schema
   * via the `definition` "ProjectSuggestion".
   */
  export interface ProjectSuggestion {
    /**
     * Absolute normalized cwd represented by this suggestion.
     */
    cwd: string;
    /**
     * Stable render identity for the suggestion.
     */
    suggestionId: string;
    [k: string]: unknown;
  }
}

export type ProjectSuggestionsView =
  ProjectSuggestionsViewTypes.ProjectSuggestionsView;

export namespace ProjectUpdateRequestTypes {
  /**
   * Request payload for `projects/update`.
   */
  export interface ProjectUpdateRequest {
    /**
     * New display label for the project.
     */
    displayName: string;
    /**
     * Stable project identity to update.
     */
    projectId: string;
  }
}

export type ProjectUpdateRequest =
  ProjectUpdateRequestTypes.ProjectUpdateRequest;

export namespace PromptLifecycleSnapshotTypes {
  /**
   * The normalized prompt lifecycle state for a single session turn.
   *
   * This interface was referenced by `PromptLifecycleSnapshot`'s JSON-Schema
   * via the `definition` "PromptLifecycleState".
   */
  export type PromptLifecycleState =
    | "idle"
    | "running"
    | "completed"
    | "cancelled";
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `PromptLifecycleSnapshot`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * A normalized prompt lifecycle snapshot backed by raw ACP updates.
   */
  export interface PromptLifecycleSnapshot {
    /**
     * Agent-authored text chunks observed through official SDK notifications.
     */
    agent_text_chunks?: string[];
    /**
     * The session the prompt belongs to.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of raw session/update notifications observed during the turn.
     */
    raw_update_count: number;
    /**
     * The current lifecycle state.
     */
    state: "idle" | "running" | "completed" | "cancelled";
    /**
     * The ACP stop reason when available.
     */
    stop_reason?: string | null;
    /**
     * Ordered raw ACP `session/update` notifications observed during the turn.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   *
   * This interface was referenced by `PromptLifecycleSnapshot`'s JSON-Schema
   * via the `definition` "TranscriptUpdateSnapshot".
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `PromptLifecycleSnapshot`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
}

export type PromptLifecycleSnapshot =
  PromptLifecycleSnapshotTypes.PromptLifecycleSnapshot;

export namespace PromptLifecycleStateTypes {
  /**
   * The normalized prompt lifecycle state for a single session turn.
   */
  export type PromptLifecycleState =
    | "idle"
    | "running"
    | "completed"
    | "cancelled";
}

export type PromptLifecycleState =
  PromptLifecycleStateTypes.PromptLifecycleState;

export namespace ProviderConfigSnapshotEntryTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;
  /**
   * Snapshot worker status for provider config data.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "ProviderConfigSnapshotStatus".
   */
  export type ProviderConfigSnapshotStatus =
    | "loading"
    | "ready"
    | "error"
    | "unavailable";
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * One provider config snapshot entry.
   */
  export interface ProviderConfigSnapshotEntry {
    /**
     * Provider config options when available.
     */
    configOptions?: SessionConfigOption[] | null;
    /**
     * Probe error message when available.
     */
    error?: string | null;
    /**
     * Probe completion timestamp when available.
     */
    fetchedAt?: string | null;
    /**
     * Provider model state when available.
     */
    models?: {
      [k: string]: unknown;
    };
    /**
     * Official ACP mode state when available.
     */
    modes?: SessionModeState | null;
    /**
     * Provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * Snapshot status.
     */
    status: "loading" | "ready" | "error" | "unavailable";
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * The set of modes and the one currently active.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionModeState".
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `ProviderConfigSnapshotEntry`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
}

export type ProviderConfigSnapshotEntry =
  ProviderConfigSnapshotEntryTypes.ProviderConfigSnapshotEntry;

export namespace ProviderConfigSnapshotStatusTypes {
  /**
   * Snapshot worker status for provider config data.
   */
  export type ProviderConfigSnapshotStatus =
    | "loading"
    | "ready"
    | "error"
    | "unavailable";
}

export type ProviderConfigSnapshotStatus =
  ProviderConfigSnapshotStatusTypes.ProviderConfigSnapshotStatus;

export namespace ProviderDiscoveryTypes {
  /**
   * Describes an available authentication method.
   *
   * The `type` field acts as the discriminator in the serialized JSON form.
   * When no `type` is present, the method is treated as `agent`.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "AuthMethod".
   */
  export type AuthMethod = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  };
  /**
   * Protocol version identifier.
   *
   * This version is only bumped for breaking changes.
   * Non-breaking changes should be introduced via capabilities.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "ProtocolVersion".
   */
  export type ProtocolVersion = number;
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * The discovery output for a provider.
   */
  export interface ProviderDiscovery {
    /**
     * Human-readable auth hints surfaced by the adapter.
     */
    auth_hints: string[];
    /**
     * The raw initialize result when probing succeeded.
     */
    initialize_probe: {
      /**
       * The measured initialize response time in milliseconds.
       */
      elapsed_ms: number;
      /**
       * The typed initialize response payload.
       */
      payload: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Capabilities supported by the agent.
         */
        agentCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/load`.
           */
          loadSession?: boolean;
          /**
           * MCP capabilities supported by the agent.
           */
          mcpCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`McpServer::Http`].
             */
            http?: boolean;
            /**
             * Agent supports [`McpServer::Sse`].
             */
            sse?: boolean;
            [k: string]: unknown;
          };
          /**
           * Prompt capabilities supported by the agent.
           */
          promptCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`ContentBlock::Audio`].
             */
            audio?: boolean;
            /**
             * Agent supports embedded context in `session/prompt` requests.
             *
             * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
             * in prompt requests for pieces of context that are referenced in the message.
             */
            embeddedContext?: boolean;
            /**
             * Agent supports [`ContentBlock::Image`].
             */
            image?: boolean;
            [k: string]: unknown;
          };
          /**
           * Session capabilities supported by the agent.
           *
           * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
           *
           * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
           *
           * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
           *
           * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
           */
          sessionCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/list`.
             */
            list?: SessionListCapabilities | null;
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        /**
         * Information about the Agent name and version sent to the Client.
         *
         * Note: in future versions of the protocol, this will be required.
         */
        agentInfo?: Implementation | null;
        /**
         * Authentication methods supported by the agent.
         */
        authMethods?: AuthMethod[];
        /**
         * The protocol version the client specified if supported by the agent,
         * or the latest protocol version supported by the agent.
         *
         * The client should disconnect, if it doesn't support this version.
         */
        protocolVersion: number;
        [k: string]: unknown;
      };
      /**
       * The raw initialize response envelope.
       */
      response: {
        [k: string]: unknown;
      };
      /**
       * The raw stderr lines observed during initialize.
       */
      stderr_lines: string[];
      /**
       * The raw stdout lines observed during initialize.
       */
      stdout_lines: string[];
      [k: string]: unknown;
    };
    /**
     * Whether `initialize` completed successfully.
     */
    initialize_viable: boolean;
    /**
     * The launcher command locked by policy.
     */
    launcher: {
      /**
       * The actual argv that Conduit will pass after the executable.
       */
      args: string[];
      /**
       * The human-readable command string fixed by policy.
       */
      display: string;
      /**
       * The resolved executable path after discovery.
       */
      executable: string;
      [k: string]: unknown;
    };
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * The resolved binary path.
     */
    resolved_path: string;
    /**
     * Diagnostics gathered during probing.
     */
    transport_diagnostics: string[];
    /**
     * The version reported by the adapter.
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * Capabilities for the `session/list` method.
   *
   * By supplying `{}` it means that the agent supports listing of sessions.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "SessionListCapabilities".
   */
  export interface SessionListCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  }
  /**
   * Metadata about the implementation of the client or agent.
   * Describes the name and version of an MCP implementation, with an optional
   * title for UI representation.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "Implementation".
   */
  export interface Implementation {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Intended for programmatic or logical use, but can be used as a display
     * name fallback if title isn’t present.
     */
    name: string;
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood.
     *
     * If not provided, the name should be used for display.
     */
    title?: string | null;
    /**
     * Version of the implementation. Can be displayed to the user or used
     * for debugging or metrics purposes. (e.g. "1.0.0").
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * Capabilities supported by the agent.
   *
   * Advertised during initialization to inform the client about
   * available features and content types.
   *
   * See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "AgentCapabilities".
   */
  export interface AgentCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/load`.
     */
    loadSession?: boolean;
    /**
     * MCP capabilities supported by the agent.
     */
    mcpCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`McpServer::Http`].
       */
      http?: boolean;
      /**
       * Agent supports [`McpServer::Sse`].
       */
      sse?: boolean;
      [k: string]: unknown;
    };
    /**
     * Prompt capabilities supported by the agent.
     */
    promptCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`ContentBlock::Audio`].
       */
      audio?: boolean;
      /**
       * Agent supports embedded context in `session/prompt` requests.
       *
       * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
       * in prompt requests for pieces of context that are referenced in the message.
       */
      embeddedContext?: boolean;
      /**
       * Agent supports [`ContentBlock::Image`].
       */
      image?: boolean;
      [k: string]: unknown;
    };
    /**
     * Session capabilities supported by the agent.
     *
     * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
     *
     * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
     *
     * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
     *
     * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
     */
    sessionCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/list`.
       */
      list?: SessionListCapabilities | null;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }
  /**
   * Agent handles authentication itself.
   *
   * This is the default authentication method type.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "AuthMethodAgent".
   */
  export interface AuthMethodAgent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  }
  /**
   * The initialize probe result returned by discovery.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "InitializeProbe".
   */
  export interface InitializeProbe {
    /**
     * The measured initialize response time in milliseconds.
     */
    elapsed_ms: number;
    /**
     * The typed initialize response payload.
     */
    payload: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Capabilities supported by the agent.
       */
      agentCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/load`.
         */
        loadSession?: boolean;
        /**
         * MCP capabilities supported by the agent.
         */
        mcpCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`McpServer::Http`].
           */
          http?: boolean;
          /**
           * Agent supports [`McpServer::Sse`].
           */
          sse?: boolean;
          [k: string]: unknown;
        };
        /**
         * Prompt capabilities supported by the agent.
         */
        promptCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`ContentBlock::Audio`].
           */
          audio?: boolean;
          /**
           * Agent supports embedded context in `session/prompt` requests.
           *
           * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
           * in prompt requests for pieces of context that are referenced in the message.
           */
          embeddedContext?: boolean;
          /**
           * Agent supports [`ContentBlock::Image`].
           */
          image?: boolean;
          [k: string]: unknown;
        };
        /**
         * Session capabilities supported by the agent.
         *
         * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
         *
         * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
         *
         * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
         *
         * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
         */
        sessionCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/list`.
           */
          list?: SessionListCapabilities | null;
          [k: string]: unknown;
        };
        [k: string]: unknown;
      };
      /**
       * Information about the Agent name and version sent to the Client.
       *
       * Note: in future versions of the protocol, this will be required.
       */
      agentInfo?: Implementation | null;
      /**
       * Authentication methods supported by the agent.
       */
      authMethods?: AuthMethod[];
      /**
       * The protocol version the client specified if supported by the agent,
       * or the latest protocol version supported by the agent.
       *
       * The client should disconnect, if it doesn't support this version.
       */
      protocolVersion: number;
      [k: string]: unknown;
    };
    /**
     * The raw initialize response envelope.
     */
    response: {
      [k: string]: unknown;
    };
    /**
     * The raw stderr lines observed during initialize.
     */
    stderr_lines: string[];
    /**
     * The raw stdout lines observed during initialize.
     */
    stdout_lines: string[];
    [k: string]: unknown;
  }
  /**
   * Response to the `initialize` method.
   *
   * Contains the negotiated protocol version and agent capabilities.
   *
   * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "InitializeResponse".
   */
  export interface InitializeResponse {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Capabilities supported by the agent.
     */
    agentCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/load`.
       */
      loadSession?: boolean;
      /**
       * MCP capabilities supported by the agent.
       */
      mcpCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`McpServer::Http`].
         */
        http?: boolean;
        /**
         * Agent supports [`McpServer::Sse`].
         */
        sse?: boolean;
        [k: string]: unknown;
      };
      /**
       * Prompt capabilities supported by the agent.
       */
      promptCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`ContentBlock::Audio`].
         */
        audio?: boolean;
        /**
         * Agent supports embedded context in `session/prompt` requests.
         *
         * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
         * in prompt requests for pieces of context that are referenced in the message.
         */
        embeddedContext?: boolean;
        /**
         * Agent supports [`ContentBlock::Image`].
         */
        image?: boolean;
        [k: string]: unknown;
      };
      /**
       * Session capabilities supported by the agent.
       *
       * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
       *
       * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
       *
       * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
       *
       * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
       */
      sessionCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/list`.
         */
        list?: SessionListCapabilities | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    /**
     * Information about the Agent name and version sent to the Client.
     *
     * Note: in future versions of the protocol, this will be required.
     */
    agentInfo?: Implementation | null;
    /**
     * Authentication methods supported by the agent.
     */
    authMethods?: AuthMethod[];
    /**
     * The protocol version the client specified if supported by the agent,
     * or the latest protocol version supported by the agent.
     *
     * The client should disconnect, if it doesn't support this version.
     */
    protocolVersion: number;
    [k: string]: unknown;
  }
  /**
   * The exact launcher command Conduit is allowed to run for a provider.
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "LauncherCommand".
   */
  export interface LauncherCommand {
    /**
     * The actual argv that Conduit will pass after the executable.
     */
    args: string[];
    /**
     * The human-readable command string fixed by policy.
     */
    display: string;
    /**
     * The resolved executable path after discovery.
     */
    executable: string;
    [k: string]: unknown;
  }
  /**
   * MCP capabilities supported by the agent
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "McpCapabilities".
   */
  export interface McpCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`McpServer::Http`].
     */
    http?: boolean;
    /**
     * Agent supports [`McpServer::Sse`].
     */
    sse?: boolean;
    [k: string]: unknown;
  }
  /**
   * Prompt capabilities supported by the agent in `session/prompt` requests.
   *
   * Baseline agent functionality requires support for [`ContentBlock::Text`]
   * and [`ContentBlock::ResourceLink`] in prompt requests.
   *
   * Other variants must be explicitly opted in to.
   * Capabilities for different types of content in prompt requests.
   *
   * Indicates which content types beyond the baseline (text and resource links)
   * the agent can process.
   *
   * See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "PromptCapabilities".
   */
  export interface PromptCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`ContentBlock::Audio`].
     */
    audio?: boolean;
    /**
     * Agent supports embedded context in `session/prompt` requests.
     *
     * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
     * in prompt requests for pieces of context that are referenced in the message.
     */
    embeddedContext?: boolean;
    /**
     * Agent supports [`ContentBlock::Image`].
     */
    image?: boolean;
    [k: string]: unknown;
  }
  /**
   * Session capabilities supported by the agent.
   *
   * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
   *
   * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
   *
   * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
   *
   * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
   *
   * This interface was referenced by `ProviderDiscovery`'s JSON-Schema
   * via the `definition` "SessionCapabilities".
   */
  export interface SessionCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/list`.
     */
    list?: SessionListCapabilities | null;
    [k: string]: unknown;
  }
}

export type ProviderDiscovery = ProviderDiscoveryTypes.ProviderDiscovery;

export namespace ProviderIdTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   */
  export type ProviderId = "claude" | "copilot" | "codex";
}

export type ProviderId = ProviderIdTypes.ProviderId;

export namespace ProviderSnapshotTypes {
  /**
   * Describes an available authentication method.
   *
   * The `type` field acts as the discriminator in the serialized JSON form.
   * When no `type` is present, the method is treated as `agent`.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "AuthMethod".
   */
  export type AuthMethod = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  };
  /**
   * The current host connection state.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "ConnectionState".
   */
  export type ConnectionState = "disconnected" | "ready";
  /**
   * The normalized prompt lifecycle state for a single session turn.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "PromptLifecycleState".
   */
  export type PromptLifecycleState =
    | "idle"
    | "running"
    | "completed"
    | "cancelled";
  /**
   * Protocol version identifier.
   *
   * This version is only bumped for breaking changes.
   * Non-breaking changes should be introduced via capabilities.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "ProtocolVersion".
   */
  export type ProtocolVersion = number;
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * The current provider snapshot exposed to apps and proof tooling.
   */
  export interface ProviderSnapshot {
    /**
     * The provider-reported auth methods from the live initialize result.
     */
    auth_methods: unknown[];
    /**
     * The provider-reported capabilities from the live initialize result.
     */
    capabilities: {
      [k: string]: unknown;
    };
    /**
     * The current connection state.
     */
    connection_state: "disconnected" | "ready";
    /**
     * The locked launcher truth and initialize probe provenance.
     */
    discovery: {
      /**
       * Human-readable auth hints surfaced by the adapter.
       */
      auth_hints: string[];
      /**
       * The raw initialize result when probing succeeded.
       */
      initialize_probe: {
        /**
         * The measured initialize response time in milliseconds.
         */
        elapsed_ms: number;
        /**
         * The typed initialize response payload.
         */
        payload: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Capabilities supported by the agent.
           */
          agentCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/load`.
             */
            loadSession?: boolean;
            /**
             * MCP capabilities supported by the agent.
             */
            mcpCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`McpServer::Http`].
               */
              http?: boolean;
              /**
               * Agent supports [`McpServer::Sse`].
               */
              sse?: boolean;
              [k: string]: unknown;
            };
            /**
             * Prompt capabilities supported by the agent.
             */
            promptCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`ContentBlock::Audio`].
               */
              audio?: boolean;
              /**
               * Agent supports embedded context in `session/prompt` requests.
               *
               * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
               * in prompt requests for pieces of context that are referenced in the message.
               */
              embeddedContext?: boolean;
              /**
               * Agent supports [`ContentBlock::Image`].
               */
              image?: boolean;
              [k: string]: unknown;
            };
            /**
             * Session capabilities supported by the agent.
             *
             * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
             *
             * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
             *
             * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
             *
             * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
             */
            sessionCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Whether the agent supports `session/list`.
               */
              list?: SessionListCapabilities | null;
              [k: string]: unknown;
            };
            [k: string]: unknown;
          };
          /**
           * Information about the Agent name and version sent to the Client.
           *
           * Note: in future versions of the protocol, this will be required.
           */
          agentInfo?: Implementation | null;
          /**
           * Authentication methods supported by the agent.
           */
          authMethods?: AuthMethod[];
          /**
           * The protocol version the client specified if supported by the agent,
           * or the latest protocol version supported by the agent.
           *
           * The client should disconnect, if it doesn't support this version.
           */
          protocolVersion: number;
          [k: string]: unknown;
        };
        /**
         * The raw initialize response envelope.
         */
        response: {
          [k: string]: unknown;
        };
        /**
         * The raw stderr lines observed during initialize.
         */
        stderr_lines: string[];
        /**
         * The raw stdout lines observed during initialize.
         */
        stdout_lines: string[];
        [k: string]: unknown;
      };
      /**
       * Whether `initialize` completed successfully.
       */
      initialize_viable: boolean;
      /**
       * The launcher command locked by policy.
       */
      launcher: {
        /**
         * The actual argv that Conduit will pass after the executable.
         */
        args: string[];
        /**
         * The human-readable command string fixed by policy.
         */
        display: string;
        /**
         * The resolved executable path after discovery.
         */
        executable: string;
        [k: string]: unknown;
      };
      /**
       * The provider identifier.
       */
      provider: "claude" | "copilot" | "codex";
      /**
       * The resolved binary path.
       */
      resolved_path: string;
      /**
       * Diagnostics gathered during probing.
       */
      transport_diagnostics: string[];
      /**
       * The version reported by the adapter.
       */
      version: string;
      [k: string]: unknown;
    };
    /**
     * The last observed prompt lifecycle, if any.
     */
    last_prompt?: PromptLifecycleSnapshot | null;
    /**
     * The live sessions currently tracked in memory.
     */
    live_sessions: LiveSessionSnapshot[];
    /**
     * Transcript replays captured during `session/load`.
     */
    loaded_transcripts?: LoadedTranscriptSnapshot[];
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * Capabilities for the `session/list` method.
   *
   * By supplying `{}` it means that the agent supports listing of sessions.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "SessionListCapabilities".
   */
  export interface SessionListCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  }
  /**
   * Metadata about the implementation of the client or agent.
   * Describes the name and version of an MCP implementation, with an optional
   * title for UI representation.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "Implementation".
   */
  export interface Implementation {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Intended for programmatic or logical use, but can be used as a display
     * name fallback if title isn’t present.
     */
    name: string;
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood.
     *
     * If not provided, the name should be used for display.
     */
    title?: string | null;
    /**
     * Version of the implementation. Can be displayed to the user or used
     * for debugging or metrics purposes. (e.g. "1.0.0").
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * A normalized prompt lifecycle snapshot backed by raw ACP updates.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "PromptLifecycleSnapshot".
   */
  export interface PromptLifecycleSnapshot {
    /**
     * Agent-authored text chunks observed through official SDK notifications.
     */
    agent_text_chunks?: string[];
    /**
     * The session the prompt belongs to.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of raw session/update notifications observed during the turn.
     */
    raw_update_count: number;
    /**
     * The current lifecycle state.
     */
    state: "idle" | "running" | "completed" | "cancelled";
    /**
     * The ACP stop reason when available.
     */
    stop_reason?: string | null;
    /**
     * Ordered raw ACP `session/update` notifications observed during the turn.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "TranscriptUpdateSnapshot".
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * A normalized live session snapshot anchored to ACP truth.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "LiveSessionSnapshot".
   */
  export interface LiveSessionSnapshot {
    /**
     * The provider-reported or Conduit-observed working directory.
     */
    cwd: string;
    /**
     * The exact live identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * Whether the session was observed via `new`, `list`, or `load`.
     */
    observed_via: string;
    /**
     * The provider-reported title when available.
     */
    title?: string | null;
    [k: string]: unknown;
  }
  /**
   * Read-side transcript replay captured while loading a session.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "LoadedTranscriptSnapshot".
   */
  export interface LoadedTranscriptSnapshot {
    /**
     * The loaded session identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of official SDK notifications observed during load.
     */
    raw_update_count: number;
    /**
     * Replayed updates in provider emission order.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * Capabilities supported by the agent.
   *
   * Advertised during initialization to inform the client about
   * available features and content types.
   *
   * See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "AgentCapabilities".
   */
  export interface AgentCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/load`.
     */
    loadSession?: boolean;
    /**
     * MCP capabilities supported by the agent.
     */
    mcpCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`McpServer::Http`].
       */
      http?: boolean;
      /**
       * Agent supports [`McpServer::Sse`].
       */
      sse?: boolean;
      [k: string]: unknown;
    };
    /**
     * Prompt capabilities supported by the agent.
     */
    promptCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`ContentBlock::Audio`].
       */
      audio?: boolean;
      /**
       * Agent supports embedded context in `session/prompt` requests.
       *
       * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
       * in prompt requests for pieces of context that are referenced in the message.
       */
      embeddedContext?: boolean;
      /**
       * Agent supports [`ContentBlock::Image`].
       */
      image?: boolean;
      [k: string]: unknown;
    };
    /**
     * Session capabilities supported by the agent.
     *
     * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
     *
     * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
     *
     * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
     *
     * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
     */
    sessionCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/list`.
       */
      list?: SessionListCapabilities | null;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }
  /**
   * Agent handles authentication itself.
   *
   * This is the default authentication method type.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "AuthMethodAgent".
   */
  export interface AuthMethodAgent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  }
  /**
   * The initialize probe result returned by discovery.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "InitializeProbe".
   */
  export interface InitializeProbe {
    /**
     * The measured initialize response time in milliseconds.
     */
    elapsed_ms: number;
    /**
     * The typed initialize response payload.
     */
    payload: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Capabilities supported by the agent.
       */
      agentCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/load`.
         */
        loadSession?: boolean;
        /**
         * MCP capabilities supported by the agent.
         */
        mcpCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`McpServer::Http`].
           */
          http?: boolean;
          /**
           * Agent supports [`McpServer::Sse`].
           */
          sse?: boolean;
          [k: string]: unknown;
        };
        /**
         * Prompt capabilities supported by the agent.
         */
        promptCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`ContentBlock::Audio`].
           */
          audio?: boolean;
          /**
           * Agent supports embedded context in `session/prompt` requests.
           *
           * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
           * in prompt requests for pieces of context that are referenced in the message.
           */
          embeddedContext?: boolean;
          /**
           * Agent supports [`ContentBlock::Image`].
           */
          image?: boolean;
          [k: string]: unknown;
        };
        /**
         * Session capabilities supported by the agent.
         *
         * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
         *
         * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
         *
         * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
         *
         * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
         */
        sessionCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/list`.
           */
          list?: SessionListCapabilities | null;
          [k: string]: unknown;
        };
        [k: string]: unknown;
      };
      /**
       * Information about the Agent name and version sent to the Client.
       *
       * Note: in future versions of the protocol, this will be required.
       */
      agentInfo?: Implementation | null;
      /**
       * Authentication methods supported by the agent.
       */
      authMethods?: AuthMethod[];
      /**
       * The protocol version the client specified if supported by the agent,
       * or the latest protocol version supported by the agent.
       *
       * The client should disconnect, if it doesn't support this version.
       */
      protocolVersion: number;
      [k: string]: unknown;
    };
    /**
     * The raw initialize response envelope.
     */
    response: {
      [k: string]: unknown;
    };
    /**
     * The raw stderr lines observed during initialize.
     */
    stderr_lines: string[];
    /**
     * The raw stdout lines observed during initialize.
     */
    stdout_lines: string[];
    [k: string]: unknown;
  }
  /**
   * Response to the `initialize` method.
   *
   * Contains the negotiated protocol version and agent capabilities.
   *
   * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "InitializeResponse".
   */
  export interface InitializeResponse {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Capabilities supported by the agent.
     */
    agentCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/load`.
       */
      loadSession?: boolean;
      /**
       * MCP capabilities supported by the agent.
       */
      mcpCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`McpServer::Http`].
         */
        http?: boolean;
        /**
         * Agent supports [`McpServer::Sse`].
         */
        sse?: boolean;
        [k: string]: unknown;
      };
      /**
       * Prompt capabilities supported by the agent.
       */
      promptCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`ContentBlock::Audio`].
         */
        audio?: boolean;
        /**
         * Agent supports embedded context in `session/prompt` requests.
         *
         * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
         * in prompt requests for pieces of context that are referenced in the message.
         */
        embeddedContext?: boolean;
        /**
         * Agent supports [`ContentBlock::Image`].
         */
        image?: boolean;
        [k: string]: unknown;
      };
      /**
       * Session capabilities supported by the agent.
       *
       * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
       *
       * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
       *
       * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
       *
       * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
       */
      sessionCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/list`.
         */
        list?: SessionListCapabilities | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    /**
     * Information about the Agent name and version sent to the Client.
     *
     * Note: in future versions of the protocol, this will be required.
     */
    agentInfo?: Implementation | null;
    /**
     * Authentication methods supported by the agent.
     */
    authMethods?: AuthMethod[];
    /**
     * The protocol version the client specified if supported by the agent,
     * or the latest protocol version supported by the agent.
     *
     * The client should disconnect, if it doesn't support this version.
     */
    protocolVersion: number;
    [k: string]: unknown;
  }
  /**
   * The exact launcher command Conduit is allowed to run for a provider.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "LauncherCommand".
   */
  export interface LauncherCommand {
    /**
     * The actual argv that Conduit will pass after the executable.
     */
    args: string[];
    /**
     * The human-readable command string fixed by policy.
     */
    display: string;
    /**
     * The resolved executable path after discovery.
     */
    executable: string;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * MCP capabilities supported by the agent
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "McpCapabilities".
   */
  export interface McpCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`McpServer::Http`].
     */
    http?: boolean;
    /**
     * Agent supports [`McpServer::Sse`].
     */
    sse?: boolean;
    [k: string]: unknown;
  }
  /**
   * Prompt capabilities supported by the agent in `session/prompt` requests.
   *
   * Baseline agent functionality requires support for [`ContentBlock::Text`]
   * and [`ContentBlock::ResourceLink`] in prompt requests.
   *
   * Other variants must be explicitly opted in to.
   * Capabilities for different types of content in prompt requests.
   *
   * Indicates which content types beyond the baseline (text and resource links)
   * the agent can process.
   *
   * See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "PromptCapabilities".
   */
  export interface PromptCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`ContentBlock::Audio`].
     */
    audio?: boolean;
    /**
     * Agent supports embedded context in `session/prompt` requests.
     *
     * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
     * in prompt requests for pieces of context that are referenced in the message.
     */
    embeddedContext?: boolean;
    /**
     * Agent supports [`ContentBlock::Image`].
     */
    image?: boolean;
    [k: string]: unknown;
  }
  /**
   * The discovery output for a provider.
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "ProviderDiscovery".
   */
  export interface ProviderDiscovery {
    /**
     * Human-readable auth hints surfaced by the adapter.
     */
    auth_hints: string[];
    /**
     * The raw initialize result when probing succeeded.
     */
    initialize_probe: {
      /**
       * The measured initialize response time in milliseconds.
       */
      elapsed_ms: number;
      /**
       * The typed initialize response payload.
       */
      payload: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Capabilities supported by the agent.
         */
        agentCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/load`.
           */
          loadSession?: boolean;
          /**
           * MCP capabilities supported by the agent.
           */
          mcpCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`McpServer::Http`].
             */
            http?: boolean;
            /**
             * Agent supports [`McpServer::Sse`].
             */
            sse?: boolean;
            [k: string]: unknown;
          };
          /**
           * Prompt capabilities supported by the agent.
           */
          promptCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`ContentBlock::Audio`].
             */
            audio?: boolean;
            /**
             * Agent supports embedded context in `session/prompt` requests.
             *
             * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
             * in prompt requests for pieces of context that are referenced in the message.
             */
            embeddedContext?: boolean;
            /**
             * Agent supports [`ContentBlock::Image`].
             */
            image?: boolean;
            [k: string]: unknown;
          };
          /**
           * Session capabilities supported by the agent.
           *
           * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
           *
           * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
           *
           * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
           *
           * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
           */
          sessionCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/list`.
             */
            list?: SessionListCapabilities | null;
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        /**
         * Information about the Agent name and version sent to the Client.
         *
         * Note: in future versions of the protocol, this will be required.
         */
        agentInfo?: Implementation | null;
        /**
         * Authentication methods supported by the agent.
         */
        authMethods?: AuthMethod[];
        /**
         * The protocol version the client specified if supported by the agent,
         * or the latest protocol version supported by the agent.
         *
         * The client should disconnect, if it doesn't support this version.
         */
        protocolVersion: number;
        [k: string]: unknown;
      };
      /**
       * The raw initialize response envelope.
       */
      response: {
        [k: string]: unknown;
      };
      /**
       * The raw stderr lines observed during initialize.
       */
      stderr_lines: string[];
      /**
       * The raw stdout lines observed during initialize.
       */
      stdout_lines: string[];
      [k: string]: unknown;
    };
    /**
     * Whether `initialize` completed successfully.
     */
    initialize_viable: boolean;
    /**
     * The launcher command locked by policy.
     */
    launcher: {
      /**
       * The actual argv that Conduit will pass after the executable.
       */
      args: string[];
      /**
       * The human-readable command string fixed by policy.
       */
      display: string;
      /**
       * The resolved executable path after discovery.
       */
      executable: string;
      [k: string]: unknown;
    };
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * The resolved binary path.
     */
    resolved_path: string;
    /**
     * Diagnostics gathered during probing.
     */
    transport_diagnostics: string[];
    /**
     * The version reported by the adapter.
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * Session capabilities supported by the agent.
   *
   * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
   *
   * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
   *
   * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
   *
   * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
   *
   * This interface was referenced by `ProviderSnapshot`'s JSON-Schema
   * via the `definition` "SessionCapabilities".
   */
  export interface SessionCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/list`.
     */
    list?: SessionListCapabilities | null;
    [k: string]: unknown;
  }
}

export type ProviderSnapshot = ProviderSnapshotTypes.ProviderSnapshot;

export namespace ProvidersConfigSnapshotResultTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;
  /**
   * Snapshot worker status for provider config data.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "ProviderConfigSnapshotStatus".
   */
  export type ProviderConfigSnapshotStatus =
    | "loading"
    | "ready"
    | "error"
    | "unavailable";
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * Result payload for `providers/config_snapshot`.
   */
  export interface ProvidersConfigSnapshotResult {
    /**
     * Snapshot entry for each supported provider.
     */
    entries: ProviderConfigSnapshotEntry[];
  }
  /**
   * One provider config snapshot entry.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "ProviderConfigSnapshotEntry".
   */
  export interface ProviderConfigSnapshotEntry {
    /**
     * Provider config options when available.
     */
    configOptions?: SessionConfigOption[] | null;
    /**
     * Probe error message when available.
     */
    error?: string | null;
    /**
     * Probe completion timestamp when available.
     */
    fetchedAt?: string | null;
    /**
     * Provider model state when available.
     */
    models?: {
      [k: string]: unknown;
    };
    /**
     * Official ACP mode state when available.
     */
    modes?: SessionModeState | null;
    /**
     * Provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * Snapshot status.
     */
    status: "loading" | "ready" | "error" | "unavailable";
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * The set of modes and the one currently active.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionModeState".
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `ProvidersConfigSnapshotResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
}

export type ProvidersConfigSnapshotResult =
  ProvidersConfigSnapshotResultTypes.ProvidersConfigSnapshotResult;

export namespace RawWireEventTypes {
  /**
   * The coarse JSON-RPC shape of a wire event.
   *
   * This interface was referenced by `RawWireEvent`'s JSON-Schema
   * via the `definition` "WireKind".
   */
  export type WireKind = "request" | "response" | "notification" | "diagnostic";
  /**
   * The stream that produced a captured wire event.
   *
   * This interface was referenced by `RawWireEvent`'s JSON-Schema
   * via the `definition` "WireStream".
   */
  export type WireStream = "outgoing" | "incoming" | "stderr";

  /**
   * One raw line captured from the ACP transport.
   */
  export interface RawWireEvent {
    /**
     * Parsed JSON when the line was valid JSON.
     */
    json?: {
      [k: string]: unknown;
    };
    /**
     * The coarse JSON-RPC shape.
     */
    kind: "request" | "response" | "notification" | "diagnostic";
    /**
     * The JSON-RPC method when present.
     */
    method?: string | null;
    /**
     * The raw line text exactly as captured.
     */
    payload: string;
    /**
     * The JSON-RPC request id when present.
     */
    request_id?: string | null;
    /**
     * Monotonic sequence number within a single host connection.
     */
    sequence: number;
    /**
     * The stream that produced the event.
     */
    stream: "outgoing" | "incoming" | "stderr";
    [k: string]: unknown;
  }
}

export type RawWireEvent = RawWireEventTypes.RawWireEvent;

export namespace RuntimeEventTypes {
  /**
   * One UI-facing runtime event emitted on the WebSocket stream.
   */
  export type RuntimeEvent =
    | {
        kind: "sessions_index_changed";
        /**
         * Current session-index revision.
         */
        revision: number;
        [k: string]: unknown;
      }
    | {
        /**
         * Replacement items for the affected prompt turn when available.
         */
        items?: TranscriptItem[] | null;
        kind: "session_timeline_changed";
        /**
         * Open-session identity allocated by Conduit.
         */
        openSessionId: string;
        /**
         * Current timeline revision.
         */
        revision: number;
        [k: string]: unknown;
      };
  /**
   * One projected transcript item for UI consumption.
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";

  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
}

export type RuntimeEvent = RuntimeEventTypes.RuntimeEvent;

export namespace ServerEventFrameTypes {
  /**
   * One projected transcript item for UI consumption.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "TranscriptItem".
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "TranscriptItemStatus".
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";
  /**
   * Author role for projected transcript messages.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "MessageRole".
   */
  export type MessageRole = "user" | "agent";
  /**
   * One UI-facing runtime event emitted on the WebSocket stream.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "RuntimeEvent".
   */
  export type RuntimeEvent =
    | {
        kind: "sessions_index_changed";
        /**
         * Current session-index revision.
         */
        revision: number;
        [k: string]: unknown;
      }
    | {
        /**
         * Replacement items for the affected prompt turn when available.
         */
        items?: TranscriptItem[] | null;
        kind: "session_timeline_changed";
        /**
         * Open-session identity allocated by Conduit.
         */
        openSessionId: string;
        /**
         * Current timeline revision.
         */
        revision: number;
        [k: string]: unknown;
      };
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "ServerEventFrameType".
   */
  export type ServerEventFrameType = "event";

  /**
   * Versioned WebSocket frame carrying one runtime event.
   */
  export interface ServerEventFrame {
    /**
     * Event payload.
     */
    event:
      | {
          kind: "sessions_index_changed";
          /**
           * Current session-index revision.
           */
          revision: number;
          [k: string]: unknown;
        }
      | {
          /**
           * Replacement items for the affected prompt turn when available.
           */
          items?: TranscriptItem[] | null;
          kind: "session_timeline_changed";
          /**
           * Open-session identity allocated by Conduit.
           */
          openSessionId: string;
          /**
           * Current timeline revision.
           */
          revision: number;
          [k: string]: unknown;
        };
    /**
     * Stable frame discriminator.
     */
    type: "event";
    /**
     * Transport protocol version.
     */
    v: number;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `ServerEventFrame`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type ServerEventFrame = ServerEventFrameTypes.ServerEventFrame;

export namespace ServerFrameTypes {
  /**
   * One server-to-client WebSocket frame.
   */
  export type ServerFrame =
    | {
        /**
         * Correlation id echoed from the command.
         */
        id: string;
        /**
         * Response payload.
         */
        response: {
          /**
           * Stable error payload when `ok` is false.
           */
          error?: ConsumerError | null;
          /**
           * Caller-owned request id echoed from the command.
           */
          id: string;
          /**
           * Whether the command completed successfully.
           */
          ok: boolean;
          /**
           * ACP result payload or Conduit-owned command result.
           */
          result: {
            [k: string]: unknown;
          };
          /**
           * Read-side snapshot after command handling when available.
           */
          snapshot?: ProviderSnapshot | null;
        };
        type: "response";
        /**
         * Transport protocol version.
         */
        v: number;
        [k: string]: unknown;
      }
    | {
        /**
         * Event payload.
         */
        event:
          | {
              kind: "sessions_index_changed";
              /**
               * Current session-index revision.
               */
              revision: number;
              [k: string]: unknown;
            }
          | {
              /**
               * Replacement items for the affected prompt turn when available.
               */
              items?: TranscriptItem[] | null;
              kind: "session_timeline_changed";
              /**
               * Open-session identity allocated by Conduit.
               */
              openSessionId: string;
              /**
               * Current timeline revision.
               */
              revision: number;
              [k: string]: unknown;
            };
        type: "event";
        /**
         * Transport protocol version.
         */
        v: number;
        [k: string]: unknown;
      };
  /**
   * Describes an available authentication method.
   *
   * The `type` field acts as the discriminator in the serialized JSON form.
   * When no `type` is present, the method is treated as `agent`.
   */
  export type AuthMethod = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  };
  /**
   * One projected transcript item for UI consumption.
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";

  /**
   * Stable consumer error envelope.
   */
  export interface ConsumerError {
    /**
     * Stable machine-readable error code.
     */
    code: string;
    /**
     * Human-readable error details.
     */
    message: string;
  }
  /**
   * The current provider snapshot exposed to apps and proof tooling.
   */
  export interface ProviderSnapshot {
    /**
     * The provider-reported auth methods from the live initialize result.
     */
    auth_methods: unknown[];
    /**
     * The provider-reported capabilities from the live initialize result.
     */
    capabilities: {
      [k: string]: unknown;
    };
    /**
     * The current connection state.
     */
    connection_state: "disconnected" | "ready";
    /**
     * The locked launcher truth and initialize probe provenance.
     */
    discovery: {
      /**
       * Human-readable auth hints surfaced by the adapter.
       */
      auth_hints: string[];
      /**
       * The raw initialize result when probing succeeded.
       */
      initialize_probe: {
        /**
         * The measured initialize response time in milliseconds.
         */
        elapsed_ms: number;
        /**
         * The typed initialize response payload.
         */
        payload: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Capabilities supported by the agent.
           */
          agentCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/load`.
             */
            loadSession?: boolean;
            /**
             * MCP capabilities supported by the agent.
             */
            mcpCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`McpServer::Http`].
               */
              http?: boolean;
              /**
               * Agent supports [`McpServer::Sse`].
               */
              sse?: boolean;
              [k: string]: unknown;
            };
            /**
             * Prompt capabilities supported by the agent.
             */
            promptCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`ContentBlock::Audio`].
               */
              audio?: boolean;
              /**
               * Agent supports embedded context in `session/prompt` requests.
               *
               * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
               * in prompt requests for pieces of context that are referenced in the message.
               */
              embeddedContext?: boolean;
              /**
               * Agent supports [`ContentBlock::Image`].
               */
              image?: boolean;
              [k: string]: unknown;
            };
            /**
             * Session capabilities supported by the agent.
             *
             * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
             *
             * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
             *
             * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
             *
             * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
             */
            sessionCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Whether the agent supports `session/list`.
               */
              list?: SessionListCapabilities | null;
              [k: string]: unknown;
            };
            [k: string]: unknown;
          };
          /**
           * Information about the Agent name and version sent to the Client.
           *
           * Note: in future versions of the protocol, this will be required.
           */
          agentInfo?: Implementation | null;
          /**
           * Authentication methods supported by the agent.
           */
          authMethods?: AuthMethod[];
          /**
           * The protocol version the client specified if supported by the agent,
           * or the latest protocol version supported by the agent.
           *
           * The client should disconnect, if it doesn't support this version.
           */
          protocolVersion: number;
          [k: string]: unknown;
        };
        /**
         * The raw initialize response envelope.
         */
        response: {
          [k: string]: unknown;
        };
        /**
         * The raw stderr lines observed during initialize.
         */
        stderr_lines: string[];
        /**
         * The raw stdout lines observed during initialize.
         */
        stdout_lines: string[];
        [k: string]: unknown;
      };
      /**
       * Whether `initialize` completed successfully.
       */
      initialize_viable: boolean;
      /**
       * The launcher command locked by policy.
       */
      launcher: {
        /**
         * The actual argv that Conduit will pass after the executable.
         */
        args: string[];
        /**
         * The human-readable command string fixed by policy.
         */
        display: string;
        /**
         * The resolved executable path after discovery.
         */
        executable: string;
        [k: string]: unknown;
      };
      /**
       * The provider identifier.
       */
      provider: "claude" | "copilot" | "codex";
      /**
       * The resolved binary path.
       */
      resolved_path: string;
      /**
       * Diagnostics gathered during probing.
       */
      transport_diagnostics: string[];
      /**
       * The version reported by the adapter.
       */
      version: string;
      [k: string]: unknown;
    };
    /**
     * The last observed prompt lifecycle, if any.
     */
    last_prompt?: PromptLifecycleSnapshot | null;
    /**
     * The live sessions currently tracked in memory.
     */
    live_sessions: LiveSessionSnapshot[];
    /**
     * Transcript replays captured during `session/load`.
     */
    loaded_transcripts?: LoadedTranscriptSnapshot[];
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * Capabilities for the `session/list` method.
   *
   * By supplying `{}` it means that the agent supports listing of sessions.
   */
  export interface SessionListCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  }
  /**
   * Metadata about the implementation of the client or agent.
   * Describes the name and version of an MCP implementation, with an optional
   * title for UI representation.
   */
  export interface Implementation {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Intended for programmatic or logical use, but can be used as a display
     * name fallback if title isn’t present.
     */
    name: string;
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood.
     *
     * If not provided, the name should be used for display.
     */
    title?: string | null;
    /**
     * Version of the implementation. Can be displayed to the user or used
     * for debugging or metrics purposes. (e.g. "1.0.0").
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * A normalized prompt lifecycle snapshot backed by raw ACP updates.
   */
  export interface PromptLifecycleSnapshot {
    /**
     * Agent-authored text chunks observed through official SDK notifications.
     */
    agent_text_chunks?: string[];
    /**
     * The session the prompt belongs to.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of raw session/update notifications observed during the turn.
     */
    raw_update_count: number;
    /**
     * The current lifecycle state.
     */
    state: "idle" | "running" | "completed" | "cancelled";
    /**
     * The ACP stop reason when available.
     */
    stop_reason?: string | null;
    /**
     * Ordered raw ACP `session/update` notifications observed during the turn.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * A normalized live session snapshot anchored to ACP truth.
   */
  export interface LiveSessionSnapshot {
    /**
     * The provider-reported or Conduit-observed working directory.
     */
    cwd: string;
    /**
     * The exact live identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * Whether the session was observed via `new`, `list`, or `load`.
     */
    observed_via: string;
    /**
     * The provider-reported title when available.
     */
    title?: string | null;
    [k: string]: unknown;
  }
  /**
   * Read-side transcript replay captured while loading a session.
   */
  export interface LoadedTranscriptSnapshot {
    /**
     * The loaded session identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of official SDK notifications observed during load.
     */
    raw_update_count: number;
    /**
     * Replayed updates in provider emission order.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
}

export type ServerFrame = ServerFrameTypes.ServerFrame;

export namespace ServerResponseFrameTypes {
  /**
   * Describes an available authentication method.
   *
   * The `type` field acts as the discriminator in the serialized JSON form.
   * When no `type` is present, the method is treated as `agent`.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "AuthMethod".
   */
  export type AuthMethod = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  };
  /**
   * The current host connection state.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ConnectionState".
   */
  export type ConnectionState = "disconnected" | "ready";
  /**
   * The normalized prompt lifecycle state for a single session turn.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "PromptLifecycleState".
   */
  export type PromptLifecycleState =
    | "idle"
    | "running"
    | "completed"
    | "cancelled";
  /**
   * Protocol version identifier.
   *
   * This version is only bumped for breaking changes.
   * Non-breaking changes should be introduced via capabilities.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ProtocolVersion".
   */
  export type ProtocolVersion = number;
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";
  /**
   * Stable string literal used by the generated consumer contract.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ServerResponseFrameType".
   */
  export type ServerResponseFrameType = "response";

  /**
   * Versioned WebSocket frame carrying a command response.
   */
  export interface ServerResponseFrame {
    /**
     * Correlation id echoed from the command.
     */
    id: string;
    /**
     * Consumer response payload.
     */
    response: {
      /**
       * Stable error payload when `ok` is false.
       */
      error?: ConsumerError | null;
      /**
       * Caller-owned request id echoed from the command.
       */
      id: string;
      /**
       * Whether the command completed successfully.
       */
      ok: boolean;
      /**
       * ACP result payload or Conduit-owned command result.
       */
      result: {
        [k: string]: unknown;
      };
      /**
       * Read-side snapshot after command handling when available.
       */
      snapshot?: ProviderSnapshot | null;
    };
    /**
     * Stable frame discriminator.
     */
    type: "response";
    /**
     * Transport protocol version.
     */
    v: number;
  }
  /**
   * Stable consumer error envelope.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ConsumerError".
   */
  export interface ConsumerError {
    /**
     * Stable machine-readable error code.
     */
    code: string;
    /**
     * Human-readable error details.
     */
    message: string;
  }
  /**
   * The current provider snapshot exposed to apps and proof tooling.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ProviderSnapshot".
   */
  export interface ProviderSnapshot {
    /**
     * The provider-reported auth methods from the live initialize result.
     */
    auth_methods: unknown[];
    /**
     * The provider-reported capabilities from the live initialize result.
     */
    capabilities: {
      [k: string]: unknown;
    };
    /**
     * The current connection state.
     */
    connection_state: "disconnected" | "ready";
    /**
     * The locked launcher truth and initialize probe provenance.
     */
    discovery: {
      /**
       * Human-readable auth hints surfaced by the adapter.
       */
      auth_hints: string[];
      /**
       * The raw initialize result when probing succeeded.
       */
      initialize_probe: {
        /**
         * The measured initialize response time in milliseconds.
         */
        elapsed_ms: number;
        /**
         * The typed initialize response payload.
         */
        payload: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Capabilities supported by the agent.
           */
          agentCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/load`.
             */
            loadSession?: boolean;
            /**
             * MCP capabilities supported by the agent.
             */
            mcpCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`McpServer::Http`].
               */
              http?: boolean;
              /**
               * Agent supports [`McpServer::Sse`].
               */
              sse?: boolean;
              [k: string]: unknown;
            };
            /**
             * Prompt capabilities supported by the agent.
             */
            promptCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Agent supports [`ContentBlock::Audio`].
               */
              audio?: boolean;
              /**
               * Agent supports embedded context in `session/prompt` requests.
               *
               * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
               * in prompt requests for pieces of context that are referenced in the message.
               */
              embeddedContext?: boolean;
              /**
               * Agent supports [`ContentBlock::Image`].
               */
              image?: boolean;
              [k: string]: unknown;
            };
            /**
             * Session capabilities supported by the agent.
             *
             * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
             *
             * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
             *
             * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
             *
             * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
             */
            sessionCapabilities?: {
              /**
               * The _meta property is reserved by ACP to allow clients and agents to attach additional
               * metadata to their interactions. Implementations MUST NOT make assumptions about values at
               * these keys.
               *
               * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
               */
              _meta?: {
                [k: string]: unknown;
              } | null;
              /**
               * Whether the agent supports `session/list`.
               */
              list?: SessionListCapabilities | null;
              [k: string]: unknown;
            };
            [k: string]: unknown;
          };
          /**
           * Information about the Agent name and version sent to the Client.
           *
           * Note: in future versions of the protocol, this will be required.
           */
          agentInfo?: Implementation | null;
          /**
           * Authentication methods supported by the agent.
           */
          authMethods?: AuthMethod[];
          /**
           * The protocol version the client specified if supported by the agent,
           * or the latest protocol version supported by the agent.
           *
           * The client should disconnect, if it doesn't support this version.
           */
          protocolVersion: number;
          [k: string]: unknown;
        };
        /**
         * The raw initialize response envelope.
         */
        response: {
          [k: string]: unknown;
        };
        /**
         * The raw stderr lines observed during initialize.
         */
        stderr_lines: string[];
        /**
         * The raw stdout lines observed during initialize.
         */
        stdout_lines: string[];
        [k: string]: unknown;
      };
      /**
       * Whether `initialize` completed successfully.
       */
      initialize_viable: boolean;
      /**
       * The launcher command locked by policy.
       */
      launcher: {
        /**
         * The actual argv that Conduit will pass after the executable.
         */
        args: string[];
        /**
         * The human-readable command string fixed by policy.
         */
        display: string;
        /**
         * The resolved executable path after discovery.
         */
        executable: string;
        [k: string]: unknown;
      };
      /**
       * The provider identifier.
       */
      provider: "claude" | "copilot" | "codex";
      /**
       * The resolved binary path.
       */
      resolved_path: string;
      /**
       * Diagnostics gathered during probing.
       */
      transport_diagnostics: string[];
      /**
       * The version reported by the adapter.
       */
      version: string;
      [k: string]: unknown;
    };
    /**
     * The last observed prompt lifecycle, if any.
     */
    last_prompt?: PromptLifecycleSnapshot | null;
    /**
     * The live sessions currently tracked in memory.
     */
    live_sessions: LiveSessionSnapshot[];
    /**
     * Transcript replays captured during `session/load`.
     */
    loaded_transcripts?: LoadedTranscriptSnapshot[];
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * Capabilities for the `session/list` method.
   *
   * By supplying `{}` it means that the agent supports listing of sessions.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "SessionListCapabilities".
   */
  export interface SessionListCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  }
  /**
   * Metadata about the implementation of the client or agent.
   * Describes the name and version of an MCP implementation, with an optional
   * title for UI representation.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "Implementation".
   */
  export interface Implementation {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Intended for programmatic or logical use, but can be used as a display
     * name fallback if title isn’t present.
     */
    name: string;
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood.
     *
     * If not provided, the name should be used for display.
     */
    title?: string | null;
    /**
     * Version of the implementation. Can be displayed to the user or used
     * for debugging or metrics purposes. (e.g. "1.0.0").
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * A normalized prompt lifecycle snapshot backed by raw ACP updates.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "PromptLifecycleSnapshot".
   */
  export interface PromptLifecycleSnapshot {
    /**
     * Agent-authored text chunks observed through official SDK notifications.
     */
    agent_text_chunks?: string[];
    /**
     * The session the prompt belongs to.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of raw session/update notifications observed during the turn.
     */
    raw_update_count: number;
    /**
     * The current lifecycle state.
     */
    state: "idle" | "running" | "completed" | "cancelled";
    /**
     * The ACP stop reason when available.
     */
    stop_reason?: string | null;
    /**
     * Ordered raw ACP `session/update` notifications observed during the turn.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * One replayed `session/update` captured during `session/load`.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "TranscriptUpdateSnapshot".
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
  /**
   * A normalized live session snapshot anchored to ACP truth.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "LiveSessionSnapshot".
   */
  export interface LiveSessionSnapshot {
    /**
     * The provider-reported or Conduit-observed working directory.
     */
    cwd: string;
    /**
     * The exact live identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * Whether the session was observed via `new`, `list`, or `load`.
     */
    observed_via: string;
    /**
     * The provider-reported title when available.
     */
    title?: string | null;
    [k: string]: unknown;
  }
  /**
   * Read-side transcript replay captured while loading a session.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "LoadedTranscriptSnapshot".
   */
  export interface LoadedTranscriptSnapshot {
    /**
     * The loaded session identity.
     */
    identity: {
      /**
       * The ACP session id returned by the provider.
       */
      acp_session_id: string;
      /**
       * The provider owning this session.
       */
      provider: "claude" | "copilot" | "codex";
      [k: string]: unknown;
    };
    /**
     * The number of official SDK notifications observed during load.
     */
    raw_update_count: number;
    /**
     * Replayed updates in provider emission order.
     */
    updates?: TranscriptUpdateSnapshot[];
    [k: string]: unknown;
  }
  /**
   * Capabilities supported by the agent.
   *
   * Advertised during initialization to inform the client about
   * available features and content types.
   *
   * See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "AgentCapabilities".
   */
  export interface AgentCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/load`.
     */
    loadSession?: boolean;
    /**
     * MCP capabilities supported by the agent.
     */
    mcpCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`McpServer::Http`].
       */
      http?: boolean;
      /**
       * Agent supports [`McpServer::Sse`].
       */
      sse?: boolean;
      [k: string]: unknown;
    };
    /**
     * Prompt capabilities supported by the agent.
     */
    promptCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Agent supports [`ContentBlock::Audio`].
       */
      audio?: boolean;
      /**
       * Agent supports embedded context in `session/prompt` requests.
       *
       * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
       * in prompt requests for pieces of context that are referenced in the message.
       */
      embeddedContext?: boolean;
      /**
       * Agent supports [`ContentBlock::Image`].
       */
      image?: boolean;
      [k: string]: unknown;
    };
    /**
     * Session capabilities supported by the agent.
     *
     * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
     *
     * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
     *
     * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
     *
     * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
     */
    sessionCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/list`.
       */
      list?: SessionListCapabilities | null;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }
  /**
   * Agent handles authentication itself.
   *
   * This is the default authentication method type.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "AuthMethodAgent".
   */
  export interface AuthMethodAgent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description providing more details about this authentication method.
     */
    description?: string | null;
    /**
     * Unique identifier for this authentication method.
     */
    id: string;
    /**
     * Human-readable name of the authentication method.
     */
    name: string;
    [k: string]: unknown;
  }
  /**
   * One stable consumer response envelope.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ConsumerResponse".
   */
  export interface ConsumerResponse {
    /**
     * Stable error payload when `ok` is false.
     */
    error?: ConsumerError | null;
    /**
     * Caller-owned request id echoed from the command.
     */
    id: string;
    /**
     * Whether the command completed successfully.
     */
    ok: boolean;
    /**
     * ACP result payload or Conduit-owned command result.
     */
    result: {
      [k: string]: unknown;
    };
    /**
     * Read-side snapshot after command handling when available.
     */
    snapshot?: ProviderSnapshot | null;
  }
  /**
   * The initialize probe result returned by discovery.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "InitializeProbe".
   */
  export interface InitializeProbe {
    /**
     * The measured initialize response time in milliseconds.
     */
    elapsed_ms: number;
    /**
     * The typed initialize response payload.
     */
    payload: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Capabilities supported by the agent.
       */
      agentCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/load`.
         */
        loadSession?: boolean;
        /**
         * MCP capabilities supported by the agent.
         */
        mcpCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`McpServer::Http`].
           */
          http?: boolean;
          /**
           * Agent supports [`McpServer::Sse`].
           */
          sse?: boolean;
          [k: string]: unknown;
        };
        /**
         * Prompt capabilities supported by the agent.
         */
        promptCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Agent supports [`ContentBlock::Audio`].
           */
          audio?: boolean;
          /**
           * Agent supports embedded context in `session/prompt` requests.
           *
           * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
           * in prompt requests for pieces of context that are referenced in the message.
           */
          embeddedContext?: boolean;
          /**
           * Agent supports [`ContentBlock::Image`].
           */
          image?: boolean;
          [k: string]: unknown;
        };
        /**
         * Session capabilities supported by the agent.
         *
         * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
         *
         * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
         *
         * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
         *
         * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
         */
        sessionCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/list`.
           */
          list?: SessionListCapabilities | null;
          [k: string]: unknown;
        };
        [k: string]: unknown;
      };
      /**
       * Information about the Agent name and version sent to the Client.
       *
       * Note: in future versions of the protocol, this will be required.
       */
      agentInfo?: Implementation | null;
      /**
       * Authentication methods supported by the agent.
       */
      authMethods?: AuthMethod[];
      /**
       * The protocol version the client specified if supported by the agent,
       * or the latest protocol version supported by the agent.
       *
       * The client should disconnect, if it doesn't support this version.
       */
      protocolVersion: number;
      [k: string]: unknown;
    };
    /**
     * The raw initialize response envelope.
     */
    response: {
      [k: string]: unknown;
    };
    /**
     * The raw stderr lines observed during initialize.
     */
    stderr_lines: string[];
    /**
     * The raw stdout lines observed during initialize.
     */
    stdout_lines: string[];
    [k: string]: unknown;
  }
  /**
   * Response to the `initialize` method.
   *
   * Contains the negotiated protocol version and agent capabilities.
   *
   * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "InitializeResponse".
   */
  export interface InitializeResponse {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Capabilities supported by the agent.
     */
    agentCapabilities?: {
      /**
       * The _meta property is reserved by ACP to allow clients and agents to attach additional
       * metadata to their interactions. Implementations MUST NOT make assumptions about values at
       * these keys.
       *
       * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
       */
      _meta?: {
        [k: string]: unknown;
      } | null;
      /**
       * Whether the agent supports `session/load`.
       */
      loadSession?: boolean;
      /**
       * MCP capabilities supported by the agent.
       */
      mcpCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`McpServer::Http`].
         */
        http?: boolean;
        /**
         * Agent supports [`McpServer::Sse`].
         */
        sse?: boolean;
        [k: string]: unknown;
      };
      /**
       * Prompt capabilities supported by the agent.
       */
      promptCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Agent supports [`ContentBlock::Audio`].
         */
        audio?: boolean;
        /**
         * Agent supports embedded context in `session/prompt` requests.
         *
         * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
         * in prompt requests for pieces of context that are referenced in the message.
         */
        embeddedContext?: boolean;
        /**
         * Agent supports [`ContentBlock::Image`].
         */
        image?: boolean;
        [k: string]: unknown;
      };
      /**
       * Session capabilities supported by the agent.
       *
       * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
       *
       * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
       *
       * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
       *
       * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
       */
      sessionCapabilities?: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Whether the agent supports `session/list`.
         */
        list?: SessionListCapabilities | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    /**
     * Information about the Agent name and version sent to the Client.
     *
     * Note: in future versions of the protocol, this will be required.
     */
    agentInfo?: Implementation | null;
    /**
     * Authentication methods supported by the agent.
     */
    authMethods?: AuthMethod[];
    /**
     * The protocol version the client specified if supported by the agent,
     * or the latest protocol version supported by the agent.
     *
     * The client should disconnect, if it doesn't support this version.
     */
    protocolVersion: number;
    [k: string]: unknown;
  }
  /**
   * The exact launcher command Conduit is allowed to run for a provider.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "LauncherCommand".
   */
  export interface LauncherCommand {
    /**
     * The actual argv that Conduit will pass after the executable.
     */
    args: string[];
    /**
     * The human-readable command string fixed by policy.
     */
    display: string;
    /**
     * The resolved executable path after discovery.
     */
    executable: string;
    [k: string]: unknown;
  }
  /**
   * The exact live session identity rule for Conduit.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "LiveSessionIdentity".
   */
  export interface LiveSessionIdentity {
    /**
     * The ACP session id returned by the provider.
     */
    acp_session_id: string;
    /**
     * The provider owning this session.
     */
    provider: "claude" | "copilot" | "codex";
    [k: string]: unknown;
  }
  /**
   * MCP capabilities supported by the agent
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "McpCapabilities".
   */
  export interface McpCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`McpServer::Http`].
     */
    http?: boolean;
    /**
     * Agent supports [`McpServer::Sse`].
     */
    sse?: boolean;
    [k: string]: unknown;
  }
  /**
   * Prompt capabilities supported by the agent in `session/prompt` requests.
   *
   * Baseline agent functionality requires support for [`ContentBlock::Text`]
   * and [`ContentBlock::ResourceLink`] in prompt requests.
   *
   * Other variants must be explicitly opted in to.
   * Capabilities for different types of content in prompt requests.
   *
   * Indicates which content types beyond the baseline (text and resource links)
   * the agent can process.
   *
   * See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "PromptCapabilities".
   */
  export interface PromptCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Agent supports [`ContentBlock::Audio`].
     */
    audio?: boolean;
    /**
     * Agent supports embedded context in `session/prompt` requests.
     *
     * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
     * in prompt requests for pieces of context that are referenced in the message.
     */
    embeddedContext?: boolean;
    /**
     * Agent supports [`ContentBlock::Image`].
     */
    image?: boolean;
    [k: string]: unknown;
  }
  /**
   * The discovery output for a provider.
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "ProviderDiscovery".
   */
  export interface ProviderDiscovery {
    /**
     * Human-readable auth hints surfaced by the adapter.
     */
    auth_hints: string[];
    /**
     * The raw initialize result when probing succeeded.
     */
    initialize_probe: {
      /**
       * The measured initialize response time in milliseconds.
       */
      elapsed_ms: number;
      /**
       * The typed initialize response payload.
       */
      payload: {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        /**
         * Capabilities supported by the agent.
         */
        agentCapabilities?: {
          /**
           * The _meta property is reserved by ACP to allow clients and agents to attach additional
           * metadata to their interactions. Implementations MUST NOT make assumptions about values at
           * these keys.
           *
           * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
           */
          _meta?: {
            [k: string]: unknown;
          } | null;
          /**
           * Whether the agent supports `session/load`.
           */
          loadSession?: boolean;
          /**
           * MCP capabilities supported by the agent.
           */
          mcpCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`McpServer::Http`].
             */
            http?: boolean;
            /**
             * Agent supports [`McpServer::Sse`].
             */
            sse?: boolean;
            [k: string]: unknown;
          };
          /**
           * Prompt capabilities supported by the agent.
           */
          promptCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Agent supports [`ContentBlock::Audio`].
             */
            audio?: boolean;
            /**
             * Agent supports embedded context in `session/prompt` requests.
             *
             * When enabled, the Client is allowed to include [`ContentBlock::Resource`]
             * in prompt requests for pieces of context that are referenced in the message.
             */
            embeddedContext?: boolean;
            /**
             * Agent supports [`ContentBlock::Image`].
             */
            image?: boolean;
            [k: string]: unknown;
          };
          /**
           * Session capabilities supported by the agent.
           *
           * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
           *
           * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
           *
           * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
           *
           * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
           */
          sessionCapabilities?: {
            /**
             * The _meta property is reserved by ACP to allow clients and agents to attach additional
             * metadata to their interactions. Implementations MUST NOT make assumptions about values at
             * these keys.
             *
             * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
             */
            _meta?: {
              [k: string]: unknown;
            } | null;
            /**
             * Whether the agent supports `session/list`.
             */
            list?: SessionListCapabilities | null;
            [k: string]: unknown;
          };
          [k: string]: unknown;
        };
        /**
         * Information about the Agent name and version sent to the Client.
         *
         * Note: in future versions of the protocol, this will be required.
         */
        agentInfo?: Implementation | null;
        /**
         * Authentication methods supported by the agent.
         */
        authMethods?: AuthMethod[];
        /**
         * The protocol version the client specified if supported by the agent,
         * or the latest protocol version supported by the agent.
         *
         * The client should disconnect, if it doesn't support this version.
         */
        protocolVersion: number;
        [k: string]: unknown;
      };
      /**
       * The raw initialize response envelope.
       */
      response: {
        [k: string]: unknown;
      };
      /**
       * The raw stderr lines observed during initialize.
       */
      stderr_lines: string[];
      /**
       * The raw stdout lines observed during initialize.
       */
      stdout_lines: string[];
      [k: string]: unknown;
    };
    /**
     * Whether `initialize` completed successfully.
     */
    initialize_viable: boolean;
    /**
     * The launcher command locked by policy.
     */
    launcher: {
      /**
       * The actual argv that Conduit will pass after the executable.
       */
      args: string[];
      /**
       * The human-readable command string fixed by policy.
       */
      display: string;
      /**
       * The resolved executable path after discovery.
       */
      executable: string;
      [k: string]: unknown;
    };
    /**
     * The provider identifier.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * The resolved binary path.
     */
    resolved_path: string;
    /**
     * Diagnostics gathered during probing.
     */
    transport_diagnostics: string[];
    /**
     * The version reported by the adapter.
     */
    version: string;
    [k: string]: unknown;
  }
  /**
   * Session capabilities supported by the agent.
   *
   * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
   *
   * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
   *
   * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
   *
   * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
   *
   * This interface was referenced by `ServerResponseFrame`'s JSON-Schema
   * via the `definition` "SessionCapabilities".
   */
  export interface SessionCapabilities {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Whether the agent supports `session/list`.
     */
    list?: SessionListCapabilities | null;
    [k: string]: unknown;
  }
}

export type ServerResponseFrame = ServerResponseFrameTypes.ServerResponseFrame;

export namespace SessionCancelRequestTypes {
  /**
   * Request payload for `session/cancel`.
   */
  export interface SessionCancelRequest {
    /**
     * Provider ACP session identifier.
     */
    session_id: string;
  }
}

export type SessionCancelRequest =
  SessionCancelRequestTypes.SessionCancelRequest;

export namespace SessionConfigOptionTypes {
  /**
   * A session configuration option selector and its current state.
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `undefined`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
}

export type SessionConfigOption = SessionConfigOptionTypes.SessionConfigOption;

export namespace SessionGroupTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `SessionGroup`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * One grouped session-browser project view.
   */
  export interface SessionGroup {
    /**
     * Absolute normalized cwd represented by the group.
     */
    cwd: string;
    /**
     * User-facing project label.
     */
    displayName: string;
    /**
     * Stable project group identity.
     */
    groupId: string;
    /**
     * Sessions currently grouped under the project.
     */
    sessions: SessionRow[];
  }
  /**
   * One session row inside a grouped session view.
   *
   * This interface was referenced by `SessionGroup`'s JSON-Schema
   * via the `definition` "SessionRow".
   */
  export interface SessionRow {
    /**
     * Provider owning the session.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * ACP session identifier.
     */
    sessionId: string;
    /**
     * Human-readable session title when available.
     */
    title?: string | null;
    /**
     * Last activity timestamp when available.
     */
    updatedAt?: string | null;
  }
}

export type SessionGroup = SessionGroupTypes.SessionGroup;

export namespace SessionGroupsQueryTypes {
  /**
   * Query parameters for `sessions/grouped`.
   */
  export interface SessionGroupsQuery {
    /**
     * Optional lookback window in days.
     */
    updatedWithinDays?: number | null;
  }
}

export type SessionGroupsQuery = SessionGroupsQueryTypes.SessionGroupsQuery;

export namespace SessionGroupsViewTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `SessionGroupsView`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * Session browser grouped read model.
   */
  export interface SessionGroupsView {
    /**
     * Grouped projects and their sessions.
     */
    groups: SessionGroup[];
    /**
     * Whether the view is still warming up in the background.
     */
    isRefreshing: boolean;
    /**
     * Last refresh timestamp when available.
     */
    refreshedAt?: string | null;
    /**
     * Session-index revision after the grouped projection.
     */
    revision: number;
  }
  /**
   * One grouped session-browser project view.
   *
   * This interface was referenced by `SessionGroupsView`'s JSON-Schema
   * via the `definition` "SessionGroup".
   */
  export interface SessionGroup {
    /**
     * Absolute normalized cwd represented by the group.
     */
    cwd: string;
    /**
     * User-facing project label.
     */
    displayName: string;
    /**
     * Stable project group identity.
     */
    groupId: string;
    /**
     * Sessions currently grouped under the project.
     */
    sessions: SessionRow[];
  }
  /**
   * One session row inside a grouped session view.
   *
   * This interface was referenced by `SessionGroupsView`'s JSON-Schema
   * via the `definition` "SessionRow".
   */
  export interface SessionRow {
    /**
     * Provider owning the session.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * ACP session identifier.
     */
    sessionId: string;
    /**
     * Human-readable session title when available.
     */
    title?: string | null;
    /**
     * Last activity timestamp when available.
     */
    updatedAt?: string | null;
  }
}

export type SessionGroupsView = SessionGroupsViewTypes.SessionGroupsView;

export namespace SessionHistoryRequestTypes {
  /**
   * Request payload for `session/history`.
   */
  export interface SessionHistoryRequest {
    /**
     * Optional older-page cursor.
     */
    cursor?: string | null;
    /**
     * Optional history window size.
     */
    limit?: number | null;
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
  }
}

export type SessionHistoryRequest =
  SessionHistoryRequestTypes.SessionHistoryRequest;

export namespace SessionHistoryWindowTypes {
  /**
   * One projected transcript item for UI consumption.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "TranscriptItem".
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "TranscriptItemStatus".
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";
  /**
   * Author role for projected transcript messages.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "MessageRole".
   */
  export type MessageRole = "user" | "agent";

  /**
   * One transcript history window returned to UI consumers.
   */
  export interface SessionHistoryWindow {
    /**
     * Window of transcript items in display order.
     */
    items: TranscriptItem[];
    /**
     * Cursor for the next older page, when one exists.
     */
    nextCursor?: string | null;
    /**
     * Opaque Conduit id for the opened session.
     */
    openSessionId: string;
    /**
     * Current timeline revision for this opened session.
     */
    revision: number;
    [k: string]: unknown;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `SessionHistoryWindow`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type SessionHistoryWindow =
  SessionHistoryWindowTypes.SessionHistoryWindow;

export namespace SessionModeStateTypes {
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `SessionModeState`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;

  /**
   * The set of modes and the one currently active.
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `SessionModeState`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
}

export type SessionModeState = SessionModeStateTypes.SessionModeState;

export namespace SessionNewRequestTypes {
  /**
   * Request payload for `session/new`.
   */
  export interface SessionNewRequest {
    /**
     * Absolute normalized cwd for the new session.
     */
    cwd: string;
    /**
     * Optional initial transcript window size.
     */
    limit?: number | null;
  }
}

export type SessionNewRequest = SessionNewRequestTypes.SessionNewRequest;

export namespace SessionNewResultTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * One projected transcript item for UI consumption.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "TranscriptItem".
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "TranscriptItemStatus".
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;
  /**
   * Author role for projected transcript messages.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "MessageRole".
   */
  export type MessageRole = "user" | "agent";
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * Result payload for `session/new`.
   */
  export interface SessionNewResult {
    /**
     * Session configuration options when available.
     */
    configOptions?: SessionConfigOption[] | null;
    /**
     * Initial transcript history window.
     */
    history: {
      /**
       * Window of transcript items in display order.
       */
      items: TranscriptItem[];
      /**
       * Cursor for the next older page, when one exists.
       */
      nextCursor?: string | null;
      /**
       * Opaque Conduit id for the opened session.
       */
      openSessionId: string;
      /**
       * Current timeline revision for this opened session.
       */
      revision: number;
      [k: string]: unknown;
    };
    /**
     * Provider model state when available.
     */
    models?: {
      [k: string]: unknown;
    };
    /**
     * Official ACP mode state when available.
     */
    modes?: SessionModeState | null;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * The set of modes and the one currently active.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionModeState".
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
  /**
   * One transcript history window returned to UI consumers.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "SessionHistoryWindow".
   */
  export interface SessionHistoryWindow {
    /**
     * Window of transcript items in display order.
     */
    items: TranscriptItem[];
    /**
     * Cursor for the next older page, when one exists.
     */
    nextCursor?: string | null;
    /**
     * Opaque Conduit id for the opened session.
     */
    openSessionId: string;
    /**
     * Current timeline revision for this opened session.
     */
    revision: number;
    [k: string]: unknown;
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `SessionNewResult`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type SessionNewResult = SessionNewResultTypes.SessionNewResult;

export namespace SessionOpenRequestTypes {
  /**
   * Request payload for `session/open`.
   */
  export interface SessionOpenRequest {
    /**
     * Absolute normalized cwd identity for the session.
     */
    cwd: string;
    /**
     * Optional transcript window size.
     */
    limit?: number | null;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
}

export type SessionOpenRequest = SessionOpenRequestTypes.SessionOpenRequest;

export namespace SessionOpenResultTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * One projected transcript item for UI consumption.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "TranscriptItem".
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "TranscriptItemStatus".
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;
  /**
   * Author role for projected transcript messages.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "MessageRole".
   */
  export type MessageRole = "user" | "agent";
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * Result payload for `session/open`.
   */
  export interface SessionOpenResult {
    /**
     * Session configuration options when available.
     */
    configOptions?: SessionConfigOption[] | null;
    /**
     * Window of transcript items in display order.
     */
    items: TranscriptItem[];
    /**
     * Provider model state when available.
     */
    models?: {
      [k: string]: unknown;
    };
    /**
     * Official ACP mode state when available.
     */
    modes?: SessionModeState | null;
    /**
     * Cursor for the next older page when one exists.
     */
    nextCursor?: string | null;
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
    /**
     * Current history revision.
     */
    revision: number;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * The set of modes and the one currently active.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionModeState".
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `SessionOpenResult`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type SessionOpenResult = SessionOpenResultTypes.SessionOpenResult;

export namespace SessionPromptRequestTypes {
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "ContentBlock".
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "Role".
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "EmbeddedResourceResource".
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;

  /**
   * Request payload for `session/prompt`.
   */
  export interface SessionPromptRequest {
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
    /**
     * ACP content blocks for the prompt.
     */
    prompt: ContentBlock[];
  }
  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "Annotations".
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "TextResourceContents".
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "BlobResourceContents".
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Audio provided to or from an LLM.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "AudioContent".
   */
  export interface AudioContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    [k: string]: unknown;
  }
  /**
   * The contents of a resource, embedded into a prompt or tool call result.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "EmbeddedResource".
   */
  export interface EmbeddedResource {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    resource: EmbeddedResourceResource;
    [k: string]: unknown;
  }
  /**
   * An image provided to or from an LLM.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "ImageContent".
   */
  export interface ImageContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    data: string;
    mimeType: string;
    uri?: string | null;
    [k: string]: unknown;
  }
  /**
   * A resource that the server is capable of reading, included in a prompt or tool call result.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "ResourceLink".
   */
  export interface ResourceLink {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    description?: string | null;
    mimeType?: string | null;
    name: string;
    size?: number | null;
    title?: string | null;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Text provided to or from an LLM.
   *
   * This interface was referenced by `SessionPromptRequest`'s JSON-Schema
   * via the `definition` "TextContent".
   */
  export interface TextContent {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    annotations?: Annotations | null;
    text: string;
    [k: string]: unknown;
  }
}

export type SessionPromptRequest =
  SessionPromptRequestTypes.SessionPromptRequest;

export namespace SessionRowTypes {
  /**
   * The three providers supported by Conduit Phase 1.
   *
   * This interface was referenced by `SessionRow`'s JSON-Schema
   * via the `definition` "ProviderId".
   */
  export type ProviderId = "claude" | "copilot" | "codex";

  /**
   * One session row inside a grouped session view.
   */
  export interface SessionRow {
    /**
     * Provider owning the session.
     */
    provider: "claude" | "copilot" | "codex";
    /**
     * ACP session identifier.
     */
    sessionId: string;
    /**
     * Human-readable session title when available.
     */
    title?: string | null;
    /**
     * Last activity timestamp when available.
     */
    updatedAt?: string | null;
  }
}

export type SessionRow = SessionRowTypes.SessionRow;

export namespace SessionSetConfigOptionRequestTypes {
  /**
   * Request payload for `session/set_config_option`.
   */
  export interface SessionSetConfigOptionRequest {
    /**
     * ACP config option identifier.
     */
    configId: string;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
    /**
     * Selected config value identifier.
     */
    value: string;
  }
}

export type SessionSetConfigOptionRequest =
  SessionSetConfigOptionRequestTypes.SessionSetConfigOptionRequest;

export namespace SessionSetConfigOptionResultTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * Result payload for `session/set_config_option`.
   */
  export interface SessionSetConfigOptionResult {
    /**
     * Updated session configuration options.
     */
    configOptions: SessionConfigOption[];
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `SessionSetConfigOptionResult`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
}

export type SessionSetConfigOptionResult =
  SessionSetConfigOptionResultTypes.SessionSetConfigOptionResult;

export namespace SessionStateProjectionTypes {
  /**
   * A session configuration option selector and its current state.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigOption".
   */
  export type SessionConfigOption = {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional semantic category for this option (UX only).
     */
    category?: SessionConfigOptionCategory | null;
    /**
     * Optional description for the Client to display to the user.
     */
    description?: string | null;
    /**
     * Unique identifier for the configuration option.
     */
    id: string;
    /**
     * Human-readable label for the option.
     */
    name: string;
    [k: string]: unknown;
  } & SessionConfigOption1;
  /**
   * Semantic category for a session configuration option.
   *
   * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
   * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
   * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
   * categories gracefully.
   *
   * Category names beginning with `_` are free for custom use, like other ACP extension methods.
   * Category names that do not begin with `_` are reserved for the ACP spec.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigOptionCategory".
   */
  export type SessionConfigOptionCategory =
    | "mode"
    | "model"
    | "thought_level"
    | string;
  export type SessionConfigOption1 = {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    type: "select";
    [k: string]: unknown;
  };
  /**
   * Unique identifier for a Session Mode.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionModeId".
   */
  export type SessionModeId = string;
  /**
   * Unique identifier for a session configuration option value group.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigGroupId".
   */
  export type SessionConfigGroupId = string;
  /**
   * Unique identifier for a session configuration option.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigId".
   */
  export type SessionConfigId = string;
  /**
   * Possible values for a session configuration option.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOptions".
   */
  export type SessionConfigSelectOptions =
    | SessionConfigSelectOption[]
    | SessionConfigSelectGroup[];
  /**
   * Unique identifier for a session configuration option value.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigValueId".
   */
  export type SessionConfigValueId = string;

  /**
   * Provider-backed state stored for session/open projections.
   */
  export interface SessionStateProjection {
    /**
     * Session configuration options when available.
     */
    configOptions?: SessionConfigOption[] | null;
    /**
     * Provider model state when available.
     */
    models?: {
      [k: string]: unknown;
    };
    /**
     * Official ACP mode state when available.
     */
    modes?: SessionModeState | null;
    /**
     * Provider ACP session identifier.
     */
    sessionId: string;
  }
  /**
   * A possible value for a session configuration option.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigSelectOption".
   */
  export interface SessionConfigSelectOption {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Optional description for this option value.
     */
    description?: string | null;
    /**
     * Human-readable label for this option value.
     */
    name: string;
    /**
     * Unique identifier for this option value.
     */
    value: string;
    [k: string]: unknown;
  }
  /**
   * A group of possible values for a session configuration option.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigSelectGroup".
   */
  export interface SessionConfigSelectGroup {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * Unique identifier for this group.
     */
    group: string;
    /**
     * Human-readable label for this group.
     */
    name: string;
    /**
     * The set of option values in this group.
     */
    options: SessionConfigSelectOption[];
    [k: string]: unknown;
  }
  /**
   * The set of modes and the one currently active.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionModeState".
   */
  export interface SessionModeState {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    /**
     * The set of modes that the Agent can operate in
     */
    availableModes: SessionMode[];
    /**
     * The current mode the Agent is in.
     */
    currentModeId: string;
    [k: string]: unknown;
  }
  /**
   * A mode the agent can operate in.
   *
   * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionMode".
   */
  export interface SessionMode {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    description?: string | null;
    id: SessionModeId;
    name: string;
    [k: string]: unknown;
  }
  /**
   * A single-value selector (dropdown) session configuration option payload.
   *
   * This interface was referenced by `SessionStateProjection`'s JSON-Schema
   * via the `definition` "SessionConfigSelect".
   */
  export interface SessionConfigSelect {
    /**
     * The currently selected value.
     */
    currentValue: string;
    /**
     * The set of selectable options.
     */
    options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
    [k: string]: unknown;
  }
}

export type SessionStateProjection =
  SessionStateProjectionTypes.SessionStateProjection;

export namespace SessionWatchRequestTypes {
  /**
   * Request payload for `session/watch`.
   */
  export interface SessionWatchRequest {
    /**
     * Open-session identity allocated by Conduit.
     */
    openSessionId: string;
  }
}

export type SessionWatchRequest = SessionWatchRequestTypes.SessionWatchRequest;

export namespace TranscriptItemTypes {
  /**
   * One projected transcript item for UI consumption.
   */
  export type TranscriptItem =
    | {
        /**
         * ACP content blocks in transcript order.
         */
        content: ContentBlock[];
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "message";
        /**
         * Message author role.
         */
        role: "user" | "agent";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        [k: string]: unknown;
      }
    | {
        /**
         * Structured ACP update payload.
         */
        data: {
          [k: string]: unknown;
        };
        /**
         * Stable item id within the loaded transcript.
         */
        id: string;
        kind: "event";
        /**
         * Live prompt item status when the item is part of a prompt turn.
         */
        status?: TranscriptItemStatus | null;
        /**
         * ACP stop reason for the completed turn, when known.
         */
        stopReason?: string | null;
        /**
         * Prompt turn id when the item belongs to a live prompt turn.
         */
        turnId?: string | null;
        /**
         * Official ACP update variant.
         */
        variant: string;
        [k: string]: unknown;
      };
  /**
   * Content blocks represent displayable information in the Agent Client Protocol.
   *
   * They provide a structured way to handle various types of user-facing content—whether
   * it's text from language models, images for analysis, or embedded resources for context.
   *
   * Content blocks appear in:
   * - User prompts sent via `session/prompt`
   * - Language model output streamed through `session/update` notifications
   * - Progress updates and results from tool calls
   *
   * This structure is compatible with the Model Context Protocol (MCP), enabling
   * agents to seamlessly forward content from MCP tool outputs without transformation.
   *
   * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
   */
  export type ContentBlock =
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        text: string;
        type: "text";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        uri?: string | null;
        type: "image";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        data: string;
        mimeType: string;
        type: "audio";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        description?: string | null;
        mimeType?: string | null;
        name: string;
        size?: number | null;
        title?: string | null;
        uri: string;
        type: "resource_link";
        [k: string]: unknown;
      }
    | {
        /**
         * The _meta property is reserved by ACP to allow clients and agents to attach additional
         * metadata to their interactions. Implementations MUST NOT make assumptions about values at
         * these keys.
         *
         * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
         */
        _meta?: {
          [k: string]: unknown;
        } | null;
        annotations?: Annotations | null;
        resource: EmbeddedResourceResource;
        type: "resource";
        [k: string]: unknown;
      };
  /**
   * The sender or recipient of messages and data in a conversation.
   */
  export type Role = "assistant" | "user";
  /**
   * Resource content that can be embedded in a message.
   */
  export type EmbeddedResourceResource =
    | TextResourceContents
    | BlobResourceContents;
  /**
   * Status for prompt-turn transcript items.
   */
  export type TranscriptItemStatus =
    | "complete"
    | "streaming"
    | "cancelled"
    | "failed";

  /**
   * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
   */
  export interface Annotations {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    audience?: Role[] | null;
    lastModified?: string | null;
    priority?: number | null;
    [k: string]: unknown;
  }
  /**
   * Text-based resource contents.
   */
  export interface TextResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    mimeType?: string | null;
    text: string;
    uri: string;
    [k: string]: unknown;
  }
  /**
   * Binary resource contents.
   */
  export interface BlobResourceContents {
    /**
     * The _meta property is reserved by ACP to allow clients and agents to attach additional
     * metadata to their interactions. Implementations MUST NOT make assumptions about values at
     * these keys.
     *
     * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
     */
    _meta?: {
      [k: string]: unknown;
    } | null;
    blob: string;
    mimeType?: string | null;
    uri: string;
    [k: string]: unknown;
  }
}

export type TranscriptItem = TranscriptItemTypes.TranscriptItem;

export namespace TranscriptUpdateSnapshotTypes {
  /**
   * One replayed `session/update` captured during `session/load`.
   */
  export interface TranscriptUpdateSnapshot {
    /**
     * Zero-based replay order within the loaded transcript.
     */
    index: number;
    /**
     * The structurally serialized official ACP update payload.
     */
    update: {
      [k: string]: unknown;
    };
    /**
     * Official ACP `SessionUpdate` discriminator value when known.
     */
    variant: string;
    [k: string]: unknown;
  }
}

export type TranscriptUpdateSnapshot =
  TranscriptUpdateSnapshotTypes.TranscriptUpdateSnapshot;

export const CONTRACT_BUNDLE_VERSION = 1 as const;
export const PROVIDERS = [
  "claude",
  "copilot",
  "codex",
] as const satisfies readonly ProviderId[];

export const CONSUMER_COMMANDS = [
  "initialize",
  "session/new",
  "session/set_config_option",
  "session/prompt",
  "session/cancel",
  "provider/disconnect",
  "projects/add",
  "projects/list",
  "projects/remove",
  "projects/suggestions",
  "projects/update",
  "settings/get",
  "settings/update",
  "sessions/grouped",
  "sessions/watch",
  "providers/config_snapshot",
  "session/open",
  "session/history",
  "session/watch",
] as const;

const contractSchemas = {
  ClientCommandFrame: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ClientCommandFrameType: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "command",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ConsumerCommand: {
        anyOf: [
          {
            $ref: "#/$defs/InitializeConsumerCommand",
            description: "ACP provider initialization.",
          },
          {
            $ref: "#/$defs/SessionNewConsumerCommand",
            description: "ACP session creation.",
          },
          {
            $ref: "#/$defs/SessionSetConfigOptionConsumerCommand",
            description: "ACP session config mutation.",
          },
          {
            $ref: "#/$defs/SessionPromptConsumerCommand",
            description: "ACP prompt submission.",
          },
          {
            $ref: "#/$defs/SessionCancelConsumerCommand",
            description: "ACP session cancellation.",
          },
          {
            $ref: "#/$defs/ProviderDisconnectConsumerCommand",
            description: "Provider disconnect.",
          },
          {
            $ref: "#/$defs/ProjectsAddConsumerCommand",
            description: "Project addition.",
          },
          {
            $ref: "#/$defs/ProjectsListConsumerCommand",
            description: "Project list.",
          },
          {
            $ref: "#/$defs/ProjectsRemoveConsumerCommand",
            description: "Project removal.",
          },
          {
            $ref: "#/$defs/ProjectsSuggestionsConsumerCommand",
            description: "Project suggestions.",
          },
          {
            $ref: "#/$defs/ProjectsUpdateConsumerCommand",
            description: "Project update.",
          },
          {
            $ref: "#/$defs/SettingsGetConsumerCommand",
            description: "Settings read.",
          },
          {
            $ref: "#/$defs/SettingsUpdateConsumerCommand",
            description: "Settings update.",
          },
          {
            $ref: "#/$defs/SessionsGroupedConsumerCommand",
            description: "Session groups read.",
          },
          {
            $ref: "#/$defs/SessionsWatchConsumerCommand",
            description: "Session-index watch.",
          },
          {
            $ref: "#/$defs/ProvidersConfigSnapshotConsumerCommand",
            description: "Provider config snapshot read.",
          },
          {
            $ref: "#/$defs/SessionOpenConsumerCommand",
            description: "Session open.",
          },
          {
            $ref: "#/$defs/SessionHistoryConsumerCommand",
            description: "Session history read.",
          },
          {
            $ref: "#/$defs/SessionWatchConsumerCommand",
            description: "Session timeline watch.",
          },
        ],
        description:
          "One stable wire command envelope accepted by the product transport.",
      },
      ConsumerCommandTarget: {
        anyOf: [
          {
            $ref: "#/$defs/ProviderId",
            description: "One specific provider.",
          },
          {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "The aggregate runtime target.",
          },
        ],
        description: "One provider target accepted by consumer commands.",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      EmptyParams: {
        additionalProperties: false,
        description:
          "Empty object params for commands without a request payload.",
        type: "object",
      },
      GlobalProviderTarget: {
        description:
          "Global provider target for commands that must fan out through Conduit.",
        oneOf: [
          {
            const: "all",
            description: "Targets the aggregate Conduit runtime.",
            type: "string",
          },
        ],
      },
      GlobalSettingsUpdateRequest: {
        additionalProperties: false,
        description: "Request payload for `settings/update`.",
        properties: {
          sessionGroupsUpdatedWithinDays: {
            description: "Default lookback window for `sessions/grouped`.",
            format: "uint64",
            maximum: 365,
            minimum: 1,
            type: ["integer", "null"],
          },
        },
        type: "object",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      InitializeCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "initialize",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      InitializeConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `initialize`.",
        properties: {
          command: {
            $ref: "#/$defs/InitializeCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectAddRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/add`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd to add as a project.",
            type: "string",
          },
        },
        required: ["cwd"],
        type: "object",
      },
      ProjectRemoveRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/remove`.",
        properties: {
          projectId: {
            description: "Stable project identity to remove.",
            type: "string",
          },
        },
        required: ["projectId"],
        type: "object",
      },
      ProjectSuggestionsQuery: {
        additionalProperties: false,
        description: "Query payload for `projects/suggestions`.",
        properties: {
          limit: {
            description: "Optional result limit.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          query: {
            description: "Optional substring filter.",
            type: ["string", "null"],
          },
        },
        type: "object",
      },
      ProjectUpdateRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/update`.",
        properties: {
          displayName: {
            description: "New display label for the project.",
            type: "string",
          },
          projectId: {
            description: "Stable project identity to update.",
            type: "string",
          },
        },
        required: ["projectId", "displayName"],
        type: "object",
      },
      ProjectsAddCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/add",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsAddConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/add`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsAddCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectAddRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsListCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/list",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsListConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/list`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsListCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsRemoveCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/remove",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsRemoveConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/remove`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsRemoveCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectRemoveRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsSuggestionsCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/suggestions",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsSuggestionsConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/suggestions`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsSuggestionsCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectSuggestionsQuery",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsUpdateCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/update",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsUpdateConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/update`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsUpdateCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectUpdateRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProviderDisconnectCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "provider/disconnect",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProviderDisconnectConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `provider/disconnect`.",
        properties: {
          command: {
            $ref: "#/$defs/ProviderDisconnectCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      ProvidersConfigSnapshotCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "providers/config_snapshot",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProvidersConfigSnapshotConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `providers/config_snapshot`.",
        properties: {
          command: {
            $ref: "#/$defs/ProvidersConfigSnapshotCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      SessionCancelCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/cancel",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionCancelConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/cancel`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionCancelCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionCancelRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionCancelRequest: {
        additionalProperties: false,
        description: "Request payload for `session/cancel`.",
        properties: {
          session_id: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
        },
        required: ["session_id"],
        type: "object",
      },
      SessionGroupsQuery: {
        additionalProperties: false,
        description: "Query parameters for `sessions/grouped`.",
        properties: {
          updatedWithinDays: {
            description: "Optional lookback window in days.",
            format: "uint64",
            maximum: 365,
            minimum: 1,
            type: ["integer", "null"],
          },
        },
        type: "object",
      },
      SessionHistoryCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/history",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionHistoryConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/history`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionHistoryCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionHistoryRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionHistoryRequest: {
        additionalProperties: false,
        description: "Request payload for `session/history`.",
        properties: {
          cursor: {
            description: "Optional older-page cursor.",
            type: ["string", "null"],
          },
          limit: {
            description: "Optional history window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
        },
        required: ["openSessionId"],
        type: "object",
      },
      SessionNewCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/new",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionNewConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/new`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionNewCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionNewRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionNewRequest: {
        additionalProperties: false,
        description: "Request payload for `session/new`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd for the new session.",
            type: "string",
          },
          limit: {
            description: "Optional initial transcript window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
        },
        required: ["cwd"],
        type: "object",
      },
      SessionOpenCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/open",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionOpenConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/open`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionOpenCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionOpenRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionOpenRequest: {
        additionalProperties: false,
        description: "Request payload for `session/open`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd identity for the session.",
            type: "string",
          },
          limit: {
            description: "Optional transcript window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          sessionId: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
        },
        required: ["sessionId", "cwd"],
        type: "object",
      },
      SessionPromptCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/prompt",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionPromptConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/prompt`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionPromptCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionPromptRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionPromptRequest: {
        additionalProperties: false,
        description: "Request payload for `session/prompt`.",
        properties: {
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
          prompt: {
            description: "ACP content blocks for the prompt.",
            items: {
              $ref: "#/$defs/ContentBlock",
            },
            type: "array",
          },
        },
        required: ["openSessionId", "prompt"],
        type: "object",
      },
      SessionSetConfigOptionCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/set_config_option",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionSetConfigOptionConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/set_config_option`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionSetConfigOptionCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionSetConfigOptionRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionSetConfigOptionRequest: {
        additionalProperties: false,
        description: "Request payload for `session/set_config_option`.",
        properties: {
          configId: {
            description: "ACP config option identifier.",
            type: "string",
          },
          sessionId: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
          value: {
            description: "Selected config value identifier.",
            type: "string",
          },
        },
        required: ["sessionId", "configId", "value"],
        type: "object",
      },
      SessionWatchCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/watch",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionWatchConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/watch`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionWatchCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionWatchRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionWatchRequest: {
        additionalProperties: false,
        description: "Request payload for `session/watch`.",
        properties: {
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
        },
        required: ["openSessionId"],
        type: "object",
      },
      SessionsGroupedCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "sessions/grouped",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionsGroupedConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `sessions/grouped`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionsGroupedCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionGroupsQuery",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ConsumerCommandTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionsWatchCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "sessions/watch",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionsWatchConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `sessions/watch`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionsWatchCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SettingsGetCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "settings/get",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SettingsGetConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `settings/get`.",
        properties: {
          command: {
            $ref: "#/$defs/SettingsGetCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SettingsUpdateCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "settings/update",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SettingsUpdateConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `settings/update`.",
        properties: {
          command: {
            $ref: "#/$defs/SettingsUpdateCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/GlobalSettingsUpdateRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Versioned WebSocket frame carrying a client command.",
    properties: {
      command: {
        $ref: "#/$defs/ConsumerCommand",
        description: "Consumer command payload.",
      },
      id: {
        description: "Correlation id echoed in responses.",
        minLength: 1,
        type: "string",
      },
      type: {
        $ref: "#/$defs/ClientCommandFrameType",
        description: "Stable frame discriminator.",
      },
      v: {
        description: "Transport protocol version.",
        format: "uint8",
        maximum: 1,
        minimum: 1,
        type: "integer",
      },
    },
    required: ["v", "type", "id", "command"],
    title: "ClientCommandFrame",
    type: "object",
  },
  ConnectionState: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "The current host connection state.",
    oneOf: [
      {
        const: "disconnected",
        description: "The provider process has not been started.",
        type: "string",
      },
      {
        const: "ready",
        description: "The provider process is live and initialized.",
        type: "string",
      },
    ],
    title: "ConnectionState",
  },
  ConsumerCommand: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ConsumerCommandTarget: {
        anyOf: [
          {
            $ref: "#/$defs/ProviderId",
            description: "One specific provider.",
          },
          {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "The aggregate runtime target.",
          },
        ],
        description: "One provider target accepted by consumer commands.",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      EmptyParams: {
        additionalProperties: false,
        description:
          "Empty object params for commands without a request payload.",
        type: "object",
      },
      GlobalProviderTarget: {
        description:
          "Global provider target for commands that must fan out through Conduit.",
        oneOf: [
          {
            const: "all",
            description: "Targets the aggregate Conduit runtime.",
            type: "string",
          },
        ],
      },
      GlobalSettingsUpdateRequest: {
        additionalProperties: false,
        description: "Request payload for `settings/update`.",
        properties: {
          sessionGroupsUpdatedWithinDays: {
            description: "Default lookback window for `sessions/grouped`.",
            format: "uint64",
            maximum: 365,
            minimum: 1,
            type: ["integer", "null"],
          },
        },
        type: "object",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      InitializeCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "initialize",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      InitializeConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `initialize`.",
        properties: {
          command: {
            $ref: "#/$defs/InitializeCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectAddRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/add`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd to add as a project.",
            type: "string",
          },
        },
        required: ["cwd"],
        type: "object",
      },
      ProjectRemoveRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/remove`.",
        properties: {
          projectId: {
            description: "Stable project identity to remove.",
            type: "string",
          },
        },
        required: ["projectId"],
        type: "object",
      },
      ProjectSuggestionsQuery: {
        additionalProperties: false,
        description: "Query payload for `projects/suggestions`.",
        properties: {
          limit: {
            description: "Optional result limit.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          query: {
            description: "Optional substring filter.",
            type: ["string", "null"],
          },
        },
        type: "object",
      },
      ProjectUpdateRequest: {
        additionalProperties: false,
        description: "Request payload for `projects/update`.",
        properties: {
          displayName: {
            description: "New display label for the project.",
            type: "string",
          },
          projectId: {
            description: "Stable project identity to update.",
            type: "string",
          },
        },
        required: ["projectId", "displayName"],
        type: "object",
      },
      ProjectsAddCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/add",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsAddConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/add`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsAddCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectAddRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsListCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/list",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsListConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/list`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsListCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsRemoveCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/remove",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsRemoveConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/remove`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsRemoveCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectRemoveRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsSuggestionsCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/suggestions",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsSuggestionsConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/suggestions`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsSuggestionsCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectSuggestionsQuery",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProjectsUpdateCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "projects/update",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProjectsUpdateConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `projects/update`.",
        properties: {
          command: {
            $ref: "#/$defs/ProjectsUpdateCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/ProjectUpdateRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProviderDisconnectCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "provider/disconnect",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProviderDisconnectConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `provider/disconnect`.",
        properties: {
          command: {
            $ref: "#/$defs/ProviderDisconnectCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      ProvidersConfigSnapshotCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "providers/config_snapshot",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      ProvidersConfigSnapshotConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `providers/config_snapshot`.",
        properties: {
          command: {
            $ref: "#/$defs/ProvidersConfigSnapshotCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      SessionCancelCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/cancel",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionCancelConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/cancel`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionCancelCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionCancelRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionCancelRequest: {
        additionalProperties: false,
        description: "Request payload for `session/cancel`.",
        properties: {
          session_id: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
        },
        required: ["session_id"],
        type: "object",
      },
      SessionGroupsQuery: {
        additionalProperties: false,
        description: "Query parameters for `sessions/grouped`.",
        properties: {
          updatedWithinDays: {
            description: "Optional lookback window in days.",
            format: "uint64",
            maximum: 365,
            minimum: 1,
            type: ["integer", "null"],
          },
        },
        type: "object",
      },
      SessionHistoryCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/history",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionHistoryConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/history`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionHistoryCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionHistoryRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionHistoryRequest: {
        additionalProperties: false,
        description: "Request payload for `session/history`.",
        properties: {
          cursor: {
            description: "Optional older-page cursor.",
            type: ["string", "null"],
          },
          limit: {
            description: "Optional history window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
        },
        required: ["openSessionId"],
        type: "object",
      },
      SessionNewCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/new",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionNewConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/new`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionNewCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionNewRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionNewRequest: {
        additionalProperties: false,
        description: "Request payload for `session/new`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd for the new session.",
            type: "string",
          },
          limit: {
            description: "Optional initial transcript window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
        },
        required: ["cwd"],
        type: "object",
      },
      SessionOpenCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/open",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionOpenConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/open`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionOpenCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionOpenRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionOpenRequest: {
        additionalProperties: false,
        description: "Request payload for `session/open`.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd identity for the session.",
            type: "string",
          },
          limit: {
            description: "Optional transcript window size.",
            format: "uint64",
            minimum: 0,
            type: ["integer", "null"],
          },
          sessionId: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
        },
        required: ["sessionId", "cwd"],
        type: "object",
      },
      SessionPromptCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/prompt",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionPromptConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/prompt`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionPromptCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionPromptRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionPromptRequest: {
        additionalProperties: false,
        description: "Request payload for `session/prompt`.",
        properties: {
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
          prompt: {
            description: "ACP content blocks for the prompt.",
            items: {
              $ref: "#/$defs/ContentBlock",
            },
            type: "array",
          },
        },
        required: ["openSessionId", "prompt"],
        type: "object",
      },
      SessionSetConfigOptionCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/set_config_option",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionSetConfigOptionConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/set_config_option`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionSetConfigOptionCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionSetConfigOptionRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionSetConfigOptionRequest: {
        additionalProperties: false,
        description: "Request payload for `session/set_config_option`.",
        properties: {
          configId: {
            description: "ACP config option identifier.",
            type: "string",
          },
          sessionId: {
            description: "Provider ACP session identifier.",
            type: "string",
          },
          value: {
            description: "Selected config value identifier.",
            type: "string",
          },
        },
        required: ["sessionId", "configId", "value"],
        type: "object",
      },
      SessionWatchCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "session/watch",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionWatchConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `session/watch`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionWatchCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionWatchRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionWatchRequest: {
        additionalProperties: false,
        description: "Request payload for `session/watch`.",
        properties: {
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
        },
        required: ["openSessionId"],
        type: "object",
      },
      SessionsGroupedCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "sessions/grouped",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionsGroupedConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `sessions/grouped`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionsGroupedCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/SessionGroupsQuery",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/ConsumerCommandTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SessionsWatchCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "sessions/watch",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionsWatchConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `sessions/watch`.",
        properties: {
          command: {
            $ref: "#/$defs/SessionsWatchCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SettingsGetCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "settings/get",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SettingsGetConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `settings/get`.",
        properties: {
          command: {
            $ref: "#/$defs/SettingsGetCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/EmptyParams",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      SettingsUpdateCommandLiteral: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "settings/update",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SettingsUpdateConsumerCommand: {
        additionalProperties: false,
        description: "Wire command envelope for `settings/update`.",
        properties: {
          command: {
            $ref: "#/$defs/SettingsUpdateCommandLiteral",
            description: "Stable command discriminator.",
          },
          id: {
            description: "Caller-owned request id echoed in the response.",
            minLength: 1,
            type: "string",
          },
          params: {
            $ref: "#/$defs/GlobalSettingsUpdateRequest",
            description: "Command params.",
          },
          provider: {
            $ref: "#/$defs/GlobalProviderTarget",
            description: "Command target.",
          },
        },
        required: ["id", "command", "provider", "params"],
        type: "object",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    anyOf: [
      {
        $ref: "#/$defs/InitializeConsumerCommand",
        description: "ACP provider initialization.",
      },
      {
        $ref: "#/$defs/SessionNewConsumerCommand",
        description: "ACP session creation.",
      },
      {
        $ref: "#/$defs/SessionSetConfigOptionConsumerCommand",
        description: "ACP session config mutation.",
      },
      {
        $ref: "#/$defs/SessionPromptConsumerCommand",
        description: "ACP prompt submission.",
      },
      {
        $ref: "#/$defs/SessionCancelConsumerCommand",
        description: "ACP session cancellation.",
      },
      {
        $ref: "#/$defs/ProviderDisconnectConsumerCommand",
        description: "Provider disconnect.",
      },
      {
        $ref: "#/$defs/ProjectsAddConsumerCommand",
        description: "Project addition.",
      },
      {
        $ref: "#/$defs/ProjectsListConsumerCommand",
        description: "Project list.",
      },
      {
        $ref: "#/$defs/ProjectsRemoveConsumerCommand",
        description: "Project removal.",
      },
      {
        $ref: "#/$defs/ProjectsSuggestionsConsumerCommand",
        description: "Project suggestions.",
      },
      {
        $ref: "#/$defs/ProjectsUpdateConsumerCommand",
        description: "Project update.",
      },
      {
        $ref: "#/$defs/SettingsGetConsumerCommand",
        description: "Settings read.",
      },
      {
        $ref: "#/$defs/SettingsUpdateConsumerCommand",
        description: "Settings update.",
      },
      {
        $ref: "#/$defs/SessionsGroupedConsumerCommand",
        description: "Session groups read.",
      },
      {
        $ref: "#/$defs/SessionsWatchConsumerCommand",
        description: "Session-index watch.",
      },
      {
        $ref: "#/$defs/ProvidersConfigSnapshotConsumerCommand",
        description: "Provider config snapshot read.",
      },
      {
        $ref: "#/$defs/SessionOpenConsumerCommand",
        description: "Session open.",
      },
      {
        $ref: "#/$defs/SessionHistoryConsumerCommand",
        description: "Session history read.",
      },
      {
        $ref: "#/$defs/SessionWatchConsumerCommand",
        description: "Session timeline watch.",
      },
    ],
    description:
      "One stable wire command envelope accepted by the product transport.",
    title: "ConsumerCommand",
  },
  ConsumerCommandName: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "Stable set of supported consumer command names.",
    oneOf: [
      {
        const: "initialize",
        description: "ACP provider initialization.",
        type: "string",
      },
      {
        const: "session/new",
        description: "ACP session creation.",
        type: "string",
      },
      {
        const: "session/set_config_option",
        description: "ACP session config mutation.",
        type: "string",
      },
      {
        const: "session/prompt",
        description: "ACP prompt submission for an open session.",
        type: "string",
      },
      {
        const: "session/cancel",
        description: "ACP session cancellation.",
        type: "string",
      },
      {
        const: "provider/disconnect",
        description: "Disconnects one provider session runtime.",
        type: "string",
      },
      {
        const: "projects/add",
        description: "Adds one persisted project.",
        type: "string",
      },
      {
        const: "projects/list",
        description: "Lists persisted projects.",
        type: "string",
      },
      {
        const: "projects/remove",
        description: "Removes one persisted project.",
        type: "string",
      },
      {
        const: "projects/suggestions",
        description: "Suggests projects from the local environment.",
        type: "string",
      },
      {
        const: "projects/update",
        description: "Updates one persisted project.",
        type: "string",
      },
      {
        const: "settings/get",
        description: "Reads global settings.",
        type: "string",
      },
      {
        const: "settings/update",
        description: "Updates global settings.",
        type: "string",
      },
      {
        const: "sessions/grouped",
        description: "Reads grouped sessions.",
        type: "string",
      },
      {
        const: "sessions/watch",
        description: "Subscribes to session-index changes.",
        type: "string",
      },
      {
        const: "providers/config_snapshot",
        description: "Reads provider config snapshots.",
        type: "string",
      },
      {
        const: "session/open",
        description: "Opens one known provider session.",
        type: "string",
      },
      {
        const: "session/history",
        description: "Reads one session history window.",
        type: "string",
      },
      {
        const: "session/watch",
        description: "Subscribes to one open-session timeline.",
        type: "string",
      },
    ],
    title: "ConsumerCommandName",
  },
  ConsumerCommandTarget: {
    $defs: {
      GlobalProviderTarget: {
        description:
          "Global provider target for commands that must fan out through Conduit.",
        oneOf: [
          {
            const: "all",
            description: "Targets the aggregate Conduit runtime.",
            type: "string",
          },
        ],
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    anyOf: [
      {
        $ref: "#/$defs/ProviderId",
        description: "One specific provider.",
      },
      {
        $ref: "#/$defs/GlobalProviderTarget",
        description: "The aggregate runtime target.",
      },
    ],
    description: "One provider target accepted by consumer commands.",
    title: "ConsumerCommandTarget",
  },
  ConsumerError: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Stable consumer error envelope.",
    properties: {
      code: {
        description: "Stable machine-readable error code.",
        type: "string",
      },
      message: {
        description: "Human-readable error details.",
        type: "string",
      },
    },
    required: ["code", "message"],
    title: "ConsumerError",
    type: "object",
  },
  ConsumerResponse: {
    $defs: {
      AgentCapabilities: {
        description:
          "Capabilities supported by the agent.\n\nAdvertised during initialization to inform the client about\navailable features and content types.\n\nSee protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          loadSession: {
            default: false,
            description: "Whether the agent supports `session/load`.",
            type: "boolean",
          },
          mcpCapabilities: {
            $ref: "#/$defs/McpCapabilities",
            default: {
              http: false,
              sse: false,
            },
            description: "MCP capabilities supported by the agent.",
          },
          promptCapabilities: {
            $ref: "#/$defs/PromptCapabilities",
            default: {
              audio: false,
              embeddedContext: false,
              image: false,
            },
            description: "Prompt capabilities supported by the agent.",
          },
          sessionCapabilities: {
            $ref: "#/$defs/SessionCapabilities",
            default: {},
          },
        },
        type: "object",
      },
      AuthMethod: {
        anyOf: [
          {
            $ref: "#/$defs/AuthMethodAgent",
            description:
              "Agent handles authentication itself.\n\nThis is the default when no `type` is specified.",
          },
        ],
        description:
          "Describes an available authentication method.\n\nThe `type` field acts as the discriminator in the serialized JSON form.\nWhen no `type` is present, the method is treated as `agent`.",
      },
      AuthMethodAgent: {
        description:
          "Agent handles authentication itself.\n\nThis is the default authentication method type.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description:
              "Optional description providing more details about this authentication method.",
            type: ["string", "null"],
          },
          id: {
            description: "Unique identifier for this authentication method.",
            type: "string",
          },
          name: {
            description: "Human-readable name of the authentication method.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      ConnectionState: {
        description: "The current host connection state.",
        oneOf: [
          {
            const: "disconnected",
            description: "The provider process has not been started.",
            type: "string",
          },
          {
            const: "ready",
            description: "The provider process is live and initialized.",
            type: "string",
          },
        ],
      },
      ConsumerError: {
        additionalProperties: false,
        description: "Stable consumer error envelope.",
        properties: {
          code: {
            description: "Stable machine-readable error code.",
            type: "string",
          },
          message: {
            description: "Human-readable error details.",
            type: "string",
          },
        },
        required: ["code", "message"],
        type: "object",
      },
      Implementation: {
        description:
          "Metadata about the implementation of the client or agent.\nDescribes the name and version of an MCP implementation, with an optional\ntitle for UI representation.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          name: {
            description:
              "Intended for programmatic or logical use, but can be used as a display\nname fallback if title isn’t present.",
            type: "string",
          },
          title: {
            description:
              "Intended for UI and end-user contexts — optimized to be human-readable\nand easily understood.\n\nIf not provided, the name should be used for display.",
            type: ["string", "null"],
          },
          version: {
            description:
              'Version of the implementation. Can be displayed to the user or used\nfor debugging or metrics purposes. (e.g. "1.0.0").',
            type: "string",
          },
        },
        required: ["name", "version"],
        type: "object",
      },
      InitializeProbe: {
        description: "The initialize probe result returned by discovery.",
        properties: {
          elapsed_ms: {
            description:
              "The measured initialize response time in milliseconds.",
            format: "uint64",
            minimum: 0,
            type: "integer",
          },
          payload: {
            $ref: "#/$defs/InitializeResponse",
            description: "The typed initialize response payload.",
          },
          response: {
            description: "The raw initialize response envelope.",
          },
          stderr_lines: {
            description: "The raw stderr lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
          stdout_lines: {
            description: "The raw stdout lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        required: [
          "response",
          "payload",
          "stdout_lines",
          "stderr_lines",
          "elapsed_ms",
        ],
        type: "object",
      },
      InitializeResponse: {
        description:
          "Response to the `initialize` method.\n\nContains the negotiated protocol version and agent capabilities.\n\nSee protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          agentCapabilities: {
            $ref: "#/$defs/AgentCapabilities",
            default: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            description: "Capabilities supported by the agent.",
          },
          agentInfo: {
            anyOf: [
              {
                $ref: "#/$defs/Implementation",
              },
              {
                type: "null",
              },
            ],
            description:
              "Information about the Agent name and version sent to the Client.\n\nNote: in future versions of the protocol, this will be required.",
          },
          authMethods: {
            default: [],
            description: "Authentication methods supported by the agent.",
            items: {
              $ref: "#/$defs/AuthMethod",
            },
            type: "array",
          },
          protocolVersion: {
            $ref: "#/$defs/ProtocolVersion",
            description:
              "The protocol version the client specified if supported by the agent,\nor the latest protocol version supported by the agent.\n\nThe client should disconnect, if it doesn't support this version.",
          },
        },
        required: ["protocolVersion"],
        type: "object",
        "x-method": "initialize",
        "x-side": "agent",
      },
      LauncherCommand: {
        description:
          "The exact launcher command Conduit is allowed to run for a provider.",
        properties: {
          args: {
            description:
              "The actual argv that Conduit will pass after the executable.",
            items: {
              type: "string",
            },
            type: "array",
          },
          display: {
            description: "The human-readable command string fixed by policy.",
            type: "string",
          },
          executable: {
            description: "The resolved executable path after discovery.",
            type: "string",
          },
        },
        required: ["executable", "args", "display"],
        type: "object",
      },
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      LiveSessionSnapshot: {
        description:
          "A normalized live session snapshot anchored to ACP truth.",
        properties: {
          cwd: {
            description:
              "The provider-reported or Conduit-observed working directory.",
            type: "string",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The exact live identity.",
          },
          observed_via: {
            description:
              "Whether the session was observed via `new`, `list`, or `load`.",
            type: "string",
          },
          title: {
            description: "The provider-reported title when available.",
            type: ["string", "null"],
          },
        },
        required: ["identity", "cwd", "observed_via"],
        type: "object",
      },
      LoadedTranscriptSnapshot: {
        description:
          "Read-side transcript replay captured while loading a session.",
        properties: {
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The loaded session identity.",
          },
          raw_update_count: {
            description:
              "The number of official SDK notifications observed during load.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          updates: {
            default: [],
            description: "Replayed updates in provider emission order.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "raw_update_count"],
        type: "object",
      },
      McpCapabilities: {
        description: "MCP capabilities supported by the agent",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          http: {
            default: false,
            description: "Agent supports [`McpServer::Http`].",
            type: "boolean",
          },
          sse: {
            default: false,
            description: "Agent supports [`McpServer::Sse`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptCapabilities: {
        description:
          "Prompt capabilities supported by the agent in `session/prompt` requests.\n\nBaseline agent functionality requires support for [`ContentBlock::Text`]\nand [`ContentBlock::ResourceLink`] in prompt requests.\n\nOther variants must be explicitly opted in to.\nCapabilities for different types of content in prompt requests.\n\nIndicates which content types beyond the baseline (text and resource links)\nthe agent can process.\n\nSee protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audio: {
            default: false,
            description: "Agent supports [`ContentBlock::Audio`].",
            type: "boolean",
          },
          embeddedContext: {
            default: false,
            description:
              "Agent supports embedded context in `session/prompt` requests.\n\nWhen enabled, the Client is allowed to include [`ContentBlock::Resource`]\nin prompt requests for pieces of context that are referenced in the message.",
            type: "boolean",
          },
          image: {
            default: false,
            description: "Agent supports [`ContentBlock::Image`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptLifecycleSnapshot: {
        description:
          "A normalized prompt lifecycle snapshot backed by raw ACP updates.",
        properties: {
          agent_text_chunks: {
            default: [],
            description:
              "Agent-authored text chunks observed through official SDK notifications.",
            items: {
              type: "string",
            },
            type: "array",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The session the prompt belongs to.",
          },
          raw_update_count: {
            description:
              "The number of raw session/update notifications observed during the turn.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          state: {
            $ref: "#/$defs/PromptLifecycleState",
            description: "The current lifecycle state.",
          },
          stop_reason: {
            description: "The ACP stop reason when available.",
            type: ["string", "null"],
          },
          updates: {
            default: [],
            description:
              "Ordered raw ACP `session/update` notifications observed during the turn.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "state", "raw_update_count"],
        type: "object",
      },
      PromptLifecycleState: {
        description:
          "The normalized prompt lifecycle state for a single session turn.",
        oneOf: [
          {
            const: "idle",
            description: "No active prompt turn is being tracked.",
            type: "string",
          },
          {
            const: "running",
            description: "A prompt request is in flight.",
            type: "string",
          },
          {
            const: "completed",
            description: "The prompt returned successfully.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The prompt completed after a cancel notification.",
            type: "string",
          },
        ],
      },
      ProtocolVersion: {
        description:
          "Protocol version identifier.\n\nThis version is only bumped for breaking changes.\nNon-breaking changes should be introduced via capabilities.",
        format: "uint16",
        maximum: 65535,
        minimum: 0,
        type: "integer",
      },
      ProviderDiscovery: {
        description: "The discovery output for a provider.",
        properties: {
          auth_hints: {
            description: "Human-readable auth hints surfaced by the adapter.",
            items: {
              type: "string",
            },
            type: "array",
          },
          initialize_probe: {
            $ref: "#/$defs/InitializeProbe",
            description: "The raw initialize result when probing succeeded.",
          },
          initialize_viable: {
            description: "Whether `initialize` completed successfully.",
            type: "boolean",
          },
          launcher: {
            $ref: "#/$defs/LauncherCommand",
            description: "The launcher command locked by policy.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
          resolved_path: {
            description: "The resolved binary path.",
            type: "string",
          },
          transport_diagnostics: {
            description: "Diagnostics gathered during probing.",
            items: {
              type: "string",
            },
            type: "array",
          },
          version: {
            description: "The version reported by the adapter.",
            type: "string",
          },
        },
        required: [
          "provider",
          "launcher",
          "resolved_path",
          "version",
          "auth_hints",
          "initialize_viable",
          "transport_diagnostics",
          "initialize_probe",
        ],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      ProviderSnapshot: {
        description:
          "The current provider snapshot exposed to apps and proof tooling.",
        properties: {
          auth_methods: {
            description:
              "The provider-reported auth methods from the live initialize result.",
            items: true,
            type: "array",
          },
          capabilities: {
            description:
              "The provider-reported capabilities from the live initialize result.",
          },
          connection_state: {
            $ref: "#/$defs/ConnectionState",
            description: "The current connection state.",
          },
          discovery: {
            $ref: "#/$defs/ProviderDiscovery",
            description:
              "The locked launcher truth and initialize probe provenance.",
          },
          last_prompt: {
            anyOf: [
              {
                $ref: "#/$defs/PromptLifecycleSnapshot",
              },
              {
                type: "null",
              },
            ],
            description: "The last observed prompt lifecycle, if any.",
          },
          live_sessions: {
            description: "The live sessions currently tracked in memory.",
            items: {
              $ref: "#/$defs/LiveSessionSnapshot",
            },
            type: "array",
          },
          loaded_transcripts: {
            default: [],
            description: "Transcript replays captured during `session/load`.",
            items: {
              $ref: "#/$defs/LoadedTranscriptSnapshot",
            },
            type: "array",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
        },
        required: [
          "provider",
          "connection_state",
          "discovery",
          "capabilities",
          "auth_methods",
          "live_sessions",
        ],
        type: "object",
      },
      SessionCapabilities: {
        description:
          "Session capabilities supported by the agent.\n\nAs a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.\n\nOptionally, they **MAY** support other session methods and notifications by specifying additional capabilities.\n\nNote: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.\n\nSee protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          list: {
            anyOf: [
              {
                $ref: "#/$defs/SessionListCapabilities",
              },
              {
                type: "null",
              },
            ],
            description: "Whether the agent supports `session/list`.",
          },
        },
        type: "object",
      },
      SessionListCapabilities: {
        description:
          "Capabilities for the `session/list` method.\n\nBy supplying `{}` it means that the agent supports listing of sessions.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
        },
        type: "object",
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "One stable consumer response envelope.",
    properties: {
      error: {
        anyOf: [
          {
            $ref: "#/$defs/ConsumerError",
          },
          {
            type: "null",
          },
        ],
        description: "Stable error payload when `ok` is false.",
      },
      id: {
        description: "Caller-owned request id echoed from the command.",
        minLength: 1,
        type: "string",
      },
      ok: {
        description: "Whether the command completed successfully.",
        type: "boolean",
      },
      result: {
        description: "ACP result payload or Conduit-owned command result.",
      },
      snapshot: {
        anyOf: [
          {
            $ref: "#/$defs/ProviderSnapshot",
          },
          {
            type: "null",
          },
        ],
        description:
          "Read-side snapshot after command handling when available.",
      },
    },
    required: ["id", "ok", "result"],
    title: "ConsumerResponse",
    type: "object",
  },
  ContentBlock: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
    discriminator: {
      propertyName: "type",
    },
    oneOf: [
      {
        $ref: "#/$defs/TextContent",
        description:
          "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
        properties: {
          type: {
            const: "text",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
      {
        $ref: "#/$defs/ImageContent",
        description:
          "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
        properties: {
          type: {
            const: "image",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
      {
        $ref: "#/$defs/AudioContent",
        description:
          "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
        properties: {
          type: {
            const: "audio",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
      {
        $ref: "#/$defs/ResourceLink",
        description:
          "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
        properties: {
          type: {
            const: "resource_link",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
      {
        $ref: "#/$defs/EmbeddedResource",
        description:
          "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
        properties: {
          type: {
            const: "resource",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
    ],
    title: "ContentBlock",
  },
  EmptyParams: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Empty object params for commands without a request payload.",
    title: "EmptyParams",
    type: "object",
  },
  GlobalProviderTarget: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "Global provider target for commands that must fan out through Conduit.",
    oneOf: [
      {
        const: "all",
        description: "Targets the aggregate Conduit runtime.",
        type: "string",
      },
    ],
    title: "GlobalProviderTarget",
  },
  GlobalSettingsUpdateRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `settings/update`.",
    properties: {
      sessionGroupsUpdatedWithinDays: {
        description: "Default lookback window for `sessions/grouped`.",
        format: "uint64",
        maximum: 365,
        minimum: 1,
        type: ["integer", "null"],
      },
    },
    title: "GlobalSettingsUpdateRequest",
    type: "object",
  },
  GlobalSettingsView: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "Persisted global settings for Conduit's session browser.",
    properties: {
      sessionGroupsUpdatedWithinDays: {
        description:
          "Default session lookback window in days for `sessions/grouped`.",
        format: "uint64",
        minimum: 0,
        type: ["integer", "null"],
      },
    },
    title: "GlobalSettings",
    type: "object",
  },
  LauncherCommand: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "The exact launcher command Conduit is allowed to run for a provider.",
    properties: {
      args: {
        description:
          "The actual argv that Conduit will pass after the executable.",
        items: {
          type: "string",
        },
        type: "array",
      },
      display: {
        description: "The human-readable command string fixed by policy.",
        type: "string",
      },
      executable: {
        description: "The resolved executable path after discovery.",
        type: "string",
      },
    },
    required: ["executable", "args", "display"],
    title: "LauncherCommand",
    type: "object",
  },
  LiveSessionIdentity: {
    $defs: {
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "The exact live session identity rule for Conduit.",
    properties: {
      acp_session_id: {
        description: "The ACP session id returned by the provider.",
        type: "string",
      },
      provider: {
        $ref: "#/$defs/ProviderId",
        description: "The provider owning this session.",
      },
    },
    required: ["provider", "acp_session_id"],
    title: "LiveSessionIdentity",
    type: "object",
  },
  LiveSessionSnapshot: {
    $defs: {
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "A normalized live session snapshot anchored to ACP truth.",
    properties: {
      cwd: {
        description:
          "The provider-reported or Conduit-observed working directory.",
        type: "string",
      },
      identity: {
        $ref: "#/$defs/LiveSessionIdentity",
        description: "The exact live identity.",
      },
      observed_via: {
        description:
          "Whether the session was observed via `new`, `list`, or `load`.",
        type: "string",
      },
      title: {
        description: "The provider-reported title when available.",
        type: ["string", "null"],
      },
    },
    required: ["identity", "cwd", "observed_via"],
    title: "LiveSessionSnapshot",
    type: "object",
  },
  LoadedTranscriptSnapshot: {
    $defs: {
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "Read-side transcript replay captured while loading a session.",
    properties: {
      identity: {
        $ref: "#/$defs/LiveSessionIdentity",
        description: "The loaded session identity.",
      },
      raw_update_count: {
        description:
          "The number of official SDK notifications observed during load.",
        format: "uint",
        minimum: 0,
        type: "integer",
      },
      updates: {
        default: [],
        description: "Replayed updates in provider emission order.",
        items: {
          $ref: "#/$defs/TranscriptUpdateSnapshot",
        },
        type: "array",
      },
    },
    required: ["identity", "raw_update_count"],
    title: "LoadedTranscriptSnapshot",
    type: "object",
  },
  ProjectAddRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `projects/add`.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd to add as a project.",
        type: "string",
      },
    },
    required: ["cwd"],
    title: "ProjectAddRequest",
    type: "object",
  },
  ProjectListView: {
    $defs: {
      ProjectRow: {
        description:
          "One persisted cwd selected for Conduit's session browser.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd represented by this project.",
            type: "string",
          },
          displayName: {
            description: "User-facing project label.",
            type: "string",
          },
          projectId: {
            description: "Stable render and mutation identity for the project.",
            type: "string",
          },
        },
        required: ["projectId", "cwd", "displayName"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Project list read model.",
    properties: {
      projects: {
        description: "Persisted projects in display order.",
        items: {
          $ref: "#/$defs/ProjectRow",
        },
        type: "array",
      },
    },
    required: ["projects"],
    title: "ProjectListView",
    type: "object",
  },
  ProjectRemoveRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `projects/remove`.",
    properties: {
      projectId: {
        description: "Stable project identity to remove.",
        type: "string",
      },
    },
    required: ["projectId"],
    title: "ProjectRemoveRequest",
    type: "object",
  },
  ProjectRow: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One persisted cwd selected for Conduit's session browser.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd represented by this project.",
        type: "string",
      },
      displayName: {
        description: "User-facing project label.",
        type: "string",
      },
      projectId: {
        description: "Stable render and mutation identity for the project.",
        type: "string",
      },
    },
    required: ["projectId", "cwd", "displayName"],
    title: "ProjectRow",
    type: "object",
  },
  ProjectSuggestion: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One addable cwd suggestion for the session browser.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd represented by this suggestion.",
        type: "string",
      },
      suggestionId: {
        description: "Stable render identity for the suggestion.",
        type: "string",
      },
    },
    required: ["suggestionId", "cwd"],
    title: "ProjectSuggestion",
    type: "object",
  },
  ProjectSuggestionsQuery: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Query payload for `projects/suggestions`.",
    properties: {
      limit: {
        description: "Optional result limit.",
        format: "uint64",
        minimum: 0,
        type: ["integer", "null"],
      },
      query: {
        description: "Optional substring filter.",
        type: ["string", "null"],
      },
    },
    title: "ProjectSuggestionsQuery",
    type: "object",
  },
  ProjectSuggestionsView: {
    $defs: {
      ProjectSuggestion: {
        description: "One addable cwd suggestion for the session browser.",
        properties: {
          cwd: {
            description:
              "Absolute normalized cwd represented by this suggestion.",
            type: "string",
          },
          suggestionId: {
            description: "Stable render identity for the suggestion.",
            type: "string",
          },
        },
        required: ["suggestionId", "cwd"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Project suggestions read model.",
    properties: {
      suggestions: {
        description: "Addable project suggestions.",
        items: {
          $ref: "#/$defs/ProjectSuggestion",
        },
        type: "array",
      },
    },
    required: ["suggestions"],
    title: "ProjectSuggestionsView",
    type: "object",
  },
  ProjectUpdateRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `projects/update`.",
    properties: {
      displayName: {
        description: "New display label for the project.",
        type: "string",
      },
      projectId: {
        description: "Stable project identity to update.",
        type: "string",
      },
    },
    required: ["projectId", "displayName"],
    title: "ProjectUpdateRequest",
    type: "object",
  },
  PromptLifecycleSnapshot: {
    $defs: {
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      PromptLifecycleState: {
        description:
          "The normalized prompt lifecycle state for a single session turn.",
        oneOf: [
          {
            const: "idle",
            description: "No active prompt turn is being tracked.",
            type: "string",
          },
          {
            const: "running",
            description: "A prompt request is in flight.",
            type: "string",
          },
          {
            const: "completed",
            description: "The prompt returned successfully.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The prompt completed after a cancel notification.",
            type: "string",
          },
        ],
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "A normalized prompt lifecycle snapshot backed by raw ACP updates.",
    properties: {
      agent_text_chunks: {
        default: [],
        description:
          "Agent-authored text chunks observed through official SDK notifications.",
        items: {
          type: "string",
        },
        type: "array",
      },
      identity: {
        $ref: "#/$defs/LiveSessionIdentity",
        description: "The session the prompt belongs to.",
      },
      raw_update_count: {
        description:
          "The number of raw session/update notifications observed during the turn.",
        format: "uint",
        minimum: 0,
        type: "integer",
      },
      state: {
        $ref: "#/$defs/PromptLifecycleState",
        description: "The current lifecycle state.",
      },
      stop_reason: {
        description: "The ACP stop reason when available.",
        type: ["string", "null"],
      },
      updates: {
        default: [],
        description:
          "Ordered raw ACP `session/update` notifications observed during the turn.",
        items: {
          $ref: "#/$defs/TranscriptUpdateSnapshot",
        },
        type: "array",
      },
    },
    required: ["identity", "state", "raw_update_count"],
    title: "PromptLifecycleSnapshot",
    type: "object",
  },
  PromptLifecycleState: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "The normalized prompt lifecycle state for a single session turn.",
    oneOf: [
      {
        const: "idle",
        description: "No active prompt turn is being tracked.",
        type: "string",
      },
      {
        const: "running",
        description: "A prompt request is in flight.",
        type: "string",
      },
      {
        const: "completed",
        description: "The prompt returned successfully.",
        type: "string",
      },
      {
        const: "cancelled",
        description: "The prompt completed after a cancel notification.",
        type: "string",
      },
    ],
    title: "PromptLifecycleState",
  },
  ProviderConfigSnapshotEntry: {
    $defs: {
      ProviderConfigSnapshotStatus: {
        description: "Snapshot worker status for provider config data.",
        oneOf: [
          {
            const: "loading",
            description: "The worker has not completed its first probe yet.",
            type: "string",
          },
          {
            const: "ready",
            description: "A fresh config snapshot is available.",
            type: "string",
          },
          {
            const: "error",
            description: "The provider was reachable but returned an error.",
            type: "string",
          },
          {
            const: "unavailable",
            description:
              "The provider could not be launched in the current environment.",
            type: "string",
          },
        ],
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
      SessionModeState: {
        description: "The set of modes and the one currently active.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          availableModes: {
            description: "The set of modes that the Agent can operate in",
            items: {
              $ref: "#/$defs/SessionMode",
            },
            type: "array",
          },
          currentModeId: {
            $ref: "#/$defs/SessionModeId",
            description: "The current mode the Agent is in.",
          },
        },
        required: ["currentModeId", "availableModes"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "One provider config snapshot entry.",
    properties: {
      configOptions: {
        description: "Provider config options when available.",
        items: {
          $ref: "#/$defs/SessionConfigOption",
        },
        type: ["array", "null"],
      },
      error: {
        description: "Probe error message when available.",
        type: ["string", "null"],
      },
      fetchedAt: {
        description: "Probe completion timestamp when available.",
        type: ["string", "null"],
      },
      models: {
        description: "Provider model state when available.",
      },
      modes: {
        anyOf: [
          {
            $ref: "#/$defs/SessionModeState",
          },
          {
            type: "null",
          },
        ],
        description: "Official ACP mode state when available.",
      },
      provider: {
        $ref: "#/$defs/ProviderId",
        description: "Provider identifier.",
      },
      status: {
        $ref: "#/$defs/ProviderConfigSnapshotStatus",
        description: "Snapshot status.",
      },
    },
    required: ["provider", "status"],
    title: "ProviderConfigSnapshotEntry",
    type: "object",
  },
  ProviderConfigSnapshotStatus: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "Snapshot worker status for provider config data.",
    oneOf: [
      {
        const: "loading",
        description: "The worker has not completed its first probe yet.",
        type: "string",
      },
      {
        const: "ready",
        description: "A fresh config snapshot is available.",
        type: "string",
      },
      {
        const: "error",
        description: "The provider was reachable but returned an error.",
        type: "string",
      },
      {
        const: "unavailable",
        description:
          "The provider could not be launched in the current environment.",
        type: "string",
      },
    ],
    title: "ProviderConfigSnapshotStatus",
  },
  ProviderDiscovery: {
    $defs: {
      AgentCapabilities: {
        description:
          "Capabilities supported by the agent.\n\nAdvertised during initialization to inform the client about\navailable features and content types.\n\nSee protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          loadSession: {
            default: false,
            description: "Whether the agent supports `session/load`.",
            type: "boolean",
          },
          mcpCapabilities: {
            $ref: "#/$defs/McpCapabilities",
            default: {
              http: false,
              sse: false,
            },
            description: "MCP capabilities supported by the agent.",
          },
          promptCapabilities: {
            $ref: "#/$defs/PromptCapabilities",
            default: {
              audio: false,
              embeddedContext: false,
              image: false,
            },
            description: "Prompt capabilities supported by the agent.",
          },
          sessionCapabilities: {
            $ref: "#/$defs/SessionCapabilities",
            default: {},
          },
        },
        type: "object",
      },
      AuthMethod: {
        anyOf: [
          {
            $ref: "#/$defs/AuthMethodAgent",
            description:
              "Agent handles authentication itself.\n\nThis is the default when no `type` is specified.",
          },
        ],
        description:
          "Describes an available authentication method.\n\nThe `type` field acts as the discriminator in the serialized JSON form.\nWhen no `type` is present, the method is treated as `agent`.",
      },
      AuthMethodAgent: {
        description:
          "Agent handles authentication itself.\n\nThis is the default authentication method type.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description:
              "Optional description providing more details about this authentication method.",
            type: ["string", "null"],
          },
          id: {
            description: "Unique identifier for this authentication method.",
            type: "string",
          },
          name: {
            description: "Human-readable name of the authentication method.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      Implementation: {
        description:
          "Metadata about the implementation of the client or agent.\nDescribes the name and version of an MCP implementation, with an optional\ntitle for UI representation.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          name: {
            description:
              "Intended for programmatic or logical use, but can be used as a display\nname fallback if title isn’t present.",
            type: "string",
          },
          title: {
            description:
              "Intended for UI and end-user contexts — optimized to be human-readable\nand easily understood.\n\nIf not provided, the name should be used for display.",
            type: ["string", "null"],
          },
          version: {
            description:
              'Version of the implementation. Can be displayed to the user or used\nfor debugging or metrics purposes. (e.g. "1.0.0").',
            type: "string",
          },
        },
        required: ["name", "version"],
        type: "object",
      },
      InitializeProbe: {
        description: "The initialize probe result returned by discovery.",
        properties: {
          elapsed_ms: {
            description:
              "The measured initialize response time in milliseconds.",
            format: "uint64",
            minimum: 0,
            type: "integer",
          },
          payload: {
            $ref: "#/$defs/InitializeResponse",
            description: "The typed initialize response payload.",
          },
          response: {
            description: "The raw initialize response envelope.",
          },
          stderr_lines: {
            description: "The raw stderr lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
          stdout_lines: {
            description: "The raw stdout lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        required: [
          "response",
          "payload",
          "stdout_lines",
          "stderr_lines",
          "elapsed_ms",
        ],
        type: "object",
      },
      InitializeResponse: {
        description:
          "Response to the `initialize` method.\n\nContains the negotiated protocol version and agent capabilities.\n\nSee protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          agentCapabilities: {
            $ref: "#/$defs/AgentCapabilities",
            default: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            description: "Capabilities supported by the agent.",
          },
          agentInfo: {
            anyOf: [
              {
                $ref: "#/$defs/Implementation",
              },
              {
                type: "null",
              },
            ],
            description:
              "Information about the Agent name and version sent to the Client.\n\nNote: in future versions of the protocol, this will be required.",
          },
          authMethods: {
            default: [],
            description: "Authentication methods supported by the agent.",
            items: {
              $ref: "#/$defs/AuthMethod",
            },
            type: "array",
          },
          protocolVersion: {
            $ref: "#/$defs/ProtocolVersion",
            description:
              "The protocol version the client specified if supported by the agent,\nor the latest protocol version supported by the agent.\n\nThe client should disconnect, if it doesn't support this version.",
          },
        },
        required: ["protocolVersion"],
        type: "object",
        "x-method": "initialize",
        "x-side": "agent",
      },
      LauncherCommand: {
        description:
          "The exact launcher command Conduit is allowed to run for a provider.",
        properties: {
          args: {
            description:
              "The actual argv that Conduit will pass after the executable.",
            items: {
              type: "string",
            },
            type: "array",
          },
          display: {
            description: "The human-readable command string fixed by policy.",
            type: "string",
          },
          executable: {
            description: "The resolved executable path after discovery.",
            type: "string",
          },
        },
        required: ["executable", "args", "display"],
        type: "object",
      },
      McpCapabilities: {
        description: "MCP capabilities supported by the agent",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          http: {
            default: false,
            description: "Agent supports [`McpServer::Http`].",
            type: "boolean",
          },
          sse: {
            default: false,
            description: "Agent supports [`McpServer::Sse`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptCapabilities: {
        description:
          "Prompt capabilities supported by the agent in `session/prompt` requests.\n\nBaseline agent functionality requires support for [`ContentBlock::Text`]\nand [`ContentBlock::ResourceLink`] in prompt requests.\n\nOther variants must be explicitly opted in to.\nCapabilities for different types of content in prompt requests.\n\nIndicates which content types beyond the baseline (text and resource links)\nthe agent can process.\n\nSee protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audio: {
            default: false,
            description: "Agent supports [`ContentBlock::Audio`].",
            type: "boolean",
          },
          embeddedContext: {
            default: false,
            description:
              "Agent supports embedded context in `session/prompt` requests.\n\nWhen enabled, the Client is allowed to include [`ContentBlock::Resource`]\nin prompt requests for pieces of context that are referenced in the message.",
            type: "boolean",
          },
          image: {
            default: false,
            description: "Agent supports [`ContentBlock::Image`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      ProtocolVersion: {
        description:
          "Protocol version identifier.\n\nThis version is only bumped for breaking changes.\nNon-breaking changes should be introduced via capabilities.",
        format: "uint16",
        maximum: 65535,
        minimum: 0,
        type: "integer",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionCapabilities: {
        description:
          "Session capabilities supported by the agent.\n\nAs a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.\n\nOptionally, they **MAY** support other session methods and notifications by specifying additional capabilities.\n\nNote: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.\n\nSee protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          list: {
            anyOf: [
              {
                $ref: "#/$defs/SessionListCapabilities",
              },
              {
                type: "null",
              },
            ],
            description: "Whether the agent supports `session/list`.",
          },
        },
        type: "object",
      },
      SessionListCapabilities: {
        description:
          "Capabilities for the `session/list` method.\n\nBy supplying `{}` it means that the agent supports listing of sessions.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
        },
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "The discovery output for a provider.",
    properties: {
      auth_hints: {
        description: "Human-readable auth hints surfaced by the adapter.",
        items: {
          type: "string",
        },
        type: "array",
      },
      initialize_probe: {
        $ref: "#/$defs/InitializeProbe",
        description: "The raw initialize result when probing succeeded.",
      },
      initialize_viable: {
        description: "Whether `initialize` completed successfully.",
        type: "boolean",
      },
      launcher: {
        $ref: "#/$defs/LauncherCommand",
        description: "The launcher command locked by policy.",
      },
      provider: {
        $ref: "#/$defs/ProviderId",
        description: "The provider identifier.",
      },
      resolved_path: {
        description: "The resolved binary path.",
        type: "string",
      },
      transport_diagnostics: {
        description: "Diagnostics gathered during probing.",
        items: {
          type: "string",
        },
        type: "array",
      },
      version: {
        description: "The version reported by the adapter.",
        type: "string",
      },
    },
    required: [
      "provider",
      "launcher",
      "resolved_path",
      "version",
      "auth_hints",
      "initialize_viable",
      "transport_diagnostics",
      "initialize_probe",
    ],
    title: "ProviderDiscovery",
    type: "object",
  },
  ProviderId: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "The three providers supported by Conduit Phase 1.",
    oneOf: [
      {
        const: "claude",
        description: "Anthropic Claude via the official ACP adapter.",
        type: "string",
      },
      {
        const: "copilot",
        description: "GitHub Copilot via the official ACP adapter.",
        type: "string",
      },
      {
        const: "codex",
        description: "OpenAI Codex via the official ACP adapter.",
        type: "string",
      },
    ],
    title: "ProviderId",
  },
  ProviderSnapshot: {
    $defs: {
      AgentCapabilities: {
        description:
          "Capabilities supported by the agent.\n\nAdvertised during initialization to inform the client about\navailable features and content types.\n\nSee protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          loadSession: {
            default: false,
            description: "Whether the agent supports `session/load`.",
            type: "boolean",
          },
          mcpCapabilities: {
            $ref: "#/$defs/McpCapabilities",
            default: {
              http: false,
              sse: false,
            },
            description: "MCP capabilities supported by the agent.",
          },
          promptCapabilities: {
            $ref: "#/$defs/PromptCapabilities",
            default: {
              audio: false,
              embeddedContext: false,
              image: false,
            },
            description: "Prompt capabilities supported by the agent.",
          },
          sessionCapabilities: {
            $ref: "#/$defs/SessionCapabilities",
            default: {},
          },
        },
        type: "object",
      },
      AuthMethod: {
        anyOf: [
          {
            $ref: "#/$defs/AuthMethodAgent",
            description:
              "Agent handles authentication itself.\n\nThis is the default when no `type` is specified.",
          },
        ],
        description:
          "Describes an available authentication method.\n\nThe `type` field acts as the discriminator in the serialized JSON form.\nWhen no `type` is present, the method is treated as `agent`.",
      },
      AuthMethodAgent: {
        description:
          "Agent handles authentication itself.\n\nThis is the default authentication method type.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description:
              "Optional description providing more details about this authentication method.",
            type: ["string", "null"],
          },
          id: {
            description: "Unique identifier for this authentication method.",
            type: "string",
          },
          name: {
            description: "Human-readable name of the authentication method.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      ConnectionState: {
        description: "The current host connection state.",
        oneOf: [
          {
            const: "disconnected",
            description: "The provider process has not been started.",
            type: "string",
          },
          {
            const: "ready",
            description: "The provider process is live and initialized.",
            type: "string",
          },
        ],
      },
      Implementation: {
        description:
          "Metadata about the implementation of the client or agent.\nDescribes the name and version of an MCP implementation, with an optional\ntitle for UI representation.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          name: {
            description:
              "Intended for programmatic or logical use, but can be used as a display\nname fallback if title isn’t present.",
            type: "string",
          },
          title: {
            description:
              "Intended for UI and end-user contexts — optimized to be human-readable\nand easily understood.\n\nIf not provided, the name should be used for display.",
            type: ["string", "null"],
          },
          version: {
            description:
              'Version of the implementation. Can be displayed to the user or used\nfor debugging or metrics purposes. (e.g. "1.0.0").',
            type: "string",
          },
        },
        required: ["name", "version"],
        type: "object",
      },
      InitializeProbe: {
        description: "The initialize probe result returned by discovery.",
        properties: {
          elapsed_ms: {
            description:
              "The measured initialize response time in milliseconds.",
            format: "uint64",
            minimum: 0,
            type: "integer",
          },
          payload: {
            $ref: "#/$defs/InitializeResponse",
            description: "The typed initialize response payload.",
          },
          response: {
            description: "The raw initialize response envelope.",
          },
          stderr_lines: {
            description: "The raw stderr lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
          stdout_lines: {
            description: "The raw stdout lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        required: [
          "response",
          "payload",
          "stdout_lines",
          "stderr_lines",
          "elapsed_ms",
        ],
        type: "object",
      },
      InitializeResponse: {
        description:
          "Response to the `initialize` method.\n\nContains the negotiated protocol version and agent capabilities.\n\nSee protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          agentCapabilities: {
            $ref: "#/$defs/AgentCapabilities",
            default: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            description: "Capabilities supported by the agent.",
          },
          agentInfo: {
            anyOf: [
              {
                $ref: "#/$defs/Implementation",
              },
              {
                type: "null",
              },
            ],
            description:
              "Information about the Agent name and version sent to the Client.\n\nNote: in future versions of the protocol, this will be required.",
          },
          authMethods: {
            default: [],
            description: "Authentication methods supported by the agent.",
            items: {
              $ref: "#/$defs/AuthMethod",
            },
            type: "array",
          },
          protocolVersion: {
            $ref: "#/$defs/ProtocolVersion",
            description:
              "The protocol version the client specified if supported by the agent,\nor the latest protocol version supported by the agent.\n\nThe client should disconnect, if it doesn't support this version.",
          },
        },
        required: ["protocolVersion"],
        type: "object",
        "x-method": "initialize",
        "x-side": "agent",
      },
      LauncherCommand: {
        description:
          "The exact launcher command Conduit is allowed to run for a provider.",
        properties: {
          args: {
            description:
              "The actual argv that Conduit will pass after the executable.",
            items: {
              type: "string",
            },
            type: "array",
          },
          display: {
            description: "The human-readable command string fixed by policy.",
            type: "string",
          },
          executable: {
            description: "The resolved executable path after discovery.",
            type: "string",
          },
        },
        required: ["executable", "args", "display"],
        type: "object",
      },
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      LiveSessionSnapshot: {
        description:
          "A normalized live session snapshot anchored to ACP truth.",
        properties: {
          cwd: {
            description:
              "The provider-reported or Conduit-observed working directory.",
            type: "string",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The exact live identity.",
          },
          observed_via: {
            description:
              "Whether the session was observed via `new`, `list`, or `load`.",
            type: "string",
          },
          title: {
            description: "The provider-reported title when available.",
            type: ["string", "null"],
          },
        },
        required: ["identity", "cwd", "observed_via"],
        type: "object",
      },
      LoadedTranscriptSnapshot: {
        description:
          "Read-side transcript replay captured while loading a session.",
        properties: {
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The loaded session identity.",
          },
          raw_update_count: {
            description:
              "The number of official SDK notifications observed during load.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          updates: {
            default: [],
            description: "Replayed updates in provider emission order.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "raw_update_count"],
        type: "object",
      },
      McpCapabilities: {
        description: "MCP capabilities supported by the agent",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          http: {
            default: false,
            description: "Agent supports [`McpServer::Http`].",
            type: "boolean",
          },
          sse: {
            default: false,
            description: "Agent supports [`McpServer::Sse`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptCapabilities: {
        description:
          "Prompt capabilities supported by the agent in `session/prompt` requests.\n\nBaseline agent functionality requires support for [`ContentBlock::Text`]\nand [`ContentBlock::ResourceLink`] in prompt requests.\n\nOther variants must be explicitly opted in to.\nCapabilities for different types of content in prompt requests.\n\nIndicates which content types beyond the baseline (text and resource links)\nthe agent can process.\n\nSee protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audio: {
            default: false,
            description: "Agent supports [`ContentBlock::Audio`].",
            type: "boolean",
          },
          embeddedContext: {
            default: false,
            description:
              "Agent supports embedded context in `session/prompt` requests.\n\nWhen enabled, the Client is allowed to include [`ContentBlock::Resource`]\nin prompt requests for pieces of context that are referenced in the message.",
            type: "boolean",
          },
          image: {
            default: false,
            description: "Agent supports [`ContentBlock::Image`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptLifecycleSnapshot: {
        description:
          "A normalized prompt lifecycle snapshot backed by raw ACP updates.",
        properties: {
          agent_text_chunks: {
            default: [],
            description:
              "Agent-authored text chunks observed through official SDK notifications.",
            items: {
              type: "string",
            },
            type: "array",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The session the prompt belongs to.",
          },
          raw_update_count: {
            description:
              "The number of raw session/update notifications observed during the turn.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          state: {
            $ref: "#/$defs/PromptLifecycleState",
            description: "The current lifecycle state.",
          },
          stop_reason: {
            description: "The ACP stop reason when available.",
            type: ["string", "null"],
          },
          updates: {
            default: [],
            description:
              "Ordered raw ACP `session/update` notifications observed during the turn.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "state", "raw_update_count"],
        type: "object",
      },
      PromptLifecycleState: {
        description:
          "The normalized prompt lifecycle state for a single session turn.",
        oneOf: [
          {
            const: "idle",
            description: "No active prompt turn is being tracked.",
            type: "string",
          },
          {
            const: "running",
            description: "A prompt request is in flight.",
            type: "string",
          },
          {
            const: "completed",
            description: "The prompt returned successfully.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The prompt completed after a cancel notification.",
            type: "string",
          },
        ],
      },
      ProtocolVersion: {
        description:
          "Protocol version identifier.\n\nThis version is only bumped for breaking changes.\nNon-breaking changes should be introduced via capabilities.",
        format: "uint16",
        maximum: 65535,
        minimum: 0,
        type: "integer",
      },
      ProviderDiscovery: {
        description: "The discovery output for a provider.",
        properties: {
          auth_hints: {
            description: "Human-readable auth hints surfaced by the adapter.",
            items: {
              type: "string",
            },
            type: "array",
          },
          initialize_probe: {
            $ref: "#/$defs/InitializeProbe",
            description: "The raw initialize result when probing succeeded.",
          },
          initialize_viable: {
            description: "Whether `initialize` completed successfully.",
            type: "boolean",
          },
          launcher: {
            $ref: "#/$defs/LauncherCommand",
            description: "The launcher command locked by policy.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
          resolved_path: {
            description: "The resolved binary path.",
            type: "string",
          },
          transport_diagnostics: {
            description: "Diagnostics gathered during probing.",
            items: {
              type: "string",
            },
            type: "array",
          },
          version: {
            description: "The version reported by the adapter.",
            type: "string",
          },
        },
        required: [
          "provider",
          "launcher",
          "resolved_path",
          "version",
          "auth_hints",
          "initialize_viable",
          "transport_diagnostics",
          "initialize_probe",
        ],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionCapabilities: {
        description:
          "Session capabilities supported by the agent.\n\nAs a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.\n\nOptionally, they **MAY** support other session methods and notifications by specifying additional capabilities.\n\nNote: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.\n\nSee protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          list: {
            anyOf: [
              {
                $ref: "#/$defs/SessionListCapabilities",
              },
              {
                type: "null",
              },
            ],
            description: "Whether the agent supports `session/list`.",
          },
        },
        type: "object",
      },
      SessionListCapabilities: {
        description:
          "Capabilities for the `session/list` method.\n\nBy supplying `{}` it means that the agent supports listing of sessions.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
        },
        type: "object",
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "The current provider snapshot exposed to apps and proof tooling.",
    properties: {
      auth_methods: {
        description:
          "The provider-reported auth methods from the live initialize result.",
        items: true,
        type: "array",
      },
      capabilities: {
        description:
          "The provider-reported capabilities from the live initialize result.",
      },
      connection_state: {
        $ref: "#/$defs/ConnectionState",
        description: "The current connection state.",
      },
      discovery: {
        $ref: "#/$defs/ProviderDiscovery",
        description:
          "The locked launcher truth and initialize probe provenance.",
      },
      last_prompt: {
        anyOf: [
          {
            $ref: "#/$defs/PromptLifecycleSnapshot",
          },
          {
            type: "null",
          },
        ],
        description: "The last observed prompt lifecycle, if any.",
      },
      live_sessions: {
        description: "The live sessions currently tracked in memory.",
        items: {
          $ref: "#/$defs/LiveSessionSnapshot",
        },
        type: "array",
      },
      loaded_transcripts: {
        default: [],
        description: "Transcript replays captured during `session/load`.",
        items: {
          $ref: "#/$defs/LoadedTranscriptSnapshot",
        },
        type: "array",
      },
      provider: {
        $ref: "#/$defs/ProviderId",
        description: "The provider identifier.",
      },
    },
    required: [
      "provider",
      "connection_state",
      "discovery",
      "capabilities",
      "auth_methods",
      "live_sessions",
    ],
    title: "ProviderSnapshot",
    type: "object",
  },
  ProvidersConfigSnapshotResult: {
    $defs: {
      ProviderConfigSnapshotEntry: {
        additionalProperties: false,
        description: "One provider config snapshot entry.",
        properties: {
          configOptions: {
            description: "Provider config options when available.",
            items: {
              $ref: "#/$defs/SessionConfigOption",
            },
            type: ["array", "null"],
          },
          error: {
            description: "Probe error message when available.",
            type: ["string", "null"],
          },
          fetchedAt: {
            description: "Probe completion timestamp when available.",
            type: ["string", "null"],
          },
          models: {
            description: "Provider model state when available.",
          },
          modes: {
            anyOf: [
              {
                $ref: "#/$defs/SessionModeState",
              },
              {
                type: "null",
              },
            ],
            description: "Official ACP mode state when available.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Provider identifier.",
          },
          status: {
            $ref: "#/$defs/ProviderConfigSnapshotStatus",
            description: "Snapshot status.",
          },
        },
        required: ["provider", "status"],
        type: "object",
      },
      ProviderConfigSnapshotStatus: {
        description: "Snapshot worker status for provider config data.",
        oneOf: [
          {
            const: "loading",
            description: "The worker has not completed its first probe yet.",
            type: "string",
          },
          {
            const: "ready",
            description: "A fresh config snapshot is available.",
            type: "string",
          },
          {
            const: "error",
            description: "The provider was reachable but returned an error.",
            type: "string",
          },
          {
            const: "unavailable",
            description:
              "The provider could not be launched in the current environment.",
            type: "string",
          },
        ],
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
      SessionModeState: {
        description: "The set of modes and the one currently active.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          availableModes: {
            description: "The set of modes that the Agent can operate in",
            items: {
              $ref: "#/$defs/SessionMode",
            },
            type: "array",
          },
          currentModeId: {
            $ref: "#/$defs/SessionModeId",
            description: "The current mode the Agent is in.",
          },
        },
        required: ["currentModeId", "availableModes"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Result payload for `providers/config_snapshot`.",
    properties: {
      entries: {
        description: "Snapshot entry for each supported provider.",
        items: {
          $ref: "#/$defs/ProviderConfigSnapshotEntry",
        },
        type: "array",
      },
    },
    required: ["entries"],
    title: "ProvidersConfigSnapshotResult",
    type: "object",
  },
  RawWireEvent: {
    $defs: {
      WireKind: {
        description: "The coarse JSON-RPC shape of a wire event.",
        oneOf: [
          {
            const: "request",
            description: "JSON-RPC request.",
            type: "string",
          },
          {
            const: "response",
            description: "JSON-RPC response.",
            type: "string",
          },
          {
            const: "notification",
            description: "JSON-RPC notification.",
            type: "string",
          },
          {
            const: "diagnostic",
            description: "Non-JSON stderr output.",
            type: "string",
          },
        ],
      },
      WireStream: {
        description: "The stream that produced a captured wire event.",
        oneOf: [
          {
            const: "outgoing",
            description: "A message sent from Conduit to the provider.",
            type: "string",
          },
          {
            const: "incoming",
            description: "A message received from provider stdout.",
            type: "string",
          },
          {
            const: "stderr",
            description: "A line received from provider stderr.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One raw line captured from the ACP transport.",
    properties: {
      json: {
        description: "Parsed JSON when the line was valid JSON.",
      },
      kind: {
        $ref: "#/$defs/WireKind",
        description: "The coarse JSON-RPC shape.",
      },
      method: {
        description: "The JSON-RPC method when present.",
        type: ["string", "null"],
      },
      payload: {
        description: "The raw line text exactly as captured.",
        type: "string",
      },
      request_id: {
        description: "The JSON-RPC request id when present.",
        type: ["string", "null"],
      },
      sequence: {
        description:
          "Monotonic sequence number within a single host connection.",
        format: "uint64",
        minimum: 0,
        type: "integer",
      },
      stream: {
        $ref: "#/$defs/WireStream",
        description: "The stream that produced the event.",
      },
    },
    required: ["sequence", "stream", "kind", "payload"],
    title: "RawWireEvent",
    type: "object",
  },
  RuntimeEvent: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One UI-facing runtime event emitted on the WebSocket stream.",
    oneOf: [
      {
        description: "The grouped session index changed.",
        properties: {
          kind: {
            const: "sessions_index_changed",
            type: "string",
          },
          revision: {
            description: "Current session-index revision.",
            format: "int64",
            type: "integer",
          },
        },
        required: ["kind", "revision"],
        type: "object",
      },
      {
        description: "One open-session timeline changed.",
        properties: {
          items: {
            description:
              "Replacement items for the affected prompt turn when available.",
            items: {
              $ref: "#/$defs/TranscriptItem",
            },
            type: ["array", "null"],
          },
          kind: {
            const: "session_timeline_changed",
            type: "string",
          },
          openSessionId: {
            description: "Open-session identity allocated by Conduit.",
            type: "string",
          },
          revision: {
            description: "Current timeline revision.",
            format: "int64",
            type: "integer",
          },
        },
        required: ["kind", "openSessionId", "revision"],
        type: "object",
      },
    ],
    title: "RuntimeEvent",
  },
  ServerEventFrame: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      RuntimeEvent: {
        description:
          "One UI-facing runtime event emitted on the WebSocket stream.",
        oneOf: [
          {
            description: "The grouped session index changed.",
            properties: {
              kind: {
                const: "sessions_index_changed",
                type: "string",
              },
              revision: {
                description: "Current session-index revision.",
                format: "int64",
                type: "integer",
              },
            },
            required: ["kind", "revision"],
            type: "object",
          },
          {
            description: "One open-session timeline changed.",
            properties: {
              items: {
                description:
                  "Replacement items for the affected prompt turn when available.",
                items: {
                  $ref: "#/$defs/TranscriptItem",
                },
                type: ["array", "null"],
              },
              kind: {
                const: "session_timeline_changed",
                type: "string",
              },
              openSessionId: {
                description: "Open-session identity allocated by Conduit.",
                type: "string",
              },
              revision: {
                description: "Current timeline revision.",
                format: "int64",
                type: "integer",
              },
            },
            required: ["kind", "openSessionId", "revision"],
            type: "object",
          },
        ],
      },
      ServerEventFrameType: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "event",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Versioned WebSocket frame carrying one runtime event.",
    properties: {
      event: {
        $ref: "#/$defs/RuntimeEvent",
        description: "Event payload.",
      },
      type: {
        $ref: "#/$defs/ServerEventFrameType",
        description: "Stable frame discriminator.",
      },
      v: {
        description: "Transport protocol version.",
        format: "uint8",
        maximum: 1,
        minimum: 1,
        type: "integer",
      },
    },
    required: ["v", "type", "event"],
    title: "ServerEventFrame",
    type: "object",
  },
  ServerFrame: {
    $defs: {
      AgentCapabilities: {
        description:
          "Capabilities supported by the agent.\n\nAdvertised during initialization to inform the client about\navailable features and content types.\n\nSee protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          loadSession: {
            default: false,
            description: "Whether the agent supports `session/load`.",
            type: "boolean",
          },
          mcpCapabilities: {
            $ref: "#/$defs/McpCapabilities",
            default: {
              http: false,
              sse: false,
            },
            description: "MCP capabilities supported by the agent.",
          },
          promptCapabilities: {
            $ref: "#/$defs/PromptCapabilities",
            default: {
              audio: false,
              embeddedContext: false,
              image: false,
            },
            description: "Prompt capabilities supported by the agent.",
          },
          sessionCapabilities: {
            $ref: "#/$defs/SessionCapabilities",
            default: {},
          },
        },
        type: "object",
      },
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      AuthMethod: {
        anyOf: [
          {
            $ref: "#/$defs/AuthMethodAgent",
            description:
              "Agent handles authentication itself.\n\nThis is the default when no `type` is specified.",
          },
        ],
        description:
          "Describes an available authentication method.\n\nThe `type` field acts as the discriminator in the serialized JSON form.\nWhen no `type` is present, the method is treated as `agent`.",
      },
      AuthMethodAgent: {
        description:
          "Agent handles authentication itself.\n\nThis is the default authentication method type.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description:
              "Optional description providing more details about this authentication method.",
            type: ["string", "null"],
          },
          id: {
            description: "Unique identifier for this authentication method.",
            type: "string",
          },
          name: {
            description: "Human-readable name of the authentication method.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ConnectionState: {
        description: "The current host connection state.",
        oneOf: [
          {
            const: "disconnected",
            description: "The provider process has not been started.",
            type: "string",
          },
          {
            const: "ready",
            description: "The provider process is live and initialized.",
            type: "string",
          },
        ],
      },
      ConsumerError: {
        additionalProperties: false,
        description: "Stable consumer error envelope.",
        properties: {
          code: {
            description: "Stable machine-readable error code.",
            type: "string",
          },
          message: {
            description: "Human-readable error details.",
            type: "string",
          },
        },
        required: ["code", "message"],
        type: "object",
      },
      ConsumerResponse: {
        additionalProperties: false,
        description: "One stable consumer response envelope.",
        properties: {
          error: {
            anyOf: [
              {
                $ref: "#/$defs/ConsumerError",
              },
              {
                type: "null",
              },
            ],
            description: "Stable error payload when `ok` is false.",
          },
          id: {
            description: "Caller-owned request id echoed from the command.",
            minLength: 1,
            type: "string",
          },
          ok: {
            description: "Whether the command completed successfully.",
            type: "boolean",
          },
          result: {
            description: "ACP result payload or Conduit-owned command result.",
          },
          snapshot: {
            anyOf: [
              {
                $ref: "#/$defs/ProviderSnapshot",
              },
              {
                type: "null",
              },
            ],
            description:
              "Read-side snapshot after command handling when available.",
          },
        },
        required: ["id", "ok", "result"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      Implementation: {
        description:
          "Metadata about the implementation of the client or agent.\nDescribes the name and version of an MCP implementation, with an optional\ntitle for UI representation.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          name: {
            description:
              "Intended for programmatic or logical use, but can be used as a display\nname fallback if title isn’t present.",
            type: "string",
          },
          title: {
            description:
              "Intended for UI and end-user contexts — optimized to be human-readable\nand easily understood.\n\nIf not provided, the name should be used for display.",
            type: ["string", "null"],
          },
          version: {
            description:
              'Version of the implementation. Can be displayed to the user or used\nfor debugging or metrics purposes. (e.g. "1.0.0").',
            type: "string",
          },
        },
        required: ["name", "version"],
        type: "object",
      },
      InitializeProbe: {
        description: "The initialize probe result returned by discovery.",
        properties: {
          elapsed_ms: {
            description:
              "The measured initialize response time in milliseconds.",
            format: "uint64",
            minimum: 0,
            type: "integer",
          },
          payload: {
            $ref: "#/$defs/InitializeResponse",
            description: "The typed initialize response payload.",
          },
          response: {
            description: "The raw initialize response envelope.",
          },
          stderr_lines: {
            description: "The raw stderr lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
          stdout_lines: {
            description: "The raw stdout lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        required: [
          "response",
          "payload",
          "stdout_lines",
          "stderr_lines",
          "elapsed_ms",
        ],
        type: "object",
      },
      InitializeResponse: {
        description:
          "Response to the `initialize` method.\n\nContains the negotiated protocol version and agent capabilities.\n\nSee protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          agentCapabilities: {
            $ref: "#/$defs/AgentCapabilities",
            default: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            description: "Capabilities supported by the agent.",
          },
          agentInfo: {
            anyOf: [
              {
                $ref: "#/$defs/Implementation",
              },
              {
                type: "null",
              },
            ],
            description:
              "Information about the Agent name and version sent to the Client.\n\nNote: in future versions of the protocol, this will be required.",
          },
          authMethods: {
            default: [],
            description: "Authentication methods supported by the agent.",
            items: {
              $ref: "#/$defs/AuthMethod",
            },
            type: "array",
          },
          protocolVersion: {
            $ref: "#/$defs/ProtocolVersion",
            description:
              "The protocol version the client specified if supported by the agent,\nor the latest protocol version supported by the agent.\n\nThe client should disconnect, if it doesn't support this version.",
          },
        },
        required: ["protocolVersion"],
        type: "object",
        "x-method": "initialize",
        "x-side": "agent",
      },
      LauncherCommand: {
        description:
          "The exact launcher command Conduit is allowed to run for a provider.",
        properties: {
          args: {
            description:
              "The actual argv that Conduit will pass after the executable.",
            items: {
              type: "string",
            },
            type: "array",
          },
          display: {
            description: "The human-readable command string fixed by policy.",
            type: "string",
          },
          executable: {
            description: "The resolved executable path after discovery.",
            type: "string",
          },
        },
        required: ["executable", "args", "display"],
        type: "object",
      },
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      LiveSessionSnapshot: {
        description:
          "A normalized live session snapshot anchored to ACP truth.",
        properties: {
          cwd: {
            description:
              "The provider-reported or Conduit-observed working directory.",
            type: "string",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The exact live identity.",
          },
          observed_via: {
            description:
              "Whether the session was observed via `new`, `list`, or `load`.",
            type: "string",
          },
          title: {
            description: "The provider-reported title when available.",
            type: ["string", "null"],
          },
        },
        required: ["identity", "cwd", "observed_via"],
        type: "object",
      },
      LoadedTranscriptSnapshot: {
        description:
          "Read-side transcript replay captured while loading a session.",
        properties: {
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The loaded session identity.",
          },
          raw_update_count: {
            description:
              "The number of official SDK notifications observed during load.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          updates: {
            default: [],
            description: "Replayed updates in provider emission order.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "raw_update_count"],
        type: "object",
      },
      McpCapabilities: {
        description: "MCP capabilities supported by the agent",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          http: {
            default: false,
            description: "Agent supports [`McpServer::Http`].",
            type: "boolean",
          },
          sse: {
            default: false,
            description: "Agent supports [`McpServer::Sse`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      PromptCapabilities: {
        description:
          "Prompt capabilities supported by the agent in `session/prompt` requests.\n\nBaseline agent functionality requires support for [`ContentBlock::Text`]\nand [`ContentBlock::ResourceLink`] in prompt requests.\n\nOther variants must be explicitly opted in to.\nCapabilities for different types of content in prompt requests.\n\nIndicates which content types beyond the baseline (text and resource links)\nthe agent can process.\n\nSee protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audio: {
            default: false,
            description: "Agent supports [`ContentBlock::Audio`].",
            type: "boolean",
          },
          embeddedContext: {
            default: false,
            description:
              "Agent supports embedded context in `session/prompt` requests.\n\nWhen enabled, the Client is allowed to include [`ContentBlock::Resource`]\nin prompt requests for pieces of context that are referenced in the message.",
            type: "boolean",
          },
          image: {
            default: false,
            description: "Agent supports [`ContentBlock::Image`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptLifecycleSnapshot: {
        description:
          "A normalized prompt lifecycle snapshot backed by raw ACP updates.",
        properties: {
          agent_text_chunks: {
            default: [],
            description:
              "Agent-authored text chunks observed through official SDK notifications.",
            items: {
              type: "string",
            },
            type: "array",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The session the prompt belongs to.",
          },
          raw_update_count: {
            description:
              "The number of raw session/update notifications observed during the turn.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          state: {
            $ref: "#/$defs/PromptLifecycleState",
            description: "The current lifecycle state.",
          },
          stop_reason: {
            description: "The ACP stop reason when available.",
            type: ["string", "null"],
          },
          updates: {
            default: [],
            description:
              "Ordered raw ACP `session/update` notifications observed during the turn.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "state", "raw_update_count"],
        type: "object",
      },
      PromptLifecycleState: {
        description:
          "The normalized prompt lifecycle state for a single session turn.",
        oneOf: [
          {
            const: "idle",
            description: "No active prompt turn is being tracked.",
            type: "string",
          },
          {
            const: "running",
            description: "A prompt request is in flight.",
            type: "string",
          },
          {
            const: "completed",
            description: "The prompt returned successfully.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The prompt completed after a cancel notification.",
            type: "string",
          },
        ],
      },
      ProtocolVersion: {
        description:
          "Protocol version identifier.\n\nThis version is only bumped for breaking changes.\nNon-breaking changes should be introduced via capabilities.",
        format: "uint16",
        maximum: 65535,
        minimum: 0,
        type: "integer",
      },
      ProviderDiscovery: {
        description: "The discovery output for a provider.",
        properties: {
          auth_hints: {
            description: "Human-readable auth hints surfaced by the adapter.",
            items: {
              type: "string",
            },
            type: "array",
          },
          initialize_probe: {
            $ref: "#/$defs/InitializeProbe",
            description: "The raw initialize result when probing succeeded.",
          },
          initialize_viable: {
            description: "Whether `initialize` completed successfully.",
            type: "boolean",
          },
          launcher: {
            $ref: "#/$defs/LauncherCommand",
            description: "The launcher command locked by policy.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
          resolved_path: {
            description: "The resolved binary path.",
            type: "string",
          },
          transport_diagnostics: {
            description: "Diagnostics gathered during probing.",
            items: {
              type: "string",
            },
            type: "array",
          },
          version: {
            description: "The version reported by the adapter.",
            type: "string",
          },
        },
        required: [
          "provider",
          "launcher",
          "resolved_path",
          "version",
          "auth_hints",
          "initialize_viable",
          "transport_diagnostics",
          "initialize_probe",
        ],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      ProviderSnapshot: {
        description:
          "The current provider snapshot exposed to apps and proof tooling.",
        properties: {
          auth_methods: {
            description:
              "The provider-reported auth methods from the live initialize result.",
            items: true,
            type: "array",
          },
          capabilities: {
            description:
              "The provider-reported capabilities from the live initialize result.",
          },
          connection_state: {
            $ref: "#/$defs/ConnectionState",
            description: "The current connection state.",
          },
          discovery: {
            $ref: "#/$defs/ProviderDiscovery",
            description:
              "The locked launcher truth and initialize probe provenance.",
          },
          last_prompt: {
            anyOf: [
              {
                $ref: "#/$defs/PromptLifecycleSnapshot",
              },
              {
                type: "null",
              },
            ],
            description: "The last observed prompt lifecycle, if any.",
          },
          live_sessions: {
            description: "The live sessions currently tracked in memory.",
            items: {
              $ref: "#/$defs/LiveSessionSnapshot",
            },
            type: "array",
          },
          loaded_transcripts: {
            default: [],
            description: "Transcript replays captured during `session/load`.",
            items: {
              $ref: "#/$defs/LoadedTranscriptSnapshot",
            },
            type: "array",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
        },
        required: [
          "provider",
          "connection_state",
          "discovery",
          "capabilities",
          "auth_methods",
          "live_sessions",
        ],
        type: "object",
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      RuntimeEvent: {
        description:
          "One UI-facing runtime event emitted on the WebSocket stream.",
        oneOf: [
          {
            description: "The grouped session index changed.",
            properties: {
              kind: {
                const: "sessions_index_changed",
                type: "string",
              },
              revision: {
                description: "Current session-index revision.",
                format: "int64",
                type: "integer",
              },
            },
            required: ["kind", "revision"],
            type: "object",
          },
          {
            description: "One open-session timeline changed.",
            properties: {
              items: {
                description:
                  "Replacement items for the affected prompt turn when available.",
                items: {
                  $ref: "#/$defs/TranscriptItem",
                },
                type: ["array", "null"],
              },
              kind: {
                const: "session_timeline_changed",
                type: "string",
              },
              openSessionId: {
                description: "Open-session identity allocated by Conduit.",
                type: "string",
              },
              revision: {
                description: "Current timeline revision.",
                format: "int64",
                type: "integer",
              },
            },
            required: ["kind", "openSessionId", "revision"],
            type: "object",
          },
        ],
      },
      SessionCapabilities: {
        description:
          "Session capabilities supported by the agent.\n\nAs a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.\n\nOptionally, they **MAY** support other session methods and notifications by specifying additional capabilities.\n\nNote: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.\n\nSee protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          list: {
            anyOf: [
              {
                $ref: "#/$defs/SessionListCapabilities",
              },
              {
                type: "null",
              },
            ],
            description: "Whether the agent supports `session/list`.",
          },
        },
        type: "object",
      },
      SessionListCapabilities: {
        description:
          "Capabilities for the `session/list` method.\n\nBy supplying `{}` it means that the agent supports listing of sessions.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
        },
        type: "object",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One server-to-client WebSocket frame.",
    oneOf: [
      {
        description: "Command response frame.",
        properties: {
          id: {
            description: "Correlation id echoed from the command.",
            minLength: 1,
            type: "string",
          },
          response: {
            $ref: "#/$defs/ConsumerResponse",
            description: "Response payload.",
          },
          type: {
            const: "response",
            type: "string",
          },
          v: {
            description: "Transport protocol version.",
            format: "uint8",
            maximum: 1,
            minimum: 1,
            type: "integer",
          },
        },
        required: ["type", "v", "id", "response"],
        type: "object",
      },
      {
        description: "Runtime event frame.",
        properties: {
          event: {
            $ref: "#/$defs/RuntimeEvent",
            description: "Event payload.",
          },
          type: {
            const: "event",
            type: "string",
          },
          v: {
            description: "Transport protocol version.",
            format: "uint8",
            maximum: 1,
            minimum: 1,
            type: "integer",
          },
        },
        required: ["type", "v", "event"],
        type: "object",
      },
    ],
    title: "ServerFrame",
  },
  ServerResponseFrame: {
    $defs: {
      AgentCapabilities: {
        description:
          "Capabilities supported by the agent.\n\nAdvertised during initialization to inform the client about\navailable features and content types.\n\nSee protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          loadSession: {
            default: false,
            description: "Whether the agent supports `session/load`.",
            type: "boolean",
          },
          mcpCapabilities: {
            $ref: "#/$defs/McpCapabilities",
            default: {
              http: false,
              sse: false,
            },
            description: "MCP capabilities supported by the agent.",
          },
          promptCapabilities: {
            $ref: "#/$defs/PromptCapabilities",
            default: {
              audio: false,
              embeddedContext: false,
              image: false,
            },
            description: "Prompt capabilities supported by the agent.",
          },
          sessionCapabilities: {
            $ref: "#/$defs/SessionCapabilities",
            default: {},
          },
        },
        type: "object",
      },
      AuthMethod: {
        anyOf: [
          {
            $ref: "#/$defs/AuthMethodAgent",
            description:
              "Agent handles authentication itself.\n\nThis is the default when no `type` is specified.",
          },
        ],
        description:
          "Describes an available authentication method.\n\nThe `type` field acts as the discriminator in the serialized JSON form.\nWhen no `type` is present, the method is treated as `agent`.",
      },
      AuthMethodAgent: {
        description:
          "Agent handles authentication itself.\n\nThis is the default authentication method type.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description:
              "Optional description providing more details about this authentication method.",
            type: ["string", "null"],
          },
          id: {
            description: "Unique identifier for this authentication method.",
            type: "string",
          },
          name: {
            description: "Human-readable name of the authentication method.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      ConnectionState: {
        description: "The current host connection state.",
        oneOf: [
          {
            const: "disconnected",
            description: "The provider process has not been started.",
            type: "string",
          },
          {
            const: "ready",
            description: "The provider process is live and initialized.",
            type: "string",
          },
        ],
      },
      ConsumerError: {
        additionalProperties: false,
        description: "Stable consumer error envelope.",
        properties: {
          code: {
            description: "Stable machine-readable error code.",
            type: "string",
          },
          message: {
            description: "Human-readable error details.",
            type: "string",
          },
        },
        required: ["code", "message"],
        type: "object",
      },
      ConsumerResponse: {
        additionalProperties: false,
        description: "One stable consumer response envelope.",
        properties: {
          error: {
            anyOf: [
              {
                $ref: "#/$defs/ConsumerError",
              },
              {
                type: "null",
              },
            ],
            description: "Stable error payload when `ok` is false.",
          },
          id: {
            description: "Caller-owned request id echoed from the command.",
            minLength: 1,
            type: "string",
          },
          ok: {
            description: "Whether the command completed successfully.",
            type: "boolean",
          },
          result: {
            description: "ACP result payload or Conduit-owned command result.",
          },
          snapshot: {
            anyOf: [
              {
                $ref: "#/$defs/ProviderSnapshot",
              },
              {
                type: "null",
              },
            ],
            description:
              "Read-side snapshot after command handling when available.",
          },
        },
        required: ["id", "ok", "result"],
        type: "object",
      },
      Implementation: {
        description:
          "Metadata about the implementation of the client or agent.\nDescribes the name and version of an MCP implementation, with an optional\ntitle for UI representation.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          name: {
            description:
              "Intended for programmatic or logical use, but can be used as a display\nname fallback if title isn’t present.",
            type: "string",
          },
          title: {
            description:
              "Intended for UI and end-user contexts — optimized to be human-readable\nand easily understood.\n\nIf not provided, the name should be used for display.",
            type: ["string", "null"],
          },
          version: {
            description:
              'Version of the implementation. Can be displayed to the user or used\nfor debugging or metrics purposes. (e.g. "1.0.0").',
            type: "string",
          },
        },
        required: ["name", "version"],
        type: "object",
      },
      InitializeProbe: {
        description: "The initialize probe result returned by discovery.",
        properties: {
          elapsed_ms: {
            description:
              "The measured initialize response time in milliseconds.",
            format: "uint64",
            minimum: 0,
            type: "integer",
          },
          payload: {
            $ref: "#/$defs/InitializeResponse",
            description: "The typed initialize response payload.",
          },
          response: {
            description: "The raw initialize response envelope.",
          },
          stderr_lines: {
            description: "The raw stderr lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
          stdout_lines: {
            description: "The raw stdout lines observed during initialize.",
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        required: [
          "response",
          "payload",
          "stdout_lines",
          "stderr_lines",
          "elapsed_ms",
        ],
        type: "object",
      },
      InitializeResponse: {
        description:
          "Response to the `initialize` method.\n\nContains the negotiated protocol version and agent capabilities.\n\nSee protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          agentCapabilities: {
            $ref: "#/$defs/AgentCapabilities",
            default: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            description: "Capabilities supported by the agent.",
          },
          agentInfo: {
            anyOf: [
              {
                $ref: "#/$defs/Implementation",
              },
              {
                type: "null",
              },
            ],
            description:
              "Information about the Agent name and version sent to the Client.\n\nNote: in future versions of the protocol, this will be required.",
          },
          authMethods: {
            default: [],
            description: "Authentication methods supported by the agent.",
            items: {
              $ref: "#/$defs/AuthMethod",
            },
            type: "array",
          },
          protocolVersion: {
            $ref: "#/$defs/ProtocolVersion",
            description:
              "The protocol version the client specified if supported by the agent,\nor the latest protocol version supported by the agent.\n\nThe client should disconnect, if it doesn't support this version.",
          },
        },
        required: ["protocolVersion"],
        type: "object",
        "x-method": "initialize",
        "x-side": "agent",
      },
      LauncherCommand: {
        description:
          "The exact launcher command Conduit is allowed to run for a provider.",
        properties: {
          args: {
            description:
              "The actual argv that Conduit will pass after the executable.",
            items: {
              type: "string",
            },
            type: "array",
          },
          display: {
            description: "The human-readable command string fixed by policy.",
            type: "string",
          },
          executable: {
            description: "The resolved executable path after discovery.",
            type: "string",
          },
        },
        required: ["executable", "args", "display"],
        type: "object",
      },
      LiveSessionIdentity: {
        description: "The exact live session identity rule for Conduit.",
        properties: {
          acp_session_id: {
            description: "The ACP session id returned by the provider.",
            type: "string",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider owning this session.",
          },
        },
        required: ["provider", "acp_session_id"],
        type: "object",
      },
      LiveSessionSnapshot: {
        description:
          "A normalized live session snapshot anchored to ACP truth.",
        properties: {
          cwd: {
            description:
              "The provider-reported or Conduit-observed working directory.",
            type: "string",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The exact live identity.",
          },
          observed_via: {
            description:
              "Whether the session was observed via `new`, `list`, or `load`.",
            type: "string",
          },
          title: {
            description: "The provider-reported title when available.",
            type: ["string", "null"],
          },
        },
        required: ["identity", "cwd", "observed_via"],
        type: "object",
      },
      LoadedTranscriptSnapshot: {
        description:
          "Read-side transcript replay captured while loading a session.",
        properties: {
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The loaded session identity.",
          },
          raw_update_count: {
            description:
              "The number of official SDK notifications observed during load.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          updates: {
            default: [],
            description: "Replayed updates in provider emission order.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "raw_update_count"],
        type: "object",
      },
      McpCapabilities: {
        description: "MCP capabilities supported by the agent",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          http: {
            default: false,
            description: "Agent supports [`McpServer::Http`].",
            type: "boolean",
          },
          sse: {
            default: false,
            description: "Agent supports [`McpServer::Sse`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptCapabilities: {
        description:
          "Prompt capabilities supported by the agent in `session/prompt` requests.\n\nBaseline agent functionality requires support for [`ContentBlock::Text`]\nand [`ContentBlock::ResourceLink`] in prompt requests.\n\nOther variants must be explicitly opted in to.\nCapabilities for different types of content in prompt requests.\n\nIndicates which content types beyond the baseline (text and resource links)\nthe agent can process.\n\nSee protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audio: {
            default: false,
            description: "Agent supports [`ContentBlock::Audio`].",
            type: "boolean",
          },
          embeddedContext: {
            default: false,
            description:
              "Agent supports embedded context in `session/prompt` requests.\n\nWhen enabled, the Client is allowed to include [`ContentBlock::Resource`]\nin prompt requests for pieces of context that are referenced in the message.",
            type: "boolean",
          },
          image: {
            default: false,
            description: "Agent supports [`ContentBlock::Image`].",
            type: "boolean",
          },
        },
        type: "object",
      },
      PromptLifecycleSnapshot: {
        description:
          "A normalized prompt lifecycle snapshot backed by raw ACP updates.",
        properties: {
          agent_text_chunks: {
            default: [],
            description:
              "Agent-authored text chunks observed through official SDK notifications.",
            items: {
              type: "string",
            },
            type: "array",
          },
          identity: {
            $ref: "#/$defs/LiveSessionIdentity",
            description: "The session the prompt belongs to.",
          },
          raw_update_count: {
            description:
              "The number of raw session/update notifications observed during the turn.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          state: {
            $ref: "#/$defs/PromptLifecycleState",
            description: "The current lifecycle state.",
          },
          stop_reason: {
            description: "The ACP stop reason when available.",
            type: ["string", "null"],
          },
          updates: {
            default: [],
            description:
              "Ordered raw ACP `session/update` notifications observed during the turn.",
            items: {
              $ref: "#/$defs/TranscriptUpdateSnapshot",
            },
            type: "array",
          },
        },
        required: ["identity", "state", "raw_update_count"],
        type: "object",
      },
      PromptLifecycleState: {
        description:
          "The normalized prompt lifecycle state for a single session turn.",
        oneOf: [
          {
            const: "idle",
            description: "No active prompt turn is being tracked.",
            type: "string",
          },
          {
            const: "running",
            description: "A prompt request is in flight.",
            type: "string",
          },
          {
            const: "completed",
            description: "The prompt returned successfully.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The prompt completed after a cancel notification.",
            type: "string",
          },
        ],
      },
      ProtocolVersion: {
        description:
          "Protocol version identifier.\n\nThis version is only bumped for breaking changes.\nNon-breaking changes should be introduced via capabilities.",
        format: "uint16",
        maximum: 65535,
        minimum: 0,
        type: "integer",
      },
      ProviderDiscovery: {
        description: "The discovery output for a provider.",
        properties: {
          auth_hints: {
            description: "Human-readable auth hints surfaced by the adapter.",
            items: {
              type: "string",
            },
            type: "array",
          },
          initialize_probe: {
            $ref: "#/$defs/InitializeProbe",
            description: "The raw initialize result when probing succeeded.",
          },
          initialize_viable: {
            description: "Whether `initialize` completed successfully.",
            type: "boolean",
          },
          launcher: {
            $ref: "#/$defs/LauncherCommand",
            description: "The launcher command locked by policy.",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
          resolved_path: {
            description: "The resolved binary path.",
            type: "string",
          },
          transport_diagnostics: {
            description: "Diagnostics gathered during probing.",
            items: {
              type: "string",
            },
            type: "array",
          },
          version: {
            description: "The version reported by the adapter.",
            type: "string",
          },
        },
        required: [
          "provider",
          "launcher",
          "resolved_path",
          "version",
          "auth_hints",
          "initialize_viable",
          "transport_diagnostics",
          "initialize_probe",
        ],
        type: "object",
      },
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      ProviderSnapshot: {
        description:
          "The current provider snapshot exposed to apps and proof tooling.",
        properties: {
          auth_methods: {
            description:
              "The provider-reported auth methods from the live initialize result.",
            items: true,
            type: "array",
          },
          capabilities: {
            description:
              "The provider-reported capabilities from the live initialize result.",
          },
          connection_state: {
            $ref: "#/$defs/ConnectionState",
            description: "The current connection state.",
          },
          discovery: {
            $ref: "#/$defs/ProviderDiscovery",
            description:
              "The locked launcher truth and initialize probe provenance.",
          },
          last_prompt: {
            anyOf: [
              {
                $ref: "#/$defs/PromptLifecycleSnapshot",
              },
              {
                type: "null",
              },
            ],
            description: "The last observed prompt lifecycle, if any.",
          },
          live_sessions: {
            description: "The live sessions currently tracked in memory.",
            items: {
              $ref: "#/$defs/LiveSessionSnapshot",
            },
            type: "array",
          },
          loaded_transcripts: {
            default: [],
            description: "Transcript replays captured during `session/load`.",
            items: {
              $ref: "#/$defs/LoadedTranscriptSnapshot",
            },
            type: "array",
          },
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "The provider identifier.",
          },
        },
        required: [
          "provider",
          "connection_state",
          "discovery",
          "capabilities",
          "auth_methods",
          "live_sessions",
        ],
        type: "object",
      },
      ServerResponseFrameType: {
        description:
          "Stable string literal used by the generated consumer contract.",
        oneOf: [
          {
            const: "response",
            description:
              "The only supported literal value for this contract field.",
            type: "string",
          },
        ],
      },
      SessionCapabilities: {
        description:
          "Session capabilities supported by the agent.\n\nAs a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.\n\nOptionally, they **MAY** support other session methods and notifications by specifying additional capabilities.\n\nNote: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.\n\nSee protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          list: {
            anyOf: [
              {
                $ref: "#/$defs/SessionListCapabilities",
              },
              {
                type: "null",
              },
            ],
            description: "Whether the agent supports `session/list`.",
          },
        },
        type: "object",
      },
      SessionListCapabilities: {
        description:
          "Capabilities for the `session/list` method.\n\nBy supplying `{}` it means that the agent supports listing of sessions.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
        },
        type: "object",
      },
      TranscriptUpdateSnapshot: {
        description:
          "One replayed `session/update` captured during `session/load`.",
        properties: {
          index: {
            description:
              "Zero-based replay order within the loaded transcript.",
            format: "uint",
            minimum: 0,
            type: "integer",
          },
          update: {
            description:
              "The structurally serialized official ACP update payload.",
          },
          variant: {
            description:
              "Official ACP `SessionUpdate` discriminator value when known.",
            type: "string",
          },
        },
        required: ["index", "variant", "update"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Versioned WebSocket frame carrying a command response.",
    properties: {
      id: {
        description: "Correlation id echoed from the command.",
        minLength: 1,
        type: "string",
      },
      response: {
        $ref: "#/$defs/ConsumerResponse",
        description: "Consumer response payload.",
      },
      type: {
        $ref: "#/$defs/ServerResponseFrameType",
        description: "Stable frame discriminator.",
      },
      v: {
        description: "Transport protocol version.",
        format: "uint8",
        maximum: 1,
        minimum: 1,
        type: "integer",
      },
    },
    required: ["v", "type", "id", "response"],
    title: "ServerResponseFrame",
    type: "object",
  },
  SessionCancelRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/cancel`.",
    properties: {
      session_id: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["session_id"],
    title: "SessionCancelRequest",
    type: "object",
  },
  SessionConfigOption: {
    $defs: {
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "A session configuration option selector and its current state.",
    discriminator: {
      propertyName: "type",
    },
    oneOf: [
      {
        $ref: "#/$defs/SessionConfigSelect",
        description: "Single-value selector (dropdown).",
        properties: {
          type: {
            const: "select",
            type: "string",
          },
        },
        required: ["type"],
        type: "object",
      },
    ],
    properties: {
      _meta: {
        additionalProperties: true,
        description:
          "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
        type: ["object", "null"],
      },
      category: {
        anyOf: [
          {
            $ref: "#/$defs/SessionConfigOptionCategory",
          },
          {
            type: "null",
          },
        ],
        description: "Optional semantic category for this option (UX only).",
      },
      description: {
        description:
          "Optional description for the Client to display to the user.",
        type: ["string", "null"],
      },
      id: {
        $ref: "#/$defs/SessionConfigId",
        description: "Unique identifier for the configuration option.",
      },
      name: {
        description: "Human-readable label for the option.",
        type: "string",
      },
    },
    required: ["id", "name"],
    title: "SessionConfigOption",
    type: "object",
  },
  SessionGroup: {
    $defs: {
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionRow: {
        additionalProperties: false,
        description: "One session row inside a grouped session view.",
        properties: {
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Provider owning the session.",
          },
          sessionId: {
            description: "ACP session identifier.",
            type: "string",
          },
          title: {
            description: "Human-readable session title when available.",
            type: ["string", "null"],
          },
          updatedAt: {
            description: "Last activity timestamp when available.",
            type: ["string", "null"],
          },
        },
        required: ["provider", "sessionId"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "One grouped session-browser project view.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd represented by the group.",
        type: "string",
      },
      displayName: {
        description: "User-facing project label.",
        type: "string",
      },
      groupId: {
        description: "Stable project group identity.",
        type: "string",
      },
      sessions: {
        description: "Sessions currently grouped under the project.",
        items: {
          $ref: "#/$defs/SessionRow",
        },
        type: "array",
      },
    },
    required: ["groupId", "cwd", "displayName", "sessions"],
    title: "SessionGroup",
    type: "object",
  },
  SessionGroupsQuery: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Query parameters for `sessions/grouped`.",
    properties: {
      updatedWithinDays: {
        description: "Optional lookback window in days.",
        format: "uint64",
        maximum: 365,
        minimum: 1,
        type: ["integer", "null"],
      },
    },
    title: "SessionGroupsQuery",
    type: "object",
  },
  SessionGroupsView: {
    $defs: {
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
      SessionGroup: {
        additionalProperties: false,
        description: "One grouped session-browser project view.",
        properties: {
          cwd: {
            description: "Absolute normalized cwd represented by the group.",
            type: "string",
          },
          displayName: {
            description: "User-facing project label.",
            type: "string",
          },
          groupId: {
            description: "Stable project group identity.",
            type: "string",
          },
          sessions: {
            description: "Sessions currently grouped under the project.",
            items: {
              $ref: "#/$defs/SessionRow",
            },
            type: "array",
          },
        },
        required: ["groupId", "cwd", "displayName", "sessions"],
        type: "object",
      },
      SessionRow: {
        additionalProperties: false,
        description: "One session row inside a grouped session view.",
        properties: {
          provider: {
            $ref: "#/$defs/ProviderId",
            description: "Provider owning the session.",
          },
          sessionId: {
            description: "ACP session identifier.",
            type: "string",
          },
          title: {
            description: "Human-readable session title when available.",
            type: ["string", "null"],
          },
          updatedAt: {
            description: "Last activity timestamp when available.",
            type: ["string", "null"],
          },
        },
        required: ["provider", "sessionId"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Session browser grouped read model.",
    properties: {
      groups: {
        description: "Grouped projects and their sessions.",
        items: {
          $ref: "#/$defs/SessionGroup",
        },
        type: "array",
      },
      isRefreshing: {
        description: "Whether the view is still warming up in the background.",
        type: "boolean",
      },
      refreshedAt: {
        description: "Last refresh timestamp when available.",
        type: ["string", "null"],
      },
      revision: {
        description: "Session-index revision after the grouped projection.",
        format: "int64",
        type: "integer",
      },
    },
    required: ["revision", "isRefreshing", "groups"],
    title: "SessionGroupsView",
    type: "object",
  },
  SessionHistoryRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/history`.",
    properties: {
      cursor: {
        description: "Optional older-page cursor.",
        type: ["string", "null"],
      },
      limit: {
        description: "Optional history window size.",
        format: "uint64",
        minimum: 0,
        type: ["integer", "null"],
      },
      openSessionId: {
        description: "Open-session identity allocated by Conduit.",
        type: "string",
      },
    },
    required: ["openSessionId"],
    title: "SessionHistoryRequest",
    type: "object",
  },
  SessionHistoryWindow: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One transcript history window returned to UI consumers.",
    properties: {
      items: {
        description: "Window of transcript items in display order.",
        items: {
          $ref: "#/$defs/TranscriptItem",
        },
        type: "array",
      },
      nextCursor: {
        description: "Cursor for the next older page, when one exists.",
        type: ["string", "null"],
      },
      openSessionId: {
        description: "Opaque Conduit id for the opened session.",
        type: "string",
      },
      revision: {
        description: "Current timeline revision for this opened session.",
        format: "int64",
        type: "integer",
      },
    },
    required: ["openSessionId", "revision", "items"],
    title: "SessionHistoryWindow",
    type: "object",
  },
  SessionModeState: {
    $defs: {
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "The set of modes and the one currently active.",
    properties: {
      _meta: {
        additionalProperties: true,
        description:
          "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
        type: ["object", "null"],
      },
      availableModes: {
        description: "The set of modes that the Agent can operate in",
        items: {
          $ref: "#/$defs/SessionMode",
        },
        type: "array",
      },
      currentModeId: {
        $ref: "#/$defs/SessionModeId",
        description: "The current mode the Agent is in.",
      },
    },
    required: ["currentModeId", "availableModes"],
    title: "SessionModeState",
    type: "object",
  },
  SessionNewRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/new`.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd for the new session.",
        type: "string",
      },
      limit: {
        description: "Optional initial transcript window size.",
        format: "uint64",
        minimum: 0,
        type: ["integer", "null"],
      },
    },
    required: ["cwd"],
    title: "SessionNewRequest",
    type: "object",
  },
  SessionNewResult: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
      SessionHistoryWindow: {
        description: "One transcript history window returned to UI consumers.",
        properties: {
          items: {
            description: "Window of transcript items in display order.",
            items: {
              $ref: "#/$defs/TranscriptItem",
            },
            type: "array",
          },
          nextCursor: {
            description: "Cursor for the next older page, when one exists.",
            type: ["string", "null"],
          },
          openSessionId: {
            description: "Opaque Conduit id for the opened session.",
            type: "string",
          },
          revision: {
            description: "Current timeline revision for this opened session.",
            format: "int64",
            type: "integer",
          },
        },
        required: ["openSessionId", "revision", "items"],
        type: "object",
      },
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
      SessionModeState: {
        description: "The set of modes and the one currently active.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          availableModes: {
            description: "The set of modes that the Agent can operate in",
            items: {
              $ref: "#/$defs/SessionMode",
            },
            type: "array",
          },
          currentModeId: {
            $ref: "#/$defs/SessionModeId",
            description: "The current mode the Agent is in.",
          },
        },
        required: ["currentModeId", "availableModes"],
        type: "object",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Result payload for `session/new`.",
    properties: {
      configOptions: {
        description: "Session configuration options when available.",
        items: {
          $ref: "#/$defs/SessionConfigOption",
        },
        type: ["array", "null"],
      },
      history: {
        $ref: "#/$defs/SessionHistoryWindow",
        description: "Initial transcript history window.",
      },
      models: {
        description: "Provider model state when available.",
      },
      modes: {
        anyOf: [
          {
            $ref: "#/$defs/SessionModeState",
          },
          {
            type: "null",
          },
        ],
        description: "Official ACP mode state when available.",
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["sessionId", "history"],
    title: "SessionNewResult",
    type: "object",
  },
  SessionOpenRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/open`.",
    properties: {
      cwd: {
        description: "Absolute normalized cwd identity for the session.",
        type: "string",
      },
      limit: {
        description: "Optional transcript window size.",
        format: "uint64",
        minimum: 0,
        type: ["integer", "null"],
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["sessionId", "cwd"],
    title: "SessionOpenRequest",
    type: "object",
  },
  SessionOpenResult: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
      SessionModeState: {
        description: "The set of modes and the one currently active.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          availableModes: {
            description: "The set of modes that the Agent can operate in",
            items: {
              $ref: "#/$defs/SessionMode",
            },
            type: "array",
          },
          currentModeId: {
            $ref: "#/$defs/SessionModeId",
            description: "The current mode the Agent is in.",
          },
        },
        required: ["currentModeId", "availableModes"],
        type: "object",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItem: {
        description: "One projected transcript item for UI consumption.",
        oneOf: [
          {
            description: "User or agent ACP content.",
            properties: {
              content: {
                description: "ACP content blocks in transcript order.",
                items: {
                  $ref: "#/$defs/ContentBlock",
                },
                type: "array",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "message",
                type: "string",
              },
              role: {
                $ref: "#/$defs/MessageRole",
                description: "Message author role.",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
            },
            required: ["kind", "id", "role", "content"],
            type: "object",
          },
          {
            description:
              "Non-message ACP update represented as a collapsed event.",
            properties: {
              data: {
                description: "Structured ACP update payload.",
              },
              id: {
                description: "Stable item id within the loaded transcript.",
                type: "string",
              },
              kind: {
                const: "event",
                type: "string",
              },
              status: {
                anyOf: [
                  {
                    $ref: "#/$defs/TranscriptItemStatus",
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Live prompt item status when the item is part of a prompt turn.",
              },
              stopReason: {
                description:
                  "ACP stop reason for the completed turn, when known.",
                type: ["string", "null"],
              },
              turnId: {
                description:
                  "Prompt turn id when the item belongs to a live prompt turn.",
                type: ["string", "null"],
              },
              variant: {
                description: "Official ACP update variant.",
                type: "string",
              },
            },
            required: ["kind", "id", "variant", "data"],
            type: "object",
          },
        ],
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Result payload for `session/open`.",
    properties: {
      configOptions: {
        description: "Session configuration options when available.",
        items: {
          $ref: "#/$defs/SessionConfigOption",
        },
        type: ["array", "null"],
      },
      items: {
        description: "Window of transcript items in display order.",
        items: {
          $ref: "#/$defs/TranscriptItem",
        },
        type: "array",
      },
      models: {
        description: "Provider model state when available.",
      },
      modes: {
        anyOf: [
          {
            $ref: "#/$defs/SessionModeState",
          },
          {
            type: "null",
          },
        ],
        description: "Official ACP mode state when available.",
      },
      nextCursor: {
        description: "Cursor for the next older page when one exists.",
        type: ["string", "null"],
      },
      openSessionId: {
        description: "Open-session identity allocated by Conduit.",
        type: "string",
      },
      revision: {
        description: "Current history revision.",
        format: "int64",
        type: "integer",
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["sessionId", "openSessionId", "revision", "items"],
    title: "SessionOpenResult",
    type: "object",
  },
  SessionPromptRequest: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/prompt`.",
    properties: {
      openSessionId: {
        description: "Open-session identity allocated by Conduit.",
        type: "string",
      },
      prompt: {
        description: "ACP content blocks for the prompt.",
        items: {
          $ref: "#/$defs/ContentBlock",
        },
        type: "array",
      },
    },
    required: ["openSessionId", "prompt"],
    title: "SessionPromptRequest",
    type: "object",
  },
  SessionRow: {
    $defs: {
      ProviderId: {
        description: "The three providers supported by Conduit Phase 1.",
        oneOf: [
          {
            const: "claude",
            description: "Anthropic Claude via the official ACP adapter.",
            type: "string",
          },
          {
            const: "copilot",
            description: "GitHub Copilot via the official ACP adapter.",
            type: "string",
          },
          {
            const: "codex",
            description: "OpenAI Codex via the official ACP adapter.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "One session row inside a grouped session view.",
    properties: {
      provider: {
        $ref: "#/$defs/ProviderId",
        description: "Provider owning the session.",
      },
      sessionId: {
        description: "ACP session identifier.",
        type: "string",
      },
      title: {
        description: "Human-readable session title when available.",
        type: ["string", "null"],
      },
      updatedAt: {
        description: "Last activity timestamp when available.",
        type: ["string", "null"],
      },
    },
    required: ["provider", "sessionId"],
    title: "SessionRow",
    type: "object",
  },
  SessionSetConfigOptionRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/set_config_option`.",
    properties: {
      configId: {
        description: "ACP config option identifier.",
        type: "string",
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
      value: {
        description: "Selected config value identifier.",
        type: "string",
      },
    },
    required: ["sessionId", "configId", "value"],
    title: "SessionSetConfigOptionRequest",
    type: "object",
  },
  SessionSetConfigOptionResult: {
    $defs: {
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Result payload for `session/set_config_option`.",
    properties: {
      configOptions: {
        description: "Updated session configuration options.",
        items: {
          $ref: "#/$defs/SessionConfigOption",
        },
        type: "array",
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["sessionId", "configOptions"],
    title: "SessionSetConfigOptionResult",
    type: "object",
  },
  SessionStateProjection: {
    $defs: {
      SessionConfigGroupId: {
        description:
          "Unique identifier for a session configuration option value group.",
        type: "string",
      },
      SessionConfigId: {
        description: "Unique identifier for a session configuration option.",
        type: "string",
      },
      SessionConfigOption: {
        description:
          "A session configuration option selector and its current state.",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/SessionConfigSelect",
            description: "Single-value selector (dropdown).",
            properties: {
              type: {
                const: "select",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          category: {
            anyOf: [
              {
                $ref: "#/$defs/SessionConfigOptionCategory",
              },
              {
                type: "null",
              },
            ],
            description:
              "Optional semantic category for this option (UX only).",
          },
          description: {
            description:
              "Optional description for the Client to display to the user.",
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionConfigId",
            description: "Unique identifier for the configuration option.",
          },
          name: {
            description: "Human-readable label for the option.",
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionConfigOptionCategory: {
        anyOf: [
          {
            const: "mode",
            description: "Session mode selector.",
            type: "string",
          },
          {
            const: "model",
            description: "Model selector.",
            type: "string",
          },
          {
            const: "thought_level",
            description: "Thought/reasoning level selector.",
            type: "string",
          },
          {
            description: "Unknown / uncategorized selector.",
            type: "string",
          },
        ],
        description:
          "Semantic category for a session configuration option.\n\nThis is intended to help Clients distinguish broadly common selectors (e.g. model selector vs\nsession mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,\nplacement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown\ncategories gracefully.\n\nCategory names beginning with `_` are free for custom use, like other ACP extension methods.\nCategory names that do not begin with `_` are reserved for the ACP spec.",
      },
      SessionConfigSelect: {
        description:
          "A single-value selector (dropdown) session configuration option payload.",
        properties: {
          currentValue: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "The currently selected value.",
          },
          options: {
            $ref: "#/$defs/SessionConfigSelectOptions",
            description: "The set of selectable options.",
          },
        },
        required: ["currentValue", "options"],
        type: "object",
      },
      SessionConfigSelectGroup: {
        description:
          "A group of possible values for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          group: {
            $ref: "#/$defs/SessionConfigGroupId",
            description: "Unique identifier for this group.",
          },
          name: {
            description: "Human-readable label for this group.",
            type: "string",
          },
          options: {
            description: "The set of option values in this group.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
        },
        required: ["group", "name", "options"],
        type: "object",
      },
      SessionConfigSelectOption: {
        description: "A possible value for a session configuration option.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            description: "Optional description for this option value.",
            type: ["string", "null"],
          },
          name: {
            description: "Human-readable label for this option value.",
            type: "string",
          },
          value: {
            $ref: "#/$defs/SessionConfigValueId",
            description: "Unique identifier for this option value.",
          },
        },
        required: ["value", "name"],
        type: "object",
      },
      SessionConfigSelectOptions: {
        anyOf: [
          {
            description: "A flat list of options with no grouping.",
            items: {
              $ref: "#/$defs/SessionConfigSelectOption",
            },
            type: "array",
          },
          {
            description: "A list of options grouped under headers.",
            items: {
              $ref: "#/$defs/SessionConfigSelectGroup",
            },
            type: "array",
          },
        ],
        description: "Possible values for a session configuration option.",
      },
      SessionConfigValueId: {
        description:
          "Unique identifier for a session configuration option value.",
        type: "string",
      },
      SessionMode: {
        description:
          "A mode the agent can operate in.\n\nSee protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          id: {
            $ref: "#/$defs/SessionModeId",
          },
          name: {
            type: "string",
          },
        },
        required: ["id", "name"],
        type: "object",
      },
      SessionModeId: {
        description: "Unique identifier for a Session Mode.",
        type: "string",
      },
      SessionModeState: {
        description: "The set of modes and the one currently active.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          availableModes: {
            description: "The set of modes that the Agent can operate in",
            items: {
              $ref: "#/$defs/SessionMode",
            },
            type: "array",
          },
          currentModeId: {
            $ref: "#/$defs/SessionModeId",
            description: "The current mode the Agent is in.",
          },
        },
        required: ["currentModeId", "availableModes"],
        type: "object",
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Provider-backed state stored for session/open projections.",
    properties: {
      configOptions: {
        description: "Session configuration options when available.",
        items: {
          $ref: "#/$defs/SessionConfigOption",
        },
        type: ["array", "null"],
      },
      models: {
        description: "Provider model state when available.",
      },
      modes: {
        anyOf: [
          {
            $ref: "#/$defs/SessionModeState",
          },
          {
            type: "null",
          },
        ],
        description: "Official ACP mode state when available.",
      },
      sessionId: {
        description: "Provider ACP session identifier.",
        type: "string",
      },
    },
    required: ["sessionId"],
    title: "SessionStateProjection",
    type: "object",
  },
  SessionWatchRequest: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    description: "Request payload for `session/watch`.",
    properties: {
      openSessionId: {
        description: "Open-session identity allocated by Conduit.",
        type: "string",
      },
    },
    required: ["openSessionId"],
    title: "SessionWatchRequest",
    type: "object",
  },
  TranscriptItem: {
    $defs: {
      Annotations: {
        description:
          "Optional annotations for the client. The client can use annotations to inform how objects are used or displayed",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          audience: {
            items: {
              $ref: "#/$defs/Role",
            },
            type: ["array", "null"],
          },
          lastModified: {
            type: ["string", "null"],
          },
          priority: {
            format: "double",
            type: ["number", "null"],
          },
        },
        type: "object",
      },
      AudioContent: {
        description: "Audio provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      BlobResourceContents: {
        description: "Binary resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          blob: {
            type: "string",
          },
          mimeType: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["blob", "uri"],
        type: "object",
      },
      ContentBlock: {
        description:
          "Content blocks represent displayable information in the Agent Client Protocol.\n\nThey provide a structured way to handle various types of user-facing content—whether\nit's text from language models, images for analysis, or embedded resources for context.\n\nContent blocks appear in:\n- User prompts sent via `session/prompt`\n- Language model output streamed through `session/update` notifications\n- Progress updates and results from tool calls\n\nThis structure is compatible with the Model Context Protocol (MCP), enabling\nagents to seamlessly forward content from MCP tool outputs without transformation.\n\nSee protocol docs: [Content](https://agentclientprotocol.com/protocol/content)",
        discriminator: {
          propertyName: "type",
        },
        oneOf: [
          {
            $ref: "#/$defs/TextContent",
            description:
              "Text content. May be plain text or formatted with Markdown.\n\nAll agents MUST support text content blocks in prompts.\nClients SHOULD render this text as Markdown.",
            properties: {
              type: {
                const: "text",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ImageContent",
            description:
              "Images for visual context or analysis.\n\nRequires the `image` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "image",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/AudioContent",
            description:
              "Audio data for transcription or analysis.\n\nRequires the `audio` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "audio",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/ResourceLink",
            description:
              "References to resources that the agent can access.\n\nAll agents MUST support resource links in prompts.",
            properties: {
              type: {
                const: "resource_link",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
          {
            $ref: "#/$defs/EmbeddedResource",
            description:
              "Complete resource contents embedded directly in the message.\n\nPreferred for including context as it avoids extra round-trips.\n\nRequires the `embeddedContext` prompt capability when included in prompts.",
            properties: {
              type: {
                const: "resource",
                type: "string",
              },
            },
            required: ["type"],
            type: "object",
          },
        ],
      },
      EmbeddedResource: {
        description:
          "The contents of a resource, embedded into a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          resource: {
            $ref: "#/$defs/EmbeddedResourceResource",
          },
        },
        required: ["resource"],
        type: "object",
      },
      EmbeddedResourceResource: {
        anyOf: [
          {
            $ref: "#/$defs/TextResourceContents",
          },
          {
            $ref: "#/$defs/BlobResourceContents",
          },
        ],
        description: "Resource content that can be embedded in a message.",
      },
      ImageContent: {
        description: "An image provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          data: {
            type: "string",
          },
          mimeType: {
            type: "string",
          },
          uri: {
            type: ["string", "null"],
          },
        },
        required: ["data", "mimeType"],
        type: "object",
      },
      MessageRole: {
        description: "Author role for projected transcript messages.",
        oneOf: [
          {
            const: "user",
            description: "User-authored text.",
            type: "string",
          },
          {
            const: "agent",
            description: "Agent-authored text.",
            type: "string",
          },
        ],
      },
      ResourceLink: {
        description:
          "A resource that the server is capable of reading, included in a prompt or tool call result.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          description: {
            type: ["string", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          name: {
            type: "string",
          },
          size: {
            format: "int64",
            type: ["integer", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          uri: {
            type: "string",
          },
        },
        required: ["name", "uri"],
        type: "object",
      },
      Role: {
        description:
          "The sender or recipient of messages and data in a conversation.",
        enum: ["assistant", "user"],
        type: "string",
      },
      TextContent: {
        description: "Text provided to or from an LLM.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          annotations: {
            anyOf: [
              {
                $ref: "#/$defs/Annotations",
              },
              {
                type: "null",
              },
            ],
          },
          text: {
            type: "string",
          },
        },
        required: ["text"],
        type: "object",
      },
      TextResourceContents: {
        description: "Text-based resource contents.",
        properties: {
          _meta: {
            additionalProperties: true,
            description:
              "The _meta property is reserved by ACP to allow clients and agents to attach additional\nmetadata to their interactions. Implementations MUST NOT make assumptions about values at\nthese keys.\n\nSee protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)",
            type: ["object", "null"],
          },
          mimeType: {
            type: ["string", "null"],
          },
          text: {
            type: "string",
          },
          uri: {
            type: "string",
          },
        },
        required: ["text", "uri"],
        type: "object",
      },
      TranscriptItemStatus: {
        description: "Status for prompt-turn transcript items.",
        oneOf: [
          {
            const: "complete",
            description: "The item is complete.",
            type: "string",
          },
          {
            const: "streaming",
            description: "The item is still streaming.",
            type: "string",
          },
          {
            const: "cancelled",
            description: "The item was cancelled before normal completion.",
            type: "string",
          },
          {
            const: "failed",
            description: "The item failed before normal completion.",
            type: "string",
          },
        ],
      },
    },
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description: "One projected transcript item for UI consumption.",
    oneOf: [
      {
        description: "User or agent ACP content.",
        properties: {
          content: {
            description: "ACP content blocks in transcript order.",
            items: {
              $ref: "#/$defs/ContentBlock",
            },
            type: "array",
          },
          id: {
            description: "Stable item id within the loaded transcript.",
            type: "string",
          },
          kind: {
            const: "message",
            type: "string",
          },
          role: {
            $ref: "#/$defs/MessageRole",
            description: "Message author role.",
          },
          status: {
            anyOf: [
              {
                $ref: "#/$defs/TranscriptItemStatus",
              },
              {
                type: "null",
              },
            ],
            description:
              "Live prompt item status when the item is part of a prompt turn.",
          },
          stopReason: {
            description: "ACP stop reason for the completed turn, when known.",
            type: ["string", "null"],
          },
          turnId: {
            description:
              "Prompt turn id when the item belongs to a live prompt turn.",
            type: ["string", "null"],
          },
        },
        required: ["kind", "id", "role", "content"],
        type: "object",
      },
      {
        description: "Non-message ACP update represented as a collapsed event.",
        properties: {
          data: {
            description: "Structured ACP update payload.",
          },
          id: {
            description: "Stable item id within the loaded transcript.",
            type: "string",
          },
          kind: {
            const: "event",
            type: "string",
          },
          status: {
            anyOf: [
              {
                $ref: "#/$defs/TranscriptItemStatus",
              },
              {
                type: "null",
              },
            ],
            description:
              "Live prompt item status when the item is part of a prompt turn.",
          },
          stopReason: {
            description: "ACP stop reason for the completed turn, when known.",
            type: ["string", "null"],
          },
          turnId: {
            description:
              "Prompt turn id when the item belongs to a live prompt turn.",
            type: ["string", "null"],
          },
          variant: {
            description: "Official ACP update variant.",
            type: "string",
          },
        },
        required: ["kind", "id", "variant", "data"],
        type: "object",
      },
    ],
    title: "TranscriptItem",
  },
  TranscriptUpdateSnapshot: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    description:
      "One replayed `session/update` captured during `session/load`.",
    properties: {
      index: {
        description: "Zero-based replay order within the loaded transcript.",
        format: "uint",
        minimum: 0,
        type: "integer",
      },
      update: {
        description: "The structurally serialized official ACP update payload.",
      },
      variant: {
        description:
          "Official ACP `SessionUpdate` discriminator value when known.",
        type: "string",
      },
    },
    required: ["index", "variant", "update"],
    title: "TranscriptUpdateSnapshot",
    type: "object",
  },
} as const;

type ContractName =
  | "ClientCommandFrame"
  | "ConnectionState"
  | "ConsumerCommand"
  | "ConsumerCommandName"
  | "ConsumerCommandTarget"
  | "ConsumerError"
  | "ConsumerResponse"
  | "ContentBlock"
  | "EmptyParams"
  | "GlobalProviderTarget"
  | "GlobalSettingsUpdateRequest"
  | "GlobalSettingsView"
  | "LauncherCommand"
  | "LiveSessionIdentity"
  | "LiveSessionSnapshot"
  | "LoadedTranscriptSnapshot"
  | "ProjectAddRequest"
  | "ProjectListView"
  | "ProjectRemoveRequest"
  | "ProjectRow"
  | "ProjectSuggestion"
  | "ProjectSuggestionsQuery"
  | "ProjectSuggestionsView"
  | "ProjectUpdateRequest"
  | "PromptLifecycleSnapshot"
  | "PromptLifecycleState"
  | "ProviderConfigSnapshotEntry"
  | "ProviderConfigSnapshotStatus"
  | "ProviderDiscovery"
  | "ProviderId"
  | "ProviderSnapshot"
  | "ProvidersConfigSnapshotResult"
  | "RawWireEvent"
  | "RuntimeEvent"
  | "ServerEventFrame"
  | "ServerFrame"
  | "ServerResponseFrame"
  | "SessionCancelRequest"
  | "SessionConfigOption"
  | "SessionGroup"
  | "SessionGroupsQuery"
  | "SessionGroupsView"
  | "SessionHistoryRequest"
  | "SessionHistoryWindow"
  | "SessionModeState"
  | "SessionNewRequest"
  | "SessionNewResult"
  | "SessionOpenRequest"
  | "SessionOpenResult"
  | "SessionPromptRequest"
  | "SessionRow"
  | "SessionSetConfigOptionRequest"
  | "SessionSetConfigOptionResult"
  | "SessionStateProjection"
  | "SessionWatchRequest"
  | "TranscriptItem"
  | "TranscriptUpdateSnapshot";

interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

interface SafeParseFailure {
  success: false;
  error: Error;
}

type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

interface GeneratedSchema<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): SafeParseResult<T>;
}

type Ajv2020Constructor = new (options?: Options) => {
  compile(schema: object): ValidateFunction;
};
const ajv = new (Ajv2020 as unknown as Ajv2020Constructor)({
  allErrors: true,
  allowUnionTypes: true,
  discriminator: true,
  strict: true,
  strictTypes: false,
  strictTuples: false,
  validateFormats: false,
}) as {
  addKeyword(keyword: string): unknown;
  compile(schema: object): ValidateFunction;
};
ajv.addKeyword("x-method");
ajv.addKeyword("x-side");
const validators = {} as Record<ContractName, ValidateFunction>;
validators.ClientCommandFrame = ajv.compile(
  contractSchemas.ClientCommandFrame,
) as ValidateFunction;
validators.ConnectionState = ajv.compile(
  contractSchemas.ConnectionState,
) as ValidateFunction;
validators.ConsumerCommand = ajv.compile(
  contractSchemas.ConsumerCommand,
) as ValidateFunction;
validators.ConsumerCommandName = ajv.compile(
  contractSchemas.ConsumerCommandName,
) as ValidateFunction;
validators.ConsumerCommandTarget = ajv.compile(
  contractSchemas.ConsumerCommandTarget,
) as ValidateFunction;
validators.ConsumerError = ajv.compile(
  contractSchemas.ConsumerError,
) as ValidateFunction;
validators.ConsumerResponse = ajv.compile(
  contractSchemas.ConsumerResponse,
) as ValidateFunction;
validators.ContentBlock = ajv.compile(
  contractSchemas.ContentBlock,
) as ValidateFunction;
validators.EmptyParams = ajv.compile(
  contractSchemas.EmptyParams,
) as ValidateFunction;
validators.GlobalProviderTarget = ajv.compile(
  contractSchemas.GlobalProviderTarget,
) as ValidateFunction;
validators.GlobalSettingsUpdateRequest = ajv.compile(
  contractSchemas.GlobalSettingsUpdateRequest,
) as ValidateFunction;
validators.GlobalSettingsView = ajv.compile(
  contractSchemas.GlobalSettingsView,
) as ValidateFunction;
validators.LauncherCommand = ajv.compile(
  contractSchemas.LauncherCommand,
) as ValidateFunction;
validators.LiveSessionIdentity = ajv.compile(
  contractSchemas.LiveSessionIdentity,
) as ValidateFunction;
validators.LiveSessionSnapshot = ajv.compile(
  contractSchemas.LiveSessionSnapshot,
) as ValidateFunction;
validators.LoadedTranscriptSnapshot = ajv.compile(
  contractSchemas.LoadedTranscriptSnapshot,
) as ValidateFunction;
validators.ProjectAddRequest = ajv.compile(
  contractSchemas.ProjectAddRequest,
) as ValidateFunction;
validators.ProjectListView = ajv.compile(
  contractSchemas.ProjectListView,
) as ValidateFunction;
validators.ProjectRemoveRequest = ajv.compile(
  contractSchemas.ProjectRemoveRequest,
) as ValidateFunction;
validators.ProjectRow = ajv.compile(
  contractSchemas.ProjectRow,
) as ValidateFunction;
validators.ProjectSuggestion = ajv.compile(
  contractSchemas.ProjectSuggestion,
) as ValidateFunction;
validators.ProjectSuggestionsQuery = ajv.compile(
  contractSchemas.ProjectSuggestionsQuery,
) as ValidateFunction;
validators.ProjectSuggestionsView = ajv.compile(
  contractSchemas.ProjectSuggestionsView,
) as ValidateFunction;
validators.ProjectUpdateRequest = ajv.compile(
  contractSchemas.ProjectUpdateRequest,
) as ValidateFunction;
validators.PromptLifecycleSnapshot = ajv.compile(
  contractSchemas.PromptLifecycleSnapshot,
) as ValidateFunction;
validators.PromptLifecycleState = ajv.compile(
  contractSchemas.PromptLifecycleState,
) as ValidateFunction;
validators.ProviderConfigSnapshotEntry = ajv.compile(
  contractSchemas.ProviderConfigSnapshotEntry,
) as ValidateFunction;
validators.ProviderConfigSnapshotStatus = ajv.compile(
  contractSchemas.ProviderConfigSnapshotStatus,
) as ValidateFunction;
validators.ProviderDiscovery = ajv.compile(
  contractSchemas.ProviderDiscovery,
) as ValidateFunction;
validators.ProviderId = ajv.compile(
  contractSchemas.ProviderId,
) as ValidateFunction;
validators.ProviderSnapshot = ajv.compile(
  contractSchemas.ProviderSnapshot,
) as ValidateFunction;
validators.ProvidersConfigSnapshotResult = ajv.compile(
  contractSchemas.ProvidersConfigSnapshotResult,
) as ValidateFunction;
validators.RawWireEvent = ajv.compile(
  contractSchemas.RawWireEvent,
) as ValidateFunction;
validators.RuntimeEvent = ajv.compile(
  contractSchemas.RuntimeEvent,
) as ValidateFunction;
validators.ServerEventFrame = ajv.compile(
  contractSchemas.ServerEventFrame,
) as ValidateFunction;
validators.ServerFrame = ajv.compile(
  contractSchemas.ServerFrame,
) as ValidateFunction;
validators.ServerResponseFrame = ajv.compile(
  contractSchemas.ServerResponseFrame,
) as ValidateFunction;
validators.SessionCancelRequest = ajv.compile(
  contractSchemas.SessionCancelRequest,
) as ValidateFunction;
validators.SessionConfigOption = ajv.compile(
  contractSchemas.SessionConfigOption,
) as ValidateFunction;
validators.SessionGroup = ajv.compile(
  contractSchemas.SessionGroup,
) as ValidateFunction;
validators.SessionGroupsQuery = ajv.compile(
  contractSchemas.SessionGroupsQuery,
) as ValidateFunction;
validators.SessionGroupsView = ajv.compile(
  contractSchemas.SessionGroupsView,
) as ValidateFunction;
validators.SessionHistoryRequest = ajv.compile(
  contractSchemas.SessionHistoryRequest,
) as ValidateFunction;
validators.SessionHistoryWindow = ajv.compile(
  contractSchemas.SessionHistoryWindow,
) as ValidateFunction;
validators.SessionModeState = ajv.compile(
  contractSchemas.SessionModeState,
) as ValidateFunction;
validators.SessionNewRequest = ajv.compile(
  contractSchemas.SessionNewRequest,
) as ValidateFunction;
validators.SessionNewResult = ajv.compile(
  contractSchemas.SessionNewResult,
) as ValidateFunction;
validators.SessionOpenRequest = ajv.compile(
  contractSchemas.SessionOpenRequest,
) as ValidateFunction;
validators.SessionOpenResult = ajv.compile(
  contractSchemas.SessionOpenResult,
) as ValidateFunction;
validators.SessionPromptRequest = ajv.compile(
  contractSchemas.SessionPromptRequest,
) as ValidateFunction;
validators.SessionRow = ajv.compile(
  contractSchemas.SessionRow,
) as ValidateFunction;
validators.SessionSetConfigOptionRequest = ajv.compile(
  contractSchemas.SessionSetConfigOptionRequest,
) as ValidateFunction;
validators.SessionSetConfigOptionResult = ajv.compile(
  contractSchemas.SessionSetConfigOptionResult,
) as ValidateFunction;
validators.SessionStateProjection = ajv.compile(
  contractSchemas.SessionStateProjection,
) as ValidateFunction;
validators.SessionWatchRequest = ajv.compile(
  contractSchemas.SessionWatchRequest,
) as ValidateFunction;
validators.TranscriptItem = ajv.compile(
  contractSchemas.TranscriptItem,
) as ValidateFunction;
validators.TranscriptUpdateSnapshot = ajv.compile(
  contractSchemas.TranscriptUpdateSnapshot,
) as ValidateFunction;

function validationError(contract: ContractName, value: unknown): Error {
  const validator = validators[contract];
  const message =
    validator.errors
      ?.map((error) => {
        const path =
          error.instancePath.length === 0 ? "$" : "$" + error.instancePath;
        return path + ": " + (error.message ?? "invalid value");
      })
      .join("; ") ?? contract + " is invalid";
  return new Error(message);
}

function parseContract<T>(contract: ContractName, value: unknown): T {
  const validator = validators[contract];
  if (validator(value)) {
    return value as T;
  }
  throw validationError(contract, value);
}

function safeParseContract<T>(
  contract: ContractName,
  value: unknown,
): SafeParseResult<T> {
  try {
    return {
      success: true,
      data: parseContract<T>(contract, value),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function isContract<T>(contract: ContractName, value: unknown): value is T {
  return validators[contract](value) === true;
}

export function parseClientCommandFrame(value: unknown): ClientCommandFrame {
  return parseContract<ClientCommandFrame>("ClientCommandFrame", value);
}

export function isClientCommandFrame(
  value: unknown,
): value is ClientCommandFrame {
  return isContract<ClientCommandFrame>("ClientCommandFrame", value);
}

export const ClientCommandFrameSchema: GeneratedSchema<ClientCommandFrame> = {
  parse(value: unknown): ClientCommandFrame {
    return parseClientCommandFrame(value);
  },
  safeParse(value: unknown): SafeParseResult<ClientCommandFrame> {
    return safeParseContract<ClientCommandFrame>("ClientCommandFrame", value);
  },
};

export function parseConnectionState(value: unknown): ConnectionState {
  return parseContract<ConnectionState>("ConnectionState", value);
}

export function isConnectionState(value: unknown): value is ConnectionState {
  return isContract<ConnectionState>("ConnectionState", value);
}

export const ConnectionStateSchema: GeneratedSchema<ConnectionState> = {
  parse(value: unknown): ConnectionState {
    return parseConnectionState(value);
  },
  safeParse(value: unknown): SafeParseResult<ConnectionState> {
    return safeParseContract<ConnectionState>("ConnectionState", value);
  },
};

export function parseConsumerCommand(value: unknown): ConsumerCommand {
  return parseContract<ConsumerCommand>("ConsumerCommand", value);
}

export function isConsumerCommand(value: unknown): value is ConsumerCommand {
  return isContract<ConsumerCommand>("ConsumerCommand", value);
}

export const ConsumerCommandSchema: GeneratedSchema<ConsumerCommand> = {
  parse(value: unknown): ConsumerCommand {
    return parseConsumerCommand(value);
  },
  safeParse(value: unknown): SafeParseResult<ConsumerCommand> {
    return safeParseContract<ConsumerCommand>("ConsumerCommand", value);
  },
};

export function parseConsumerCommandName(value: unknown): ConsumerCommandName {
  return parseContract<ConsumerCommandName>("ConsumerCommandName", value);
}

export function isConsumerCommandName(
  value: unknown,
): value is ConsumerCommandName {
  return isContract<ConsumerCommandName>("ConsumerCommandName", value);
}

export const ConsumerCommandNameSchema: GeneratedSchema<ConsumerCommandName> = {
  parse(value: unknown): ConsumerCommandName {
    return parseConsumerCommandName(value);
  },
  safeParse(value: unknown): SafeParseResult<ConsumerCommandName> {
    return safeParseContract<ConsumerCommandName>("ConsumerCommandName", value);
  },
};

export function parseConsumerCommandTarget(
  value: unknown,
): ConsumerCommandTarget {
  return parseContract<ConsumerCommandTarget>("ConsumerCommandTarget", value);
}

export function isConsumerCommandTarget(
  value: unknown,
): value is ConsumerCommandTarget {
  return isContract<ConsumerCommandTarget>("ConsumerCommandTarget", value);
}

export const ConsumerCommandTargetSchema: GeneratedSchema<ConsumerCommandTarget> =
  {
    parse(value: unknown): ConsumerCommandTarget {
      return parseConsumerCommandTarget(value);
    },
    safeParse(value: unknown): SafeParseResult<ConsumerCommandTarget> {
      return safeParseContract<ConsumerCommandTarget>(
        "ConsumerCommandTarget",
        value,
      );
    },
  };

export function parseConsumerError(value: unknown): ConsumerError {
  return parseContract<ConsumerError>("ConsumerError", value);
}

export function isConsumerError(value: unknown): value is ConsumerError {
  return isContract<ConsumerError>("ConsumerError", value);
}

export const ConsumerErrorSchema: GeneratedSchema<ConsumerError> = {
  parse(value: unknown): ConsumerError {
    return parseConsumerError(value);
  },
  safeParse(value: unknown): SafeParseResult<ConsumerError> {
    return safeParseContract<ConsumerError>("ConsumerError", value);
  },
};

export function parseConsumerResponse(value: unknown): ConsumerResponse {
  return parseContract<ConsumerResponse>("ConsumerResponse", value);
}

export function isConsumerResponse(value: unknown): value is ConsumerResponse {
  return isContract<ConsumerResponse>("ConsumerResponse", value);
}

export const ConsumerResponseSchema: GeneratedSchema<ConsumerResponse> = {
  parse(value: unknown): ConsumerResponse {
    return parseConsumerResponse(value);
  },
  safeParse(value: unknown): SafeParseResult<ConsumerResponse> {
    return safeParseContract<ConsumerResponse>("ConsumerResponse", value);
  },
};

export function parseContentBlock(value: unknown): ContentBlock {
  return parseContract<ContentBlock>("ContentBlock", value);
}

export function isContentBlock(value: unknown): value is ContentBlock {
  return isContract<ContentBlock>("ContentBlock", value);
}

export const ContentBlockSchema: GeneratedSchema<ContentBlock> = {
  parse(value: unknown): ContentBlock {
    return parseContentBlock(value);
  },
  safeParse(value: unknown): SafeParseResult<ContentBlock> {
    return safeParseContract<ContentBlock>("ContentBlock", value);
  },
};

export function parseEmptyParams(value: unknown): EmptyParams {
  return parseContract<EmptyParams>("EmptyParams", value);
}

export function isEmptyParams(value: unknown): value is EmptyParams {
  return isContract<EmptyParams>("EmptyParams", value);
}

export const EmptyParamsSchema: GeneratedSchema<EmptyParams> = {
  parse(value: unknown): EmptyParams {
    return parseEmptyParams(value);
  },
  safeParse(value: unknown): SafeParseResult<EmptyParams> {
    return safeParseContract<EmptyParams>("EmptyParams", value);
  },
};

export function parseGlobalProviderTarget(
  value: unknown,
): GlobalProviderTarget {
  return parseContract<GlobalProviderTarget>("GlobalProviderTarget", value);
}

export function isGlobalProviderTarget(
  value: unknown,
): value is GlobalProviderTarget {
  return isContract<GlobalProviderTarget>("GlobalProviderTarget", value);
}

export const GlobalProviderTargetSchema: GeneratedSchema<GlobalProviderTarget> =
  {
    parse(value: unknown): GlobalProviderTarget {
      return parseGlobalProviderTarget(value);
    },
    safeParse(value: unknown): SafeParseResult<GlobalProviderTarget> {
      return safeParseContract<GlobalProviderTarget>(
        "GlobalProviderTarget",
        value,
      );
    },
  };

export function parseGlobalSettingsUpdateRequest(
  value: unknown,
): GlobalSettingsUpdateRequest {
  return parseContract<GlobalSettingsUpdateRequest>(
    "GlobalSettingsUpdateRequest",
    value,
  );
}

export function isGlobalSettingsUpdateRequest(
  value: unknown,
): value is GlobalSettingsUpdateRequest {
  return isContract<GlobalSettingsUpdateRequest>(
    "GlobalSettingsUpdateRequest",
    value,
  );
}

export const GlobalSettingsUpdateRequestSchema: GeneratedSchema<GlobalSettingsUpdateRequest> =
  {
    parse(value: unknown): GlobalSettingsUpdateRequest {
      return parseGlobalSettingsUpdateRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<GlobalSettingsUpdateRequest> {
      return safeParseContract<GlobalSettingsUpdateRequest>(
        "GlobalSettingsUpdateRequest",
        value,
      );
    },
  };

export function parseGlobalSettingsView(value: unknown): GlobalSettingsView {
  return parseContract<GlobalSettingsView>("GlobalSettingsView", value);
}

export function isGlobalSettingsView(
  value: unknown,
): value is GlobalSettingsView {
  return isContract<GlobalSettingsView>("GlobalSettingsView", value);
}

export const GlobalSettingsViewSchema: GeneratedSchema<GlobalSettingsView> = {
  parse(value: unknown): GlobalSettingsView {
    return parseGlobalSettingsView(value);
  },
  safeParse(value: unknown): SafeParseResult<GlobalSettingsView> {
    return safeParseContract<GlobalSettingsView>("GlobalSettingsView", value);
  },
};

export function parseLauncherCommand(value: unknown): LauncherCommand {
  return parseContract<LauncherCommand>("LauncherCommand", value);
}

export function isLauncherCommand(value: unknown): value is LauncherCommand {
  return isContract<LauncherCommand>("LauncherCommand", value);
}

export const LauncherCommandSchema: GeneratedSchema<LauncherCommand> = {
  parse(value: unknown): LauncherCommand {
    return parseLauncherCommand(value);
  },
  safeParse(value: unknown): SafeParseResult<LauncherCommand> {
    return safeParseContract<LauncherCommand>("LauncherCommand", value);
  },
};

export function parseLiveSessionIdentity(value: unknown): LiveSessionIdentity {
  return parseContract<LiveSessionIdentity>("LiveSessionIdentity", value);
}

export function isLiveSessionIdentity(
  value: unknown,
): value is LiveSessionIdentity {
  return isContract<LiveSessionIdentity>("LiveSessionIdentity", value);
}

export const LiveSessionIdentitySchema: GeneratedSchema<LiveSessionIdentity> = {
  parse(value: unknown): LiveSessionIdentity {
    return parseLiveSessionIdentity(value);
  },
  safeParse(value: unknown): SafeParseResult<LiveSessionIdentity> {
    return safeParseContract<LiveSessionIdentity>("LiveSessionIdentity", value);
  },
};

export function parseLiveSessionSnapshot(value: unknown): LiveSessionSnapshot {
  return parseContract<LiveSessionSnapshot>("LiveSessionSnapshot", value);
}

export function isLiveSessionSnapshot(
  value: unknown,
): value is LiveSessionSnapshot {
  return isContract<LiveSessionSnapshot>("LiveSessionSnapshot", value);
}

export const LiveSessionSnapshotSchema: GeneratedSchema<LiveSessionSnapshot> = {
  parse(value: unknown): LiveSessionSnapshot {
    return parseLiveSessionSnapshot(value);
  },
  safeParse(value: unknown): SafeParseResult<LiveSessionSnapshot> {
    return safeParseContract<LiveSessionSnapshot>("LiveSessionSnapshot", value);
  },
};

export function parseLoadedTranscriptSnapshot(
  value: unknown,
): LoadedTranscriptSnapshot {
  return parseContract<LoadedTranscriptSnapshot>(
    "LoadedTranscriptSnapshot",
    value,
  );
}

export function isLoadedTranscriptSnapshot(
  value: unknown,
): value is LoadedTranscriptSnapshot {
  return isContract<LoadedTranscriptSnapshot>(
    "LoadedTranscriptSnapshot",
    value,
  );
}

export const LoadedTranscriptSnapshotSchema: GeneratedSchema<LoadedTranscriptSnapshot> =
  {
    parse(value: unknown): LoadedTranscriptSnapshot {
      return parseLoadedTranscriptSnapshot(value);
    },
    safeParse(value: unknown): SafeParseResult<LoadedTranscriptSnapshot> {
      return safeParseContract<LoadedTranscriptSnapshot>(
        "LoadedTranscriptSnapshot",
        value,
      );
    },
  };

export function parseProjectAddRequest(value: unknown): ProjectAddRequest {
  return parseContract<ProjectAddRequest>("ProjectAddRequest", value);
}

export function isProjectAddRequest(
  value: unknown,
): value is ProjectAddRequest {
  return isContract<ProjectAddRequest>("ProjectAddRequest", value);
}

export const ProjectAddRequestSchema: GeneratedSchema<ProjectAddRequest> = {
  parse(value: unknown): ProjectAddRequest {
    return parseProjectAddRequest(value);
  },
  safeParse(value: unknown): SafeParseResult<ProjectAddRequest> {
    return safeParseContract<ProjectAddRequest>("ProjectAddRequest", value);
  },
};

export function parseProjectListView(value: unknown): ProjectListView {
  return parseContract<ProjectListView>("ProjectListView", value);
}

export function isProjectListView(value: unknown): value is ProjectListView {
  return isContract<ProjectListView>("ProjectListView", value);
}

export const ProjectListViewSchema: GeneratedSchema<ProjectListView> = {
  parse(value: unknown): ProjectListView {
    return parseProjectListView(value);
  },
  safeParse(value: unknown): SafeParseResult<ProjectListView> {
    return safeParseContract<ProjectListView>("ProjectListView", value);
  },
};

export function parseProjectRemoveRequest(
  value: unknown,
): ProjectRemoveRequest {
  return parseContract<ProjectRemoveRequest>("ProjectRemoveRequest", value);
}

export function isProjectRemoveRequest(
  value: unknown,
): value is ProjectRemoveRequest {
  return isContract<ProjectRemoveRequest>("ProjectRemoveRequest", value);
}

export const ProjectRemoveRequestSchema: GeneratedSchema<ProjectRemoveRequest> =
  {
    parse(value: unknown): ProjectRemoveRequest {
      return parseProjectRemoveRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<ProjectRemoveRequest> {
      return safeParseContract<ProjectRemoveRequest>(
        "ProjectRemoveRequest",
        value,
      );
    },
  };

export function parseProjectRow(value: unknown): ProjectRow {
  return parseContract<ProjectRow>("ProjectRow", value);
}

export function isProjectRow(value: unknown): value is ProjectRow {
  return isContract<ProjectRow>("ProjectRow", value);
}

export const ProjectRowSchema: GeneratedSchema<ProjectRow> = {
  parse(value: unknown): ProjectRow {
    return parseProjectRow(value);
  },
  safeParse(value: unknown): SafeParseResult<ProjectRow> {
    return safeParseContract<ProjectRow>("ProjectRow", value);
  },
};

export function parseProjectSuggestion(value: unknown): ProjectSuggestion {
  return parseContract<ProjectSuggestion>("ProjectSuggestion", value);
}

export function isProjectSuggestion(
  value: unknown,
): value is ProjectSuggestion {
  return isContract<ProjectSuggestion>("ProjectSuggestion", value);
}

export const ProjectSuggestionSchema: GeneratedSchema<ProjectSuggestion> = {
  parse(value: unknown): ProjectSuggestion {
    return parseProjectSuggestion(value);
  },
  safeParse(value: unknown): SafeParseResult<ProjectSuggestion> {
    return safeParseContract<ProjectSuggestion>("ProjectSuggestion", value);
  },
};

export function parseProjectSuggestionsQuery(
  value: unknown,
): ProjectSuggestionsQuery {
  return parseContract<ProjectSuggestionsQuery>(
    "ProjectSuggestionsQuery",
    value,
  );
}

export function isProjectSuggestionsQuery(
  value: unknown,
): value is ProjectSuggestionsQuery {
  return isContract<ProjectSuggestionsQuery>("ProjectSuggestionsQuery", value);
}

export const ProjectSuggestionsQuerySchema: GeneratedSchema<ProjectSuggestionsQuery> =
  {
    parse(value: unknown): ProjectSuggestionsQuery {
      return parseProjectSuggestionsQuery(value);
    },
    safeParse(value: unknown): SafeParseResult<ProjectSuggestionsQuery> {
      return safeParseContract<ProjectSuggestionsQuery>(
        "ProjectSuggestionsQuery",
        value,
      );
    },
  };

export function parseProjectSuggestionsView(
  value: unknown,
): ProjectSuggestionsView {
  return parseContract<ProjectSuggestionsView>("ProjectSuggestionsView", value);
}

export function isProjectSuggestionsView(
  value: unknown,
): value is ProjectSuggestionsView {
  return isContract<ProjectSuggestionsView>("ProjectSuggestionsView", value);
}

export const ProjectSuggestionsViewSchema: GeneratedSchema<ProjectSuggestionsView> =
  {
    parse(value: unknown): ProjectSuggestionsView {
      return parseProjectSuggestionsView(value);
    },
    safeParse(value: unknown): SafeParseResult<ProjectSuggestionsView> {
      return safeParseContract<ProjectSuggestionsView>(
        "ProjectSuggestionsView",
        value,
      );
    },
  };

export function parseProjectUpdateRequest(
  value: unknown,
): ProjectUpdateRequest {
  return parseContract<ProjectUpdateRequest>("ProjectUpdateRequest", value);
}

export function isProjectUpdateRequest(
  value: unknown,
): value is ProjectUpdateRequest {
  return isContract<ProjectUpdateRequest>("ProjectUpdateRequest", value);
}

export const ProjectUpdateRequestSchema: GeneratedSchema<ProjectUpdateRequest> =
  {
    parse(value: unknown): ProjectUpdateRequest {
      return parseProjectUpdateRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<ProjectUpdateRequest> {
      return safeParseContract<ProjectUpdateRequest>(
        "ProjectUpdateRequest",
        value,
      );
    },
  };

export function parsePromptLifecycleSnapshot(
  value: unknown,
): PromptLifecycleSnapshot {
  return parseContract<PromptLifecycleSnapshot>(
    "PromptLifecycleSnapshot",
    value,
  );
}

export function isPromptLifecycleSnapshot(
  value: unknown,
): value is PromptLifecycleSnapshot {
  return isContract<PromptLifecycleSnapshot>("PromptLifecycleSnapshot", value);
}

export const PromptLifecycleSnapshotSchema: GeneratedSchema<PromptLifecycleSnapshot> =
  {
    parse(value: unknown): PromptLifecycleSnapshot {
      return parsePromptLifecycleSnapshot(value);
    },
    safeParse(value: unknown): SafeParseResult<PromptLifecycleSnapshot> {
      return safeParseContract<PromptLifecycleSnapshot>(
        "PromptLifecycleSnapshot",
        value,
      );
    },
  };

export function parsePromptLifecycleState(
  value: unknown,
): PromptLifecycleState {
  return parseContract<PromptLifecycleState>("PromptLifecycleState", value);
}

export function isPromptLifecycleState(
  value: unknown,
): value is PromptLifecycleState {
  return isContract<PromptLifecycleState>("PromptLifecycleState", value);
}

export const PromptLifecycleStateSchema: GeneratedSchema<PromptLifecycleState> =
  {
    parse(value: unknown): PromptLifecycleState {
      return parsePromptLifecycleState(value);
    },
    safeParse(value: unknown): SafeParseResult<PromptLifecycleState> {
      return safeParseContract<PromptLifecycleState>(
        "PromptLifecycleState",
        value,
      );
    },
  };

export function parseProviderConfigSnapshotEntry(
  value: unknown,
): ProviderConfigSnapshotEntry {
  return parseContract<ProviderConfigSnapshotEntry>(
    "ProviderConfigSnapshotEntry",
    value,
  );
}

export function isProviderConfigSnapshotEntry(
  value: unknown,
): value is ProviderConfigSnapshotEntry {
  return isContract<ProviderConfigSnapshotEntry>(
    "ProviderConfigSnapshotEntry",
    value,
  );
}

export const ProviderConfigSnapshotEntrySchema: GeneratedSchema<ProviderConfigSnapshotEntry> =
  {
    parse(value: unknown): ProviderConfigSnapshotEntry {
      return parseProviderConfigSnapshotEntry(value);
    },
    safeParse(value: unknown): SafeParseResult<ProviderConfigSnapshotEntry> {
      return safeParseContract<ProviderConfigSnapshotEntry>(
        "ProviderConfigSnapshotEntry",
        value,
      );
    },
  };

export function parseProviderConfigSnapshotStatus(
  value: unknown,
): ProviderConfigSnapshotStatus {
  return parseContract<ProviderConfigSnapshotStatus>(
    "ProviderConfigSnapshotStatus",
    value,
  );
}

export function isProviderConfigSnapshotStatus(
  value: unknown,
): value is ProviderConfigSnapshotStatus {
  return isContract<ProviderConfigSnapshotStatus>(
    "ProviderConfigSnapshotStatus",
    value,
  );
}

export const ProviderConfigSnapshotStatusSchema: GeneratedSchema<ProviderConfigSnapshotStatus> =
  {
    parse(value: unknown): ProviderConfigSnapshotStatus {
      return parseProviderConfigSnapshotStatus(value);
    },
    safeParse(value: unknown): SafeParseResult<ProviderConfigSnapshotStatus> {
      return safeParseContract<ProviderConfigSnapshotStatus>(
        "ProviderConfigSnapshotStatus",
        value,
      );
    },
  };

export function parseProviderDiscovery(value: unknown): ProviderDiscovery {
  return parseContract<ProviderDiscovery>("ProviderDiscovery", value);
}

export function isProviderDiscovery(
  value: unknown,
): value is ProviderDiscovery {
  return isContract<ProviderDiscovery>("ProviderDiscovery", value);
}

export const ProviderDiscoverySchema: GeneratedSchema<ProviderDiscovery> = {
  parse(value: unknown): ProviderDiscovery {
    return parseProviderDiscovery(value);
  },
  safeParse(value: unknown): SafeParseResult<ProviderDiscovery> {
    return safeParseContract<ProviderDiscovery>("ProviderDiscovery", value);
  },
};

export function parseProviderId(value: unknown): ProviderId {
  return parseContract<ProviderId>("ProviderId", value);
}

export function isProviderId(value: unknown): value is ProviderId {
  return isContract<ProviderId>("ProviderId", value);
}

export const ProviderIdSchema: GeneratedSchema<ProviderId> = {
  parse(value: unknown): ProviderId {
    return parseProviderId(value);
  },
  safeParse(value: unknown): SafeParseResult<ProviderId> {
    return safeParseContract<ProviderId>("ProviderId", value);
  },
};

export function parseProviderSnapshot(value: unknown): ProviderSnapshot {
  return parseContract<ProviderSnapshot>("ProviderSnapshot", value);
}

export function isProviderSnapshot(value: unknown): value is ProviderSnapshot {
  return isContract<ProviderSnapshot>("ProviderSnapshot", value);
}

export const ProviderSnapshotSchema: GeneratedSchema<ProviderSnapshot> = {
  parse(value: unknown): ProviderSnapshot {
    return parseProviderSnapshot(value);
  },
  safeParse(value: unknown): SafeParseResult<ProviderSnapshot> {
    return safeParseContract<ProviderSnapshot>("ProviderSnapshot", value);
  },
};

export function parseProvidersConfigSnapshotResult(
  value: unknown,
): ProvidersConfigSnapshotResult {
  return parseContract<ProvidersConfigSnapshotResult>(
    "ProvidersConfigSnapshotResult",
    value,
  );
}

export function isProvidersConfigSnapshotResult(
  value: unknown,
): value is ProvidersConfigSnapshotResult {
  return isContract<ProvidersConfigSnapshotResult>(
    "ProvidersConfigSnapshotResult",
    value,
  );
}

export const ProvidersConfigSnapshotResultSchema: GeneratedSchema<ProvidersConfigSnapshotResult> =
  {
    parse(value: unknown): ProvidersConfigSnapshotResult {
      return parseProvidersConfigSnapshotResult(value);
    },
    safeParse(value: unknown): SafeParseResult<ProvidersConfigSnapshotResult> {
      return safeParseContract<ProvidersConfigSnapshotResult>(
        "ProvidersConfigSnapshotResult",
        value,
      );
    },
  };

export function parseRawWireEvent(value: unknown): RawWireEvent {
  return parseContract<RawWireEvent>("RawWireEvent", value);
}

export function isRawWireEvent(value: unknown): value is RawWireEvent {
  return isContract<RawWireEvent>("RawWireEvent", value);
}

export const RawWireEventSchema: GeneratedSchema<RawWireEvent> = {
  parse(value: unknown): RawWireEvent {
    return parseRawWireEvent(value);
  },
  safeParse(value: unknown): SafeParseResult<RawWireEvent> {
    return safeParseContract<RawWireEvent>("RawWireEvent", value);
  },
};

export function parseRuntimeEvent(value: unknown): RuntimeEvent {
  return parseContract<RuntimeEvent>("RuntimeEvent", value);
}

export function isRuntimeEvent(value: unknown): value is RuntimeEvent {
  return isContract<RuntimeEvent>("RuntimeEvent", value);
}

export const RuntimeEventSchema: GeneratedSchema<RuntimeEvent> = {
  parse(value: unknown): RuntimeEvent {
    return parseRuntimeEvent(value);
  },
  safeParse(value: unknown): SafeParseResult<RuntimeEvent> {
    return safeParseContract<RuntimeEvent>("RuntimeEvent", value);
  },
};

export function parseServerEventFrame(value: unknown): ServerEventFrame {
  return parseContract<ServerEventFrame>("ServerEventFrame", value);
}

export function isServerEventFrame(value: unknown): value is ServerEventFrame {
  return isContract<ServerEventFrame>("ServerEventFrame", value);
}

export const ServerEventFrameSchema: GeneratedSchema<ServerEventFrame> = {
  parse(value: unknown): ServerEventFrame {
    return parseServerEventFrame(value);
  },
  safeParse(value: unknown): SafeParseResult<ServerEventFrame> {
    return safeParseContract<ServerEventFrame>("ServerEventFrame", value);
  },
};

export function parseServerFrame(value: unknown): ServerFrame {
  return parseContract<ServerFrame>("ServerFrame", value);
}

export function isServerFrame(value: unknown): value is ServerFrame {
  return isContract<ServerFrame>("ServerFrame", value);
}

export const ServerFrameSchema: GeneratedSchema<ServerFrame> = {
  parse(value: unknown): ServerFrame {
    return parseServerFrame(value);
  },
  safeParse(value: unknown): SafeParseResult<ServerFrame> {
    return safeParseContract<ServerFrame>("ServerFrame", value);
  },
};

export function parseServerResponseFrame(value: unknown): ServerResponseFrame {
  return parseContract<ServerResponseFrame>("ServerResponseFrame", value);
}

export function isServerResponseFrame(
  value: unknown,
): value is ServerResponseFrame {
  return isContract<ServerResponseFrame>("ServerResponseFrame", value);
}

export const ServerResponseFrameSchema: GeneratedSchema<ServerResponseFrame> = {
  parse(value: unknown): ServerResponseFrame {
    return parseServerResponseFrame(value);
  },
  safeParse(value: unknown): SafeParseResult<ServerResponseFrame> {
    return safeParseContract<ServerResponseFrame>("ServerResponseFrame", value);
  },
};

export function parseSessionCancelRequest(
  value: unknown,
): SessionCancelRequest {
  return parseContract<SessionCancelRequest>("SessionCancelRequest", value);
}

export function isSessionCancelRequest(
  value: unknown,
): value is SessionCancelRequest {
  return isContract<SessionCancelRequest>("SessionCancelRequest", value);
}

export const SessionCancelRequestSchema: GeneratedSchema<SessionCancelRequest> =
  {
    parse(value: unknown): SessionCancelRequest {
      return parseSessionCancelRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionCancelRequest> {
      return safeParseContract<SessionCancelRequest>(
        "SessionCancelRequest",
        value,
      );
    },
  };

export function parseSessionConfigOption(value: unknown): SessionConfigOption {
  return parseContract<SessionConfigOption>("SessionConfigOption", value);
}

export function isSessionConfigOption(
  value: unknown,
): value is SessionConfigOption {
  return isContract<SessionConfigOption>("SessionConfigOption", value);
}

export const SessionConfigOptionSchema: GeneratedSchema<SessionConfigOption> = {
  parse(value: unknown): SessionConfigOption {
    return parseSessionConfigOption(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionConfigOption> {
    return safeParseContract<SessionConfigOption>("SessionConfigOption", value);
  },
};

export function parseSessionGroup(value: unknown): SessionGroup {
  return parseContract<SessionGroup>("SessionGroup", value);
}

export function isSessionGroup(value: unknown): value is SessionGroup {
  return isContract<SessionGroup>("SessionGroup", value);
}

export const SessionGroupSchema: GeneratedSchema<SessionGroup> = {
  parse(value: unknown): SessionGroup {
    return parseSessionGroup(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionGroup> {
    return safeParseContract<SessionGroup>("SessionGroup", value);
  },
};

export function parseSessionGroupsQuery(value: unknown): SessionGroupsQuery {
  return parseContract<SessionGroupsQuery>("SessionGroupsQuery", value);
}

export function isSessionGroupsQuery(
  value: unknown,
): value is SessionGroupsQuery {
  return isContract<SessionGroupsQuery>("SessionGroupsQuery", value);
}

export const SessionGroupsQuerySchema: GeneratedSchema<SessionGroupsQuery> = {
  parse(value: unknown): SessionGroupsQuery {
    return parseSessionGroupsQuery(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionGroupsQuery> {
    return safeParseContract<SessionGroupsQuery>("SessionGroupsQuery", value);
  },
};

export function parseSessionGroupsView(value: unknown): SessionGroupsView {
  return parseContract<SessionGroupsView>("SessionGroupsView", value);
}

export function isSessionGroupsView(
  value: unknown,
): value is SessionGroupsView {
  return isContract<SessionGroupsView>("SessionGroupsView", value);
}

export const SessionGroupsViewSchema: GeneratedSchema<SessionGroupsView> = {
  parse(value: unknown): SessionGroupsView {
    return parseSessionGroupsView(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionGroupsView> {
    return safeParseContract<SessionGroupsView>("SessionGroupsView", value);
  },
};

export function parseSessionHistoryRequest(
  value: unknown,
): SessionHistoryRequest {
  return parseContract<SessionHistoryRequest>("SessionHistoryRequest", value);
}

export function isSessionHistoryRequest(
  value: unknown,
): value is SessionHistoryRequest {
  return isContract<SessionHistoryRequest>("SessionHistoryRequest", value);
}

export const SessionHistoryRequestSchema: GeneratedSchema<SessionHistoryRequest> =
  {
    parse(value: unknown): SessionHistoryRequest {
      return parseSessionHistoryRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionHistoryRequest> {
      return safeParseContract<SessionHistoryRequest>(
        "SessionHistoryRequest",
        value,
      );
    },
  };

export function parseSessionHistoryWindow(
  value: unknown,
): SessionHistoryWindow {
  return parseContract<SessionHistoryWindow>("SessionHistoryWindow", value);
}

export function isSessionHistoryWindow(
  value: unknown,
): value is SessionHistoryWindow {
  return isContract<SessionHistoryWindow>("SessionHistoryWindow", value);
}

export const SessionHistoryWindowSchema: GeneratedSchema<SessionHistoryWindow> =
  {
    parse(value: unknown): SessionHistoryWindow {
      return parseSessionHistoryWindow(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionHistoryWindow> {
      return safeParseContract<SessionHistoryWindow>(
        "SessionHistoryWindow",
        value,
      );
    },
  };

export function parseSessionModeState(value: unknown): SessionModeState {
  return parseContract<SessionModeState>("SessionModeState", value);
}

export function isSessionModeState(value: unknown): value is SessionModeState {
  return isContract<SessionModeState>("SessionModeState", value);
}

export const SessionModeStateSchema: GeneratedSchema<SessionModeState> = {
  parse(value: unknown): SessionModeState {
    return parseSessionModeState(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionModeState> {
    return safeParseContract<SessionModeState>("SessionModeState", value);
  },
};

export function parseSessionNewRequest(value: unknown): SessionNewRequest {
  return parseContract<SessionNewRequest>("SessionNewRequest", value);
}

export function isSessionNewRequest(
  value: unknown,
): value is SessionNewRequest {
  return isContract<SessionNewRequest>("SessionNewRequest", value);
}

export const SessionNewRequestSchema: GeneratedSchema<SessionNewRequest> = {
  parse(value: unknown): SessionNewRequest {
    return parseSessionNewRequest(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionNewRequest> {
    return safeParseContract<SessionNewRequest>("SessionNewRequest", value);
  },
};

export function parseSessionNewResult(value: unknown): SessionNewResult {
  return parseContract<SessionNewResult>("SessionNewResult", value);
}

export function isSessionNewResult(value: unknown): value is SessionNewResult {
  return isContract<SessionNewResult>("SessionNewResult", value);
}

export const SessionNewResultSchema: GeneratedSchema<SessionNewResult> = {
  parse(value: unknown): SessionNewResult {
    return parseSessionNewResult(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionNewResult> {
    return safeParseContract<SessionNewResult>("SessionNewResult", value);
  },
};

export function parseSessionOpenRequest(value: unknown): SessionOpenRequest {
  return parseContract<SessionOpenRequest>("SessionOpenRequest", value);
}

export function isSessionOpenRequest(
  value: unknown,
): value is SessionOpenRequest {
  return isContract<SessionOpenRequest>("SessionOpenRequest", value);
}

export const SessionOpenRequestSchema: GeneratedSchema<SessionOpenRequest> = {
  parse(value: unknown): SessionOpenRequest {
    return parseSessionOpenRequest(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionOpenRequest> {
    return safeParseContract<SessionOpenRequest>("SessionOpenRequest", value);
  },
};

export function parseSessionOpenResult(value: unknown): SessionOpenResult {
  return parseContract<SessionOpenResult>("SessionOpenResult", value);
}

export function isSessionOpenResult(
  value: unknown,
): value is SessionOpenResult {
  return isContract<SessionOpenResult>("SessionOpenResult", value);
}

export const SessionOpenResultSchema: GeneratedSchema<SessionOpenResult> = {
  parse(value: unknown): SessionOpenResult {
    return parseSessionOpenResult(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionOpenResult> {
    return safeParseContract<SessionOpenResult>("SessionOpenResult", value);
  },
};

export function parseSessionPromptRequest(
  value: unknown,
): SessionPromptRequest {
  return parseContract<SessionPromptRequest>("SessionPromptRequest", value);
}

export function isSessionPromptRequest(
  value: unknown,
): value is SessionPromptRequest {
  return isContract<SessionPromptRequest>("SessionPromptRequest", value);
}

export const SessionPromptRequestSchema: GeneratedSchema<SessionPromptRequest> =
  {
    parse(value: unknown): SessionPromptRequest {
      return parseSessionPromptRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionPromptRequest> {
      return safeParseContract<SessionPromptRequest>(
        "SessionPromptRequest",
        value,
      );
    },
  };

export function parseSessionRow(value: unknown): SessionRow {
  return parseContract<SessionRow>("SessionRow", value);
}

export function isSessionRow(value: unknown): value is SessionRow {
  return isContract<SessionRow>("SessionRow", value);
}

export const SessionRowSchema: GeneratedSchema<SessionRow> = {
  parse(value: unknown): SessionRow {
    return parseSessionRow(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionRow> {
    return safeParseContract<SessionRow>("SessionRow", value);
  },
};

export function parseSessionSetConfigOptionRequest(
  value: unknown,
): SessionSetConfigOptionRequest {
  return parseContract<SessionSetConfigOptionRequest>(
    "SessionSetConfigOptionRequest",
    value,
  );
}

export function isSessionSetConfigOptionRequest(
  value: unknown,
): value is SessionSetConfigOptionRequest {
  return isContract<SessionSetConfigOptionRequest>(
    "SessionSetConfigOptionRequest",
    value,
  );
}

export const SessionSetConfigOptionRequestSchema: GeneratedSchema<SessionSetConfigOptionRequest> =
  {
    parse(value: unknown): SessionSetConfigOptionRequest {
      return parseSessionSetConfigOptionRequest(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionSetConfigOptionRequest> {
      return safeParseContract<SessionSetConfigOptionRequest>(
        "SessionSetConfigOptionRequest",
        value,
      );
    },
  };

export function parseSessionSetConfigOptionResult(
  value: unknown,
): SessionSetConfigOptionResult {
  return parseContract<SessionSetConfigOptionResult>(
    "SessionSetConfigOptionResult",
    value,
  );
}

export function isSessionSetConfigOptionResult(
  value: unknown,
): value is SessionSetConfigOptionResult {
  return isContract<SessionSetConfigOptionResult>(
    "SessionSetConfigOptionResult",
    value,
  );
}

export const SessionSetConfigOptionResultSchema: GeneratedSchema<SessionSetConfigOptionResult> =
  {
    parse(value: unknown): SessionSetConfigOptionResult {
      return parseSessionSetConfigOptionResult(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionSetConfigOptionResult> {
      return safeParseContract<SessionSetConfigOptionResult>(
        "SessionSetConfigOptionResult",
        value,
      );
    },
  };

export function parseSessionStateProjection(
  value: unknown,
): SessionStateProjection {
  return parseContract<SessionStateProjection>("SessionStateProjection", value);
}

export function isSessionStateProjection(
  value: unknown,
): value is SessionStateProjection {
  return isContract<SessionStateProjection>("SessionStateProjection", value);
}

export const SessionStateProjectionSchema: GeneratedSchema<SessionStateProjection> =
  {
    parse(value: unknown): SessionStateProjection {
      return parseSessionStateProjection(value);
    },
    safeParse(value: unknown): SafeParseResult<SessionStateProjection> {
      return safeParseContract<SessionStateProjection>(
        "SessionStateProjection",
        value,
      );
    },
  };

export function parseSessionWatchRequest(value: unknown): SessionWatchRequest {
  return parseContract<SessionWatchRequest>("SessionWatchRequest", value);
}

export function isSessionWatchRequest(
  value: unknown,
): value is SessionWatchRequest {
  return isContract<SessionWatchRequest>("SessionWatchRequest", value);
}

export const SessionWatchRequestSchema: GeneratedSchema<SessionWatchRequest> = {
  parse(value: unknown): SessionWatchRequest {
    return parseSessionWatchRequest(value);
  },
  safeParse(value: unknown): SafeParseResult<SessionWatchRequest> {
    return safeParseContract<SessionWatchRequest>("SessionWatchRequest", value);
  },
};

export function parseTranscriptItem(value: unknown): TranscriptItem {
  return parseContract<TranscriptItem>("TranscriptItem", value);
}

export function isTranscriptItem(value: unknown): value is TranscriptItem {
  return isContract<TranscriptItem>("TranscriptItem", value);
}

export const TranscriptItemSchema: GeneratedSchema<TranscriptItem> = {
  parse(value: unknown): TranscriptItem {
    return parseTranscriptItem(value);
  },
  safeParse(value: unknown): SafeParseResult<TranscriptItem> {
    return safeParseContract<TranscriptItem>("TranscriptItem", value);
  },
};

export function parseTranscriptUpdateSnapshot(
  value: unknown,
): TranscriptUpdateSnapshot {
  return parseContract<TranscriptUpdateSnapshot>(
    "TranscriptUpdateSnapshot",
    value,
  );
}

export function isTranscriptUpdateSnapshot(
  value: unknown,
): value is TranscriptUpdateSnapshot {
  return isContract<TranscriptUpdateSnapshot>(
    "TranscriptUpdateSnapshot",
    value,
  );
}

export const TranscriptUpdateSnapshotSchema: GeneratedSchema<TranscriptUpdateSnapshot> =
  {
    parse(value: unknown): TranscriptUpdateSnapshot {
      return parseTranscriptUpdateSnapshot(value);
    },
    safeParse(value: unknown): SafeParseResult<TranscriptUpdateSnapshot> {
      return safeParseContract<TranscriptUpdateSnapshot>(
        "TranscriptUpdateSnapshot",
        value,
      );
    },
  };
