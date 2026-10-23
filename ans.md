**Project overview – “TS Agent”**  

The repository at **/home/batman/Desktop/Projects/TS Agent** is a small TypeScript‑based demo that showcases an *agentic loop* (LLM‑driven tool use) built with the **Bun** runtime. It is split into two workspaces that work together:

| Workspace | Purpose | Main file |
|-----------|---------|-----------|
| **Agent/** | The “brain” – a LLM‑driven agent that can call a single tool (a Bash executor). It takes a user prompt, asks a free model on OpenRouter, and, if the model requests a tool call, runs the requested Bash command and feeds the result back to the model. The loop runs for a maximum of 10 turns. | `index.ts` |
| **backend/** | Very thin Express‑based HTTP server that forwards a JSON `{prompt}` to the Agent and returns the agent’s final message. It exposes a single POST endpoint **`/agent`**. | `index.ts` |

---

### 1. Agent (`Agent/`)

**Key pieces**

| File | What it does |
|------|--------------|
| `index.ts` | Implements the *agentic loop*:<br>1. System prompt “you are coding assistant”.<br>2. Sends the user prompt to **OpenRouter** using the free model `openrouter/free`.<br>3. The model can return **tool calls** – currently only one tool named `bash`.<br>4. The handler `bashTool` executes the command via Bun’s `$` operator and returns `stdout`/`stderr`.<br>5. The result is fed back to the model, up to a maximum of 10 iterations.<br>6. Finally it `console.log`s the last assistant message. |
| `package.json` | Declares dependencies: <br>• `@openrouter/sdk ^1.5.3` – client for OpenRouter.<br>• `dotenv ^18.0.8` (though Bun auto‑loads `.env`).<br>• `@types/bun` dev‑dependency. |
| `tsconfig.json` | Bundler‑mode TypeScript config targeting ESNext, strict mode, `verbatimModuleSyntax`, etc. |
| `bun.lock` | Lock file for Bun‑installed packages (the SDK and its transitive deps, e.g. `zod`). |
| `CLAUDE.md` | Generic Bun usage guide (not project‑specific). |
| `README.md` | Instructions: `bun install && bun run index.ts`. |

**Agent loop flow (pseudo‑code)**  

```ts
messages = [{role:"system", content:"you are coding assistant"}, {role:"user", content:prompt}]

while (iterations < 10) {
    llmResponse = openrouter.chat.send({
        messages,
        model: "openrouter/free",
        tools: [bashToolDef]          // only Bash tool
    })
    if no tool calls → break   // LLM finished
    for each toolCall {
        exec = bashTool(commandFromCall)
        messages.push({role:"tool", toolCallId:..., content:JSON.stringify(exec)})
    }
}
console.log(last assistant message)
```

The only tool the model can invoke is **`bash`**, which runs an arbitrary shell command on the host. The system prompt and the hard‑coded OpenRouter API key (`sk-or-v1-…`) make the agent a *coding assistant* that can execute commands as requested.

---

### 2. Backend (`backend/`)

| File | What it does |
|------|--------------|
| `index.ts` | Creates an Express app, parses JSON bodies, and defines **`POST /agent`**. The body should contain `{prompt:string}`. It calls `agenticLoop(prompt)` (imported from `../Agent/index`) and returns `{"msg": <result>}`. |
| `package.json` | Dependencies: `express` and `@types/express`. |
| `README.md` | Same “bun install / bun run index.ts” pattern (the file is a regular TS script, not a Bun‑served app, but the same tooling is used). |
| `CLAUDE.md` | Same generic Bun guide. |

The backend simply forwards the user’s prompt to the agent loop and returns the agent’s final text output, making the whole setup callable via HTTP.

---

### 3. How the pieces fit together

1. **User → Backend**: `curl -X POST http://localhost:3000/agent -d '{"prompt":"run ls -la"}'`
2. **Backend → Agent**: `agenticLoop(prompt)` runs the LLM loop described above.
3. **Agent → LLM (OpenRouter)**: asks the free model what to do. If the model says “run bash …”, the agent executes the command.
4. **Agent → Backend**: after the loop finishes, the final message is returned.
5. **Backend → User**: JSON `{"msg":"<final text>"}`.

---

### 4. Quick start (if you want to try it)

```bash
# From the project root
cd /home/batman/Desktop/Projects/TS\ Agent

# Install deps for both workspaces
bun install          # in Agent/
bun install          # in backend/

# Start the HTTP server
cd backend
bun run index.ts     # will listen on http://127.0.0.1:3000

# Call the endpoint (example)
curl -X POST http://localhost:3000/agent \
     -H "Content-Type: application/json" \
     -d '{"prompt":"print hello world"}'
```

The server will invoke the agent, which may reply with the output of the requested bash command (or any other text the LLM decides to produce).

---

### 5. What you might want to change / be aware of

| Issue | Why it matters | Possible fix |
|-------|----------------|--------------|
| **Hard‑coded API key** | The key `sk-or-v1-…` is embedded in `Agent/index.ts`. Commit‑ting it would expose credentials. | Keep the key in a `.env` file and read it with `Bun.env.OPENROUTER_KEY`. |
| **Only Bash tool** | The model can run any shell command, which could be dangerous if exposed to untrusted users. | Add sandboxing, command allow‑lists, or restrict the tool to a whitelist. |
| **OpenRouter free model limits** | Free tier may have rate‑limits or latency constraints. | Cache responses or fall back to a paid model if needed. |
| **Express vs Bun.serve** | The backend uses Express, but Bun can also serve HTTP directly. | Replace Express with `Bun.serve()` for a more “Bun‑native” setup. |
| **Relative import** (`import {agenticLoop} from "../Agent/index"`) | Works because both are separate workspaces at the same repo root, but bundlers may need a proper `tsconfig` path mapping. | Add `paths` or `baseUrl` in `tsconfig.json` to make the import cleaner. |

---

### 6. Bottom line

- **TS Agent** is a minimal proof‑of‑concept of an LLM‑driven agent that can execute Bash commands, wrapped by a tiny Express HTTP service.
- It’s built entirely with **Bun** (runtime, package manager, TypeScript bundler) and the **OpenRouter** free model.
- The architecture is deliberately simple: one tool (Bash), one model, one HTTP endpoint. It can be extended with more tools, stricter command filters, or a different LLM provider.
