function confirmGeneratedSubscription(
  result: unknown,
  cleanup: () => void,
  parse: (result: unknown) => unknown,
): void {
  try {
    parse(result);
  } catch (error) {
    cleanup();
    throw error;
  }
}

export { confirmGeneratedSubscription };
