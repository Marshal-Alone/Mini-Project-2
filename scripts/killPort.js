#!/usr/bin/env node

const { killProcessOnPort } = require('../backend/utils/portUtils');

// Get the port from command line arguments or use default
const args = process.argv.slice(2);
const defaultPort = 5050;
const port = args.length > 0 ? parseInt(args[0], 10) : defaultPort;

if (isNaN(port)) {
  console.error(`Invalid port: ${args[0]}`);
  console.log('Usage: npm run kill-port [port-number]');
  process.exit(1);
}

console.log(`Attempting to kill process on port ${port}...`);

(async () => {
  try {
    const result = await killProcessOnPort(port);
    if (result) {
      console.log(`Successfully freed port ${port}`);
      process.exit(0);
    } else {
      console.log(`Could not free port ${port}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})(); 