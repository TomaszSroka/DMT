const express = require("express");
const path = require("path");
const { port } = require("./config/env");
const tableRoutes = require("./routes/table.routes");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(process.cwd(), "public")));

app.use("/api", tableRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`DMT app started on http://localhost:${port}`);
});
