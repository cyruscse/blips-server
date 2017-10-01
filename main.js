const http = require('http');
const fs = require('fs');
const mysql = require('mysql');

const hostname = '127.0.0.1';
const port = 3000;

const sqlConnection = mysql.createConnection({
	host      : 'localhost',
	user      : 'root',
	password  : 'pass',
	database  : 'blips'
});

const server = http.createServer((req, res) => 
{
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');

	sqlConnection.connect();
	
	if (req.method == 'POST') 
	{
		console.log('POST');

		var response = 'none';

        sqlConnection.query('select * from Cities', function (error, results, fields) {
        	if (error) throw error;
        	console.log('First city is ', results[0].NAME);
        	response = results[0].NAME;
        });

        sqlConnection.end();

		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('post received ' + response);
	}
	else
	{
		console.log('GET');
		sqlConnection.end();
		//var html = fs.readFileSync('index.html');
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('get received');
	}
});

server.listen(port, hostname, () => 
{
	console.log('Server running at http://' + hostname + ':' + port + '/');
});