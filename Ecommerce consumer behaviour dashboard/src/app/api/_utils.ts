import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { auth } from "@clerk/nextjs/server";

let backendProcess: ReturnType<typeof spawn> | null = null;
let lastStartAttempt = 0;
const responseCache = new Map<string, { expiresAt: number; status: number; data: JsonValue }>();
const inflightRequests = new Map<string, Promise<{ response: Response; data: JsonValue }>>();
const cacheTtlMs = Number(process.env.NEXT_BACKEND_CACHE_MS ?? "10000");

const backendRoot = path.join(process.cwd(), "backend");
const venvPython = path.join(backendRoot, ".venv", "Scripts", "python.exe");

const backendFetchTimeoutMs = Number(process.env.NEXT_BACKEND_FETCH_TIMEOUT_MS ?? "2000");

const getBearerToken = async () => {
  try {
    const session = await auth();
    if (!session || !session.getToken) {
      return null;
    }
    const token = await session.getToken();
    return token ?? null;
  } catch {
    return null;
  }
};

const withAuthHeader = async (init: RequestInit | undefined) => {
  const token = await getBearerToken();
  if (!token) {
    return init;
  }
  const headers = new Headers(init?.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return {
    ...init,
    headers,
  } satisfies RequestInit;
};

const fetchWithTimeout = async (url: string, init: RequestInit | undefined, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }
  try {
    const mergedInit: RequestInit = {
      ...init,
      signal: controller.signal,
    };
    return await fetch(url, mergedInit);
  } finally {
    clearTimeout(timeout);
    if (externalSignal && !externalSignal.aborted) {
      externalSignal.removeEventListener("abort", abortFromExternal);
    }
  }
};

const buildHostCandidate = (request?: Request) => {
  if (!request) {
    return undefined;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return undefined;
  }
  const hostValue = host.split(",")[0].trim();
  const hostname = hostValue.split(":")[0];
  return hostname ? `http://${hostname}:8000` : undefined;
};

const buildCandidates = (request?: Request) => {
  const envUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
  const candidates = [
    envUrl,
    buildHostCandidate(request),
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://backend:8000",
  ]
    .filter(Boolean)
    .map((value) => (value as string).replace(/\/$/, ""));
  return Array.from(new Set(candidates));
};

const startBackend = () => {
  const now = Date.now();
  if (backendProcess || now - lastStartAttempt < 5000) {
    return;
  }
  lastStartAttempt = now;
  const python = fs.existsSync(venvPython) ? venvPython : "python";
  try {
    backendProcess = spawn(
      python,
      ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
      {
        cwd: backendRoot,
        detached: true,
        stdio: "ignore",
      }
    );
    backendProcess.unref();
  } catch {
    backendProcess = null;
  }
};

const cacheKeyFor = (path: string, init?: RequestInit) => {
  const method = (init?.method ?? "GET").toUpperCase();
  return `${method}:${path}`;
};

const fetchFirstAvailable = async (
  candidates: string[],
  path: string,
  init: RequestInit | undefined,
  limit = candidates.length
) => {
  const normalizedPath = (() => {
    const trimmed = path.replace(/^\/+/, "");
    return trimmed.startsWith("api/") ? trimmed : `api/${trimmed}`;
  })();
  const initWithAuth = await withAuthHeader(init);
  for (const base of candidates.slice(0, limit)) {
    try {
      const response = await fetchWithTimeout(
        `${base}/${normalizedPath}`,
        initWithAuth,
        backendFetchTimeoutMs
      );
      const data = (await response.json()) as JsonValue;
      return { response, data };
    } catch {
      continue;
    }
  }
  throw new Error("Backend unreachable");
};

export const fetchFromBackends = async (path: string, init?: RequestInit, request?: Request) => {
  const candidates = buildCandidates(request);
  const method = (init?.method ?? "GET").toUpperCase();
  const canRetrySafely = method === "GET" || method === "HEAD" || !init?.body;
  const preferredNonReplayCandidate =
    candidates.find((candidate) => candidate.includes("127.0.0.1") || candidate.includes("localhost")) ??
    candidates[0];
  const activeCandidates = canRetrySafely ? candidates : [preferredNonReplayCandidate];
  const key = cacheKeyFor(path, init);
  if (method === "GET") {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { response: new Response(null, { status: cached.status }), data: cached.data };
    }
    const pending = inflightRequests.get(key);
    if (pending) {
      return pending;
    }
  }
  const run = async () => {
    try {
      const result = await fetchFirstAvailable(
        activeCandidates,
        path,
        init,
        activeCandidates.length
      );
      if (method === "GET") {
        responseCache.set(key, {
          expiresAt: Date.now() + cacheTtlMs,
          status: result.response.status,
          data: result.data,
        });
      }
      return result;
    } catch {
      if (!canRetrySafely) {
        throw new Error("Backend unreachable");
      }
      startBackend();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const retried = await fetchFirstAvailable(activeCandidates, path, init);
      if (method === "GET") {
        responseCache.set(key, {
          expiresAt: Date.now() + cacheTtlMs,
          status: retried.response.status,
          data: retried.data,
        });
      }
      return retried;
    } finally {
      if (method === "GET") {
        inflightRequests.delete(key);
      }
    }
  };
  if (method === "GET") {
    const promise = run();
    inflightRequests.set(key, promise);
    return promise;
  }
  return run();
};
