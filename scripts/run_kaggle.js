const https = require('https');
const fs = require('fs');

const TOKEN = 'KGAT_49e5a55d136e787aa80cf09a95353dca';
const USERNAME = 'muhammadistafa';

function callMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    });
    const req = https.request('https://www.kaggle.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const raw = data.replace(/^event: message\ndata: /, '').trim();
          resolve(JSON.parse(raw));
        } catch(e) {
          resolve({ raw: data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { callMcp, TOKEN, USERNAME };

