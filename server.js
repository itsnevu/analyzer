/* eslint-disable @typescript-eslint/no-require-imports */
// Passenger (cPanel) entry point — must be CommonJS.
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = "0.0.0.0";

require("./.next/standalone/server.js");
