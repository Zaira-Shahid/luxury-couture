// Lets a test script import this project's `.ts` modules directly under
// Node's own type stripping — added in Module 42.
//
// WHY THIS EXISTS. The assistant loop (src/lib/mcp/chat.ts) is the one
// place where a model's output becomes a tool call, and its security
// claims are behavioural: it stops at CONFIRMATION_REQUIRED, it never
// shows the model a token, it answers every tool_use with a tool_result.
// None of that can be proved by reading the source or by calling the HTTP
// route, which needs an API key and a live model. Importing the module
// and driving it with a scripted client can prove all of it.
//
// scripts/unit/*.test.mjs already import `.ts` modules this way; those
// modules happen to have no imports at all, so Node resolves them
// unaided. chat.ts pulls in the whole MCP server, which needs three
// things Node does not do by itself:
//
//   1. `@/...` — the project's path alias, which Node does not read out
//      of tsconfig.json.
//   2. `./server` — TypeScript's extensionless relative imports.
//   3. `next/headers` and `react` — reached through the auth chain.
//      `next/headers` resolves with its real extension; `react`'s CJS
//      build exposes no named `cache` export to Node's ESM loader, so it
//      is shimmed with the identity function React documents it as
//      being outside a render.
//
// WHAT IS AND IS NOT REAL. Only `react` is substituted, and only for
// `cache`. The registry, the dispatcher, the permission check, the
// confirmation gate, the replay ledger and the audit write are the
// application's own code, running against the real database. A harness
// that stubbed those would be testing itself.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = process.cwd();
const REACT_SHIM = "\0react-shim";

function firstExisting(base) {
  for (const candidate of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react") return { url: REACT_SHIM, shortCircuit: true };
    if (specifier === "next/headers") return nextResolve("next/headers.js", context);

    let base = null;
    if (specifier.startsWith("@/")) {
      base = path.join(root, "src", specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (base) {
      const found = firstExisting(base);
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url === REACT_SHIM) {
      return {
        format: "module",
        shortCircuit: true,
        // `cache` memoises per request on the server; outside one, calling
        // through is the documented behaviour and all this chain needs.
        source: "export const cache = (fn) => fn;\nexport default { cache };\n",
      };
    }
    return nextLoad(url, context);
  },
});
