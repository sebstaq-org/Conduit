import { getRuntimeHealthQuery } from "./session-api-queries";

const runtimeHealthEndpoint = {
  providesTags: [{ id: "CURRENT", type: "RuntimeHealth" }],
  queryFn: getRuntimeHealthQuery,
} as const;

export { runtimeHealthEndpoint };
