import express from "express";
import compression from "compression";
import sirv from "sirv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(compression());

const clientDistPath = path.join(__dirname, "../dist/client");

const sirvOptions = {
  etag: true,
  gzip: true,
};

app.use("/", sirv(clientDistPath, sirvOptions));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});