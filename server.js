const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const os = require("os");

const PORT = Number(process.env.ATTENDIFY_PORT) || 3000;
const HTTPS_PORT = Number(process.env.ATTENDIFY_HTTPS_PORT) || 3443;
/** Bind dual-stack so http://localhost (IPv6) and http://127.0.0.1 both hit this app — not a second process on :: only. */
const HOST = process.env.ATTENDIFY_HOST || "::";
const LISTEN_IPV6_ONLY = process.env.ATTENDIFY_IPV6_ONLY === "1";
const root = __dirname;
const pfxFile = path.join(root, "certs", "server.pfx");

function getNetworkIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Find IPv4 non-internal addresses
      if (net.family === "IPv4" && !net.internal) {
        // Prefer Wi-Fi or local network over VirtualBox/VMware virtual adapters
        if (!name.toLowerCase().includes("virtual") && !name.toLowerCase().includes("vbox") && !net.address.startsWith("192.168.56.")) {
          candidates.unshift(net.address);
        } else {
          candidates.push(net.address);
        }
      }
    }
  }
  return candidates[0] || "localhost";
}

function sendJson(res, status, body, extraHeaders) {
  const data = JSON.stringify(body);
  const headers = Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    extraHeaders || {}
  );
  res.writeHead(status, headers);
  res.end(data);
}

function runApi(handler) {
  return function (body) {
    try {
      return handler(body);
    } catch (error) {
      console.error(error);
      return { ok: false, error: error.message || "Server error." };
    }
  };
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

try {
  db.openDb();
} catch (error) {
  console.error("Database failed to open:", error.message);
  process.exit(1);
}

function handleRequest(req, res) {
  const isHttps = !!(req.socket && req.socket.encrypted);
  const currentPort = isHttps ? HTTPS_PORT : PORT;
  const protocol = isHttps ? "https:" : "http:";
  const url = new URL(req.url, protocol + "//localhost:" + currentPort);
  if (url.pathname.indexOf("/api/") === 0 && req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  if (url.pathname === "/api/host") {
    const lanIp = getNetworkIp();
    const hasHttps = fs.existsSync(pfxFile);
    sendJson(res, 200, {
      origin: "http://" + lanIp + ":" + PORT,
      httpsOrigin: hasHttps ? "https://" + lanIp + ":" + HTTPS_PORT : null,
      localOrigin: "http://localhost:" + PORT,
      lanIp: lanIp,
      port: PORT,
      httpsPort: hasHttps ? HTTPS_PORT : null
    });
    return;
  }
  if (url.pathname === "/api/state" && req.method === "GET") {
    sendJson(res, 200, db.loadState());
    return;
  }
  if (url.pathname === "/api/state" && req.method === "PUT") {
    readBody(req).then(function (body) {
      if (!body.classes || !body.students || !body.sessions) {
        sendJson(res, 400, { ok: false, error: "Invalid roster." });
        return;
      }
      if (!body.courses) body.courses = [];
      const state = db.saveState(body);
      sendJson(res, 200, { ok: true, state: state });
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not save the roster." }); });
    return;
  }
  if (url.pathname === "/api/classes" && req.method === "POST") {
    readBody(req).then(function (body) { sendJson(res, 200, runApi(db.addClass)(body || {})); })
      .catch(function () { sendJson(res, 400, { ok: false, error: "Could not create the programme." }); });
    return;
  }
  var classMatch = url.pathname.match(/^\/api\/classes\/([^/]+)\/?$/);
  if (classMatch) {
    var classId = decodeURIComponent(classMatch[1]);
    if (req.method === "PATCH" || req.method === "PUT") {
      readBody(req)
        .then(function (body) {
          body = body || {};
          body.id = body.id || classId;
          sendJson(res, 200, runApi(db.updateClass)(body));
        })
        .catch(function () {
          sendJson(res, 400, { ok: false, error: "Could not update the programme." });
        });
      return;
    }
    if (req.method === "DELETE") {
      sendJson(res, 200, runApi(db.deleteClass)({ id: classId }));
      return;
    }
  }
  var programmeCoursesMatch = url.pathname.match(/^\/api\/classes\/([^/]+)\/courses\/?$/);
  if (programmeCoursesMatch && req.method === "POST") {
    var programmeId = decodeURIComponent(programmeCoursesMatch[1]);
    readBody(req)
      .then(function (body) {
        body = body || {};
        body.classId = body.classId || programmeId;
        sendJson(res, 200, runApi(db.addProgrammeCourse)(body));
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not create the course." });
      });
    return;
  }
  if (url.pathname === "/api/students" && req.method === "POST") {
    readBody(req).then(function (body) { sendJson(res, 200, db.addStudent(body || {})); })
      .catch(function () { sendJson(res, 400, { ok: false, error: "Could not save the student." }); });
    return;
  }
  if (url.pathname === "/api/attendance" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.markPresent(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not record attendance." }); });
    return;
  }
  if (url.pathname === "/api/attendance/remove" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          sendJson(res, 200, db.removeAttendanceRecord(body || {}));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not undo." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request." });
      });
    return;
  }
  var sessionMatch = url.pathname.match(/^\/api\/sessions\/(\d+)\/?$/);
  if (sessionMatch && req.method === "GET") {
    sendJson(res, 200, db.getSessionDetail(sessionMatch[1]));
    return;
  }
  if (url.pathname === "/api/sessions/start" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          sendJson(res, 200, db.startAttendanceSession(body || {}));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not start attendance session." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request. Try again." });
      });
    return;
  }
  if (url.pathname === "/api/sessions/close" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          sendJson(res, 200, db.closeAttendanceSession(body || {}));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not end attendance session." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request. Try again." });
      });
    return;
  }
  if (url.pathname === "/api/sessions/share" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.shareSessionClasses(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not link shared lecture." }); });
    return;
  }

  // ── TA Share Token ──────────────────────────────────────────────────────
  if (url.pathname === "/api/ta/create" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.createTaToken(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not create TA token." }); });
    return;
  }

  var taTokenMatch = url.pathname.match(/^\/api\/ta\/([^/]+)$/);
  if (taTokenMatch && req.method === "GET") {
    sendJson(res, 200, db.getTaSession(decodeURIComponent(taTokenMatch[1])));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/dashboard.html";
  const file = path.resolve(root, "." + rel);
  if (!file.toLowerCase().startsWith(path.resolve(root).toLowerCase())) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, function (error, data) {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const httpServer = http.createServer(handleRequest);
httpServer.listen({ port: PORT, host: HOST, ipv6Only: LISTEN_IPV6_ONLY }, function () {
  const lanIp = getNetworkIp();
  console.log("Database: data/attendify.db");
  console.log("Local:    http://localhost:" + PORT + "/");
  console.log("          http://127.0.0.1:" + PORT + "/");
  console.log("Network:  http://" + lanIp + ":" + PORT + "/");
});

if (fs.existsSync(pfxFile)) {
  try {
    const httpsServer = https.createServer({
      pfx: fs.readFileSync(pfxFile),
      passphrase: "attendify123"
    }, handleRequest);
    httpsServer.listen({ port: HTTPS_PORT, host: HOST, ipv6Only: LISTEN_IPV6_ONLY }, function () {
      const lanIp = getNetworkIp();
      console.log("HTTPS Local:   https://localhost:" + HTTPS_PORT + "/");
      console.log("HTTPS Network: https://" + lanIp + ":" + HTTPS_PORT + "/");
    });
  } catch (err) {
    console.warn("Could not start HTTPS server:", err.message);
  }
}
