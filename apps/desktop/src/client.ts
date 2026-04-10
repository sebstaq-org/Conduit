import type {
  DesktopProofAction,
  DesktopProofConfig,
  DesktopProofRequest,
  DesktopProofResult,
} from "@conduit/app-client";

async function main() {
  const config = await readConfig();
  document.title = config.copy.title;
  document.body.innerHTML = `
    <main class="shell">
      <header>
        <h1>${config.copy.title}</h1>
        <p>${config.copy.subtitle}</p>
      </header>
      <section class="controls">
        <label>Provider <select id="provider"></select></label>
        <label>CWD <input id="cwd" value="${escapeHtml(config.defaultCwd)}" /></label>
        <label>Prompt <textarea id="prompt">${config.copy.promptPlaceholder}</textarea></label>
        <div class="buttons">
          ${config.actions
            .map(
              (action) =>
                `<button data-action="${action}">${label(action)}</button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="status">
        <p id="status">Idle.</p>
        <p id="artifact"></p>
      </section>
      <section class="grid">
        <article><h2>Summary</h2><pre id="summary"></pre></article>
        <article><h2>Snapshot</h2><pre id="snapshot"></pre></article>
        <article><h2>Requests</h2><pre id="requests"></pre></article>
        <article><h2>Responses</h2><pre id="responses"></pre></article>
        <article class="full"><h2>Raw Wire Events</h2><pre id="events"></pre></article>
      </section>
    </main>
  `;
  hydrateProviderSelect(config);
  bindButtons();
}

function hydrateProviderSelect(config: DesktopProofConfig) {
  const select = element("provider") as HTMLSelectElement;
  for (const provider of config.providers) {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    select.append(option);
  }
}

function bindButtons() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "button[data-action]",
  );
  for (const button of buttons) {
    button.addEventListener("click", () => {
      void runAction(button.dataset.action as DesktopProofAction);
    });
  }
}

async function runAction(action: DesktopProofAction) {
  setStatus(`Running ${action}…`);
  try {
    const request: DesktopProofRequest = {
      provider: (element("provider") as HTMLSelectElement)
        .value as DesktopProofRequest["provider"],
      action,
      cwd: (element("cwd") as HTMLInputElement).value,
      prompt: (element("prompt") as HTMLTextAreaElement).value,
      cancelAfterMs: 500,
    };
    const result = await runDesktopAction(request);
    renderResult(result);
    setStatus(`Completed ${action}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Failed: ${message}`);
  }
}

function renderResult(result: DesktopProofResult) {
  element("artifact").textContent =
    `Artifacts: ${result.artifactRoot} | PNG: ${result.desktopProofPng}`;
  element("summary").textContent = result.summary;
  element("snapshot").textContent = JSON.stringify(result.snapshot, null, 2);
  element("requests").textContent = JSON.stringify(result.requests, null, 2);
  element("responses").textContent = JSON.stringify(result.responses, null, 2);
  element("events").textContent = JSON.stringify(result.events, null, 2);
}

async function readConfig(): Promise<DesktopProofConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error(`desktop proof config failed: ${String(response.status)}`);
  }
  return (await response.json()) as DesktopProofConfig;
}

function label(action: DesktopProofAction): string {
  return `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

function setStatus(text: string) {
  element("status").textContent = text;
}

function element(id: string): HTMLElement {
  const value = document.getElementById(id);
  if (!value) {
    throw new Error(`missing element ${id}`);
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function runDesktopAction(
  request: DesktopProofRequest,
): Promise<DesktopProofResult> {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`desktop proof request failed: ${String(response.status)}`);
  }
  return (await response.json()) as DesktopProofResult;
}

void main();
