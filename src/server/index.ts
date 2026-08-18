import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 8787);

app.listen(port, "127.0.0.1", () => {
  console.log(`ClauseTrace trusted server listening on http://127.0.0.1:${port}`);
});
