#!/usr/bin/env node
/**
 * Set Capacitor server.url from ATTENDIFY_PUBLIC_ORIGIN or RENDER_EXTERNAL_URL.
 * Usage: node scripts/set-capacitor-server.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "capacitor.config.json");
const origin = String(
  process.env.ATTENDIFY_PUBLIC_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    process.argv[2] ||
    ""
).replace(/\/$/, "");

if (!origin) {
  console.error("Set ATTENDIFY_PUBLIC_ORIGIN or pass URL: node scripts/set-capacitor-server.js https://xxx.onrender.com");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.server = config.server || {};
config.server.url = origin;
config.server.cleartext = origin.indexOf("https://") !== 0;
config.server.allowNavigation = config.server.allowNavigation || ["*.onrender.com"];

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Capacitor server.url set to", origin);