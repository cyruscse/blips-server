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

sqlConnection.connect(function(err) {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        return;
    }

    console.log('Connected as ID ' + sqlConnection.threadID);
});

const server = http.createServer((req, res) => 
{
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');

    if (req.method == 'POST') 
    {
        console.log('POST');

        var body = '';

        req.on('data', function (data)
        {
            body += data;
            console.log('Partial body: ' + data);
        });

        req.on('end', function ()
        {
            var queryStr = 'select * from Cities where ID  = ' + sqlConnection.escape(body);

            sqlConnection.query(queryStr, function (error, results, fields)
            {
                if (error) throw error;
                console.log('First city is ' + results[0].NAME);

                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('post received city' + results[0].NAME + ' province ' + results[0].Province + ' country ' + results[0].Country);
            });
        });
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