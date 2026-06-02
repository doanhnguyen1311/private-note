const http = require('http');

const data = JSON.stringify({
  registry: 'npm',
  packages: [
    { package: 'react' },
    { package: 'react-dom' },
    { package: 'electron' },
    { package: 'vite' },
    { package: 'electron-vite' },
    { package: 'tailwindcss' },
    { package: 'zustand' },
    { package: 'lucide-react' },
    { package: 'better-sqlite3' },
    { package: 'marked' },
    { package: 'dompurify' },
    { package: 'typescript' }
  ]
});

const options = {
  hostname: '127.0.0.1',
  port: 49999,
  path: '/dependency/scan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
