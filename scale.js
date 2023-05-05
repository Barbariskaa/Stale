const https = require('https');
const http = require('http');

//Scale deployment url: https://dashboard.scale.com/spellbook/api/v2/deploy/9lytrlq
const SCALE_URL=""
// API Key
const SCALE_API=""

async function fetchData(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      input: {
        input: messages,
      },
    });
    console.log(data)
    console.log(data.length)
    console.log(Buffer.byteLength(data))
    const url = new URL(SCALE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
        Authorization: `Basic ${SCALE_API}`,
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        // Check if responseData contains Cloudflare Error 1020
        // Check if responseData is a valid JSON before attempting to parse it
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData.output);
        } catch (error) {
          // If parsing fails, reject with an error
          console.log(responseData)
          if(responseData=="error code: 1020") reject(responseData + "\n(Cloudflare: Access denied. Maybe you need to turn on VPN or something)");
          reject(responseData)
        }
      });
    });
    req.on('error', (error) => {
      console.log(error)
      reject(error);
    });
    req.write(data);
    req.end();
  });
}


const readBody = (res, json, onData) => new Promise((resolve, reject) => {
    let buffer = '';

    res.on('data', chunk => {
        onData?.(chunk.toString());
        buffer += chunk;
    });

    res.on('end', () => {
        try {
            if (json) buffer = JSON.parse(buffer);
            resolve(buffer);
        } catch (e) {
            console.error(buffer);
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
            console.log("got body\n",messages)
            const id = `chatcmpl-${(Math.random().toString(36).slice(2))}`;
            const created = Math.floor(Date.now() / 1000);

            let result = ""
            console.log("Starting fetch...")
            try {
                result = await fetchData(JSON.stringify(messages));
                console.log("Fetched. Scale response:\n\n", result)
                console.log("Preparing to send completion")
             } catch (error) {
                result = error
             }             
             console.log(result)
            res.write(JSON.stringify({
                id, created,
                object: 'chat.completion',
                model: "GPT-4 filtered",
                choices: [{
                    message: {
                        role: 'assistant',
                        content: result,
                    },
                    finish_reason: 'stop',
                    index: 0,
                }]
            }, (key, value) => (typeof value === "string") ? value.replace(/\\\\/g, "\\") : value)); // unescaping slashes
            res.end();
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify({
                object: 'list',
                data: [
                    { id: 'GPT-4 filtered', object: 'model', created: Date.now(), owned_by: 'OpenAI', permission: [], root: 'GPT-4 filtered', parent: null },
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
