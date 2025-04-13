const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Kills any process running on the specified port
 * @param {number} port - The port number to free up
 * @returns {Promise<boolean>} - True if the port was successfully freed or already free
 */
async function killProcessOnPort(port) {
  try {
    const command = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} | grep LISTEN`;
    
    const { stdout } = await execAsync(command);
    
    if (!stdout || stdout.trim() === '') {
      console.log(`No processes found running on port ${port}`);
      return true;
    }
    
    // Extract PID based on platform
    let pid;
    if (process.platform === 'win32') {
      // Windows format: TCP/UDP IPAddress:Port IPAddress:Port LISTENING/ESTABLISHED PID
      const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
      if (lines.length > 0) {
        pid = lines[0].trim().split(/\s+/).pop();
      }
    } else {
      // Unix format varies but typically PID is the second column
      const lines = stdout.split('\n');
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/);
        pid = parts[1];
      }
    }
    
    if (!pid) {
      console.log(`Could not find PID for process on port ${port}`);
      return false;
    }
    
    // Kill the process
    const killCommand = process.platform === 'win32'
      ? `taskkill /F /PID ${pid}`
      : `kill -9 ${pid}`;
    
    await execAsync(killCommand);
    console.log(`Successfully killed process ${pid} on port ${port}`);
    return true;
  } catch (error) {
    console.error(`Error killing process on port ${port}:`, error.message);
    return false;
  }
}

module.exports = { killProcessOnPort }; 