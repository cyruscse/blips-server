const http = require('http');
const fs = require('fs');
const Promise = require('promise');

const hostname = 'localhost';
const port = 3000;

const cityQuery = "select * from City where ID = ";
const provinceQuery = "select * from Province where ID = ";
const countryQuery = "select * from Country where ID = ";

// const places = require('./places.js'); - not yet implemented
const googleClient = require('./google_client.js');
const mysqlClient = require('./mysql_client.js');

const mysqlConnection = mysqlClient(hostname, 'root', 'pass', 'blips');
mysqlConnection.connect();

function getLocCallback(res, location) {
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
            res.writeHead(200, {'Content-Type': 'text/html'});

            var queryStr =  cityQuery + mysqlConnection.escape(body);

            mysqlConnection.query(queryStr, function (error, cityResults, fields)
            {
                if (error) throw error;

                var cityName, provinceName, countryName;

                try {
                    cityName = cityResults[0].Name;
                } catch (error) {
                    res.end('post with bad data received, not querying');

                    return;
                }

                //ugly nested queries, fix this...

                queryStr = provinceQuery + cityResults[0].PID;

                mysqlConnection.query(queryStr, function (error, provinceResults, fields)
                {
                    if (error) throw error;
                    queryStr = countryQuery + cityResults[0].CID;

                    try {
                        provinceName = provinceResults[0].Name;
                    } catch (error) {
                        res.end('SQL query failed for Province, aborting');

                        return;
                    }

                    mysqlConnection.query(queryStr, function (error, countryResults, fields)
                    {
                        if (error) throw error;

                        try {
                            countryName = countryResults[0].Name;
                        } catch (error) {
                            res.end('SQL query failed for Country, aborting');

                            return;
                        }

                        googleClient.geocodeLocString(cityName, provinceName, countryName, res, geocodeCallback);
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