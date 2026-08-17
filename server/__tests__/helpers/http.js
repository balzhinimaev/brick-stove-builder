import { once } from "node:events";

/** Runs an Express application on a real ephemeral HTTP server. */
export async function startTestServer(app) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  return {
    request(path, { method = "GET", token, body, headers = {} } = {}) {
      return fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    },
    async close() {
      server.close();
      await once(server, "close");
    }
  };
}

export async function json(response) {
  return { status: response.status, body: await response.json() };
}
