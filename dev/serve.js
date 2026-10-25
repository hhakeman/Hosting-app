// Dev-only static server: node dev/serve.js [seedPath]  → http://localhost:8765/dev/harness.html
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), seed = process.argv[2];
const types = {".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"};
http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  const file = p === "/dev-seed.json" && seed ? seed : path.join(root, p);
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); return res.end("nope"); } res.writeHead(200, {"content-type": types[path.extname(file)] || "application/octet-stream"}); res.end(b); });
}).listen(8765, () => console.log("dev server on http://localhost:8765/dev/harness.html"));
