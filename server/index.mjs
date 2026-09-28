import { createApp } from "./app.mjs";
import { createStorage } from "./storage.mjs";
const service = await createApp({ storage: createStorage(process.env) });
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3000);
const server = service.app.listen(port, host, () =>
  console.log(`QR Forever listening on ${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      service.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000).unref();
  });
