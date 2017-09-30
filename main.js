const http = require('http');
const fs = require('fs');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => 
{
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	
	if (req.method == 'POST') 
	{
		console.log('POST');
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('post received');
	}
	else
	{
		console.log('GET');
		//var html = fs.readFileSync('index.html');
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('get received');
	}
});

server.listen(port, hostname, () => 
{
	console.log('Server running at http://' + hostname + ':' + port + '/');
});