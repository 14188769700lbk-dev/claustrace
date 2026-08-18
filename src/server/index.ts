import express from "express";

import { createFreshDemoCase } from "../fixtures/demo-case.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    mode: "trusted-server",
    providers: {
      nutrientConfigured: Boolean(process.env.NUTRIENT_API_KEY),
      serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY),
    },
    boundary:
      "Configuration presence only. No credential value is returned or logged.",
  });
});

app.get("/api/demo", (_request, response) => {
  response.json(createFreshDemoCase());
});

app.use("/api", (_request, response) => {
  response.status(404).json({
    error: "route_not_available",
    message:
      "Live provider routes are disabled until their strict adapters and acceptance tests are installed.",
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`ClauseTrace trusted server listening on http://127.0.0.1:${port}`);
});
