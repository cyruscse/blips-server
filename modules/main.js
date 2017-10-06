const http = require('http');
const fs = require('fs');

const hostname = 'localhost';
const port = 3000;

// const places = require('./places.js'); - not yet implemented
const googleClient = require('./google_client.js');
const mysqlClient = require('./mysql_client.js');

const mysqlConnection = mysqlClient(hostname, 'root', 'pass', 'blips');
mysqlConnection.connect();

const mapsApi = googleClient.googleMapsClient();

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
            var geocodeTest = mapsApi.geocode({
                address:  '1125 Colonel By Drive, Ottawa, ON'
            }, function(err, response) {
                if (!err) {
                    console.log(response.json.results);
                }
                else {
                    console.log(err);
                }
            });

            var queryStr = 'select * from City where ID  = ' + mysqlConnection.escape(body);

            mysqlConnection.query(queryStr, function (error, results, fields)
            {
                if (error) throw error;
                console.log('First city is ' + results[0].Name);

                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('post received city' + results[0].Name + ' province ' + results[0].PID + ' country ' + results[0].CID + '\n');
            });
        });
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