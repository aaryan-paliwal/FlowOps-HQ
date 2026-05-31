const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/analytics/traffic?from=2026-05-27T10:00:00.000Z',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer ' + process.env.TEST_TOKEN
    }
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
});

req.on('error', e => console.error(e));
req.end();
