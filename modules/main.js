const http = require('http');
const fs = require('fs');
const Promise = require('promise');

const hostname = 'localhost';
const port = 3000;

// const places = require('./places.js'); - not yet implemented
const googleClient = require('./google_client.js');
const mysqlClient = require('./mysql_client.js');

const mysqlConnection = mysqlClient(hostname, 'root', 'pass', 'blips');
mysqlConnection.connect();

function getLocCallback(res, location) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('post received: location lat ' + location.lat + ' lng ' + location.lng + '\n');
}

function geocodeCallback(res, response) {
    googleClient.getLocation(response.json, res, getLocCallback);
}

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
            var queryStr = "select * from City where ID = " + mysqlConnection.escape(body);

            mysqlConnection.query(queryStr, function (error, cityResults, fields)
            {
                if (error) throw error;
                console.log('City is ' + cityResults[0].Name);

                //ugly nested queries, fix this...

                queryStr = "select * from Province where ID = " + cityResults[0].PID;

                mysqlConnection.query(queryStr, function (error, provinceResults, fields)
                {
                    if (error) throw error;
                    console.log('Province is ' + provinceResults[0].Name);

                    queryStr = "select * from Country where ID = " + cityResults[0].CID;

                    mysqlConnection.query(queryStr, function (error, countryResults, fields)
                    {
                        if (error) throw error;
                        console.log('Country is ' + countryResults[0].Name);

                        var city = cityResults[0].Name;
                        var province = provinceResults[0].Name;
                        var country = countryResults[0].Name;

                        googleClient.geocodeLocString(city.toString(), province.toString(), country.toString(), res, geocodeCallback);
                    })
                })
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