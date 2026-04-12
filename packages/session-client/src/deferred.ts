const rejectUninitialized = (): never => {
  throw new Error("deferred promise reject called before initialization");
};

const resolveUninitialized = (): never => {
  throw new Error("deferred promise resolve called before initialization");
};

function createDeferred<TValue>(): PromiseWithResolvers<TValue> {
  let rejectDeferred: (reason?: unknown) => void = rejectUninitialized;
  let resolveDeferred: (value: PromiseLike<TValue> | TValue) => void =
    resolveUninitialized;
  // eslint-disable-next-line promise/avoid-new -- Hermes does not provide Promise.withResolvers.
  const promise = new Promise<TValue>((resolve, reject) => {
    rejectDeferred = reject;
    resolveDeferred = resolve;
  });

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred,
  };
}

export { createDeferred };
