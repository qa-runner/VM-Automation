// Opens the generated Allure report in a browser, generating it first if it is missing.
// Usage: npm run allure:open
const fs = require('fs');
const { exec, spawnSync } = require('child_process');
const net = require('net');

// Finds a free port so a second report can be opened without stopping the first one.
function getAvailablePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();

      server.on('error', () => {
        tryPort(port + 1);
      });

      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port));
      });
    };

    tryPort(startPort);
  });
}

async function main() {
  const reportDir = './allure-report';

  // Generate the report on demand, then merge the trend history into it.
  if (!fs.existsSync(reportDir)) {
    console.log('Allure report not found. Generating it now...');
    const result = spawnSync('npx', ['allure', 'generate', './allure-results', '--clean', '-o', './allure-report'], {
      stdio: 'inherit',
      shell: true,
    });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }

    const trends = spawnSync('node', ['./scripts/allure-history.js', 'sync'], {
      stdio: 'inherit',
      shell: true,
    });

    if (trends.status !== 0) {
      process.exit(trends.status || 1);
    }
  }

  // Serve the folder report, because a single file report cannot show trends.
  const port = await getAvailablePort(Number(process.env.ALLURE_PORT || 5050));
  const command = `npx allure open "${reportDir}" --host 127.0.0.1 --port ${port}`;

  console.log(`Opening Allure at http://127.0.0.1:${port}`);
  exec(command, { stdio: 'inherit', shell: true }, (error) => {
    if (error) {
      console.error('Unable to open Allure report:', error);
      process.exit(error.code || 1);
    }
  });
}

main().catch((error) => {
  console.error('Unable to open Allure report:', error);
  process.exit(1);
});
