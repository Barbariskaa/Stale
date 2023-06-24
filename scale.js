const https = require('https');
const http = require('http');
const axios = require('axios');

//Scale deployment url: https://dashboard.scale.com/spellbook/api/v2/deploy/9jm7gs9
const SCALE_URL=""
// API Key
const SCALE_API=""

const JSON_stringify_fixed = (obj) => JSON.stringify(obj).replace(
  /[\u007f-\uffff]/g,
  (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4),
);

async function fetchData(messages) {
  const data = {
    input: {
      input: JSON_stringify_fixed(messages).replace(/\\n/g, '\n').replace(/\\\n/g, '\n').replace(/\\\\"/g, '"').replace(/\\\"/g, '"')
    }
  }
  const headers = { 
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(JSON_stringify_fixed(data)),
    Authorization: `Basic ${SCALE_API}`
  }
  const result = await axios.post(SCALE_URL, data, {
      headers
  });
  return result.data.output
}

const readBody = (res) => new Promise((resolve, reject) => {
  let buffer = '';

  res.on('data', chunk => {
      buffer += chunk;
  });

  res.on('end', () => {
      try {
          resolve(JSON.parse(buffer));
      } catch (e) {
          reject(e);
      }
  });
})

async function main() {
    const server = http.createServer(async (req, res) => {
        if (req.method.toUpperCase() === 'POST') {
            const body = await readBody(req, true);
            const {
                messages,
            } = body;
            res.setHeader('Content-Type', 'application/json');
            const id = `chatcmpl-${(Math.random().toString(36).slice(2))}`;
            const created = Math.floor(Date.now() / 1000);

            let result = ""
            console.log("Starting fetch...")
            try {
                result = await fetchData(JSON.stringify(messages));
                console.log("Fetched. Scale response:\n\n", result)
                console.log("\n\n\n\n",result.replace(/\\n/g, '\n').replace(/\\\\"/g, '"').replace(/\\\"/g, '"'))
             } catch (error) {
                result = error
             }             
            res.write(JSON.stringify({
                id, created,
                object: 'chat.completion',
                model: "GPT-4 filtered",
                choices: [{
                    message: {
                        role: 'assistant',
                        content: result.replace?.(/\\n/g, ' \n').replace(/\\"/g, '"')
                    },
                    finish_reason: 'stop',
                    index: 0,
                }]
            }))
            res.end();
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify({
                object: 'list',
                data: [
                    { id: 'GPT-4', object: 'model', created: Date.now(), owned_by: 'OpenAI', permission: [], root: 'GPT-4', parent: null },
                ]
            }));
        }
        res.end();
    });

    server.listen(5003, '0.0.0.0', () => {
        console.log(`proxy for scale: 'http://127.0.0.1:5003/'`);
    });
}

main().catch(console.error);
