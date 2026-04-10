type ProviderId = "claude" | "copilot" | "codex";
type DesktopAction = "connect" | "new" | "list" | "load" | "prompt" | "cancel";

interface DesktopProofRequest {
  provider: ProviderId;
  action: DesktopAction;
  cwd: string;
  prompt?: string;
  cancelAfterMs?: number;
}

interface DesktopProofResult {
  provider: ProviderId;
  action: DesktopAction;
  artifactRoot: string;
  snapshot: unknown;
  requests: unknown[];
  responses: unknown[];
  events: unknown[];
  summary: string;
  lastSessionId: string | null;
}

const PROVIDERS = ["claude", "copilot", "codex"] as const;
const copy = {
  title: "Conduit desktop ACP proof",
  subtitle:
    "Official ACP only. This surface drives the locked subset and shows raw wire truth.",
  promptPlaceholder: "Reply with exactly OK.",
};

function main() {
  document.title = copy.title;
  document.body.innerHTML = `
    <main class="shell">
      <header>
        <h1>${copy.title}</h1>
        <p>${copy.subtitle}</p>
      </header>
      <section class="controls">
        <label>Provider <select id="provider"></select></label>
        <label>CWD <input id="cwd" value="${escapeHtml(window.location.pathname.includes("/apps/desktop") ? "/srv/devops/repos/w2/Conduit" : "/srv/devops/repos/w2/Conduit")}" /></label>
        <label>Prompt <textarea id="prompt">${copy.promptPlaceholder}</textarea></label>
        <div class="buttons">
          <button data-action="connect">Connect</button>
          <button data-action="new">New</button>
          <button data-action="list">List</button>
          <button data-action="load">Load</button>
          <button data-action="prompt">Prompt</button>
          <button data-action="cancel">Cancel</button>
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
  hydrateProviderSelect();
  bindButtons();
}

function hydrateProviderSelect() {
  const select = element("provider") as HTMLSelectElement;
  for (const provider of PROVIDERS) {
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
      void runAction(button.dataset.action as DesktopAction);
    });
  }
}

async function runAction(action: DesktopAction) {
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
  element("artifact").textContent = `Artifacts: ${result.artifactRoot}`;
  element("summary").textContent = result.summary;
  element("snapshot").textContent = JSON.stringify(result.snapshot, null, 2);
  element("requests").textContent = JSON.stringify(result.requests, null, 2);
  element("responses").textContent = JSON.stringify(result.responses, null, 2);
  element("events").textContent = JSON.stringify(result.events, null, 2);
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

main();
