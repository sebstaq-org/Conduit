function projectActionErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "Project request failed";
}

export { projectActionErrorMessage };
