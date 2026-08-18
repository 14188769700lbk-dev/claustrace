import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";

const servers: Server[] = [];

async function startApp(app: ReturnType<typeof createApp>): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe("trusted server routes", () => {
  it("reports only capability booleans and keeps extraction unavailable", async () => {
    const baseUrl = await startApp(
      createApp({
        environment: {
          NUTRIENT_API_KEY: "configured-test-value",
          SERPAPI_API_KEY: "",
        },
      }),
    );

    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    expect(payload.providers).toEqual({
      nutrientBuildConfigured: true,
      nutrientExtractionAvailable: false,
      serpApiConfigured: false,
    });
    expect(JSON.stringify(payload)).not.toContain("configured-test-value");

    const extraction = await fetch(`${baseUrl}/api/live/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(extraction.status).toBe(501);
    await expect(extraction.json()).resolves.toMatchObject({
      error: "provider_contract_unverified",
    });
  });

  it("rejects malformed search input before contacting a provider", async () => {
    const providerFetch = vi.fn();
    const baseUrl = await startApp(
      createApp({
        environment: { NUTRIENT_API_KEY: "", SERPAPI_API_KEY: "test-value" },
        fetchImpl: providerFetch,
      }),
    );

    const response = await fetch(`${baseUrl}/api/live/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "migration policy",
        officialDomains: ["https://example.com/path"],
      }),
    });

    expect(response.status).toBe(400);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when a valid search is requested without a server key", async () => {
    const baseUrl = await startApp(
      createApp({
        environment: { NUTRIENT_API_KEY: "", SERPAPI_API_KEY: "" },
      }),
    );

    const response = await fetch(`${baseUrl}/api/live/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "migration policy",
        officialDomains: ["example.com"],
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "provider_not_configured",
    });
  });

  it("proxies a validated search without upgrading snippets to evidence", async () => {
    const providerFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          search_metadata: { id: "route-search-1", status: "Success" },
          organic_results: [
            {
              position: 1,
              title: "Official notice",
              link: "https://example.com/notice",
              snippet: "Review this source.",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const baseUrl = await startApp(
      createApp({
        environment: { NUTRIENT_API_KEY: "", SERPAPI_API_KEY: "test-value" },
        fetchImpl: providerFetch,
        now: () => new Date("2026-08-18T16:20:00.000Z"),
      }),
    );

    const response = await fetch(`${baseUrl}/api/live/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "migration policy",
        officialDomains: ["example.com"],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({
      officialDomain: true,
      state: "discovered",
    });
    expect(payload.results[0]).not.toHaveProperty("sourceDigest");
  });

  it("requires an exact confirmation before spending a Nutrient build credit", async () => {
    const providerFetch = vi.fn(async () =>
      new Response(new TextEncoder().encode("%PDF-1.7\nroute-test"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    ) as unknown as typeof fetch;
    const baseUrl = await startApp(
      createApp({
        environment: {
          NUTRIENT_API_KEY: "test-value",
          SERPAPI_API_KEY: "",
        },
        fetchImpl: providerFetch,
      }),
    );

    const missingConfirmation = await fetch(
      `${baseUrl}/api/live/build-synthetic-packet`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "yes" }),
      },
    );
    expect(missingConfirmation.status).toBe(400);
    expect(providerFetch).not.toHaveBeenCalled();

    const confirmed = await fetch(
      `${baseUrl}/api/live/build-synthetic-packet`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "BUILD SYNTHETIC PACKET" }),
      },
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.headers.get("content-type")).toContain("application/pdf");
    expect(new Uint8Array(await confirmed.arrayBuffer()).slice(0, 5)).toEqual(
      new TextEncoder().encode("%PDF-"),
    );
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });
});
