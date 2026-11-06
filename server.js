// Passenger (cPanel "Setup Node.js App") entry point.
// Passenger sets PORT via the environment; Next.js standalone server honours it.
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = "0.0.0.0";

require("./.next/standalone/server.js");
