import { getRuntimeHealthQuery } from "./api-runtime-health-query";

const runtimeHealthEndpoint = {
  providesTags: [{ id: "CURRENT", type: "RuntimeHealth" }],
  queryFn: getRuntimeHealthQuery,
} as const;

export { runtimeHealthEndpoint };
