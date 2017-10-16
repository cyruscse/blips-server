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

function placesCallback(httpResponse, places) {
    for (i = 0; i < places.json.results.length; i++) {
        httpResponse.write(places.json.results[i].name + ", " + places.json.results[i].vicinity);
        httpResponse.write('\n');
    }

    httpResponse.end('top ' + places.json.results.length + ' lodging attractions displayed\n');
}

function locationCallback(httpResponse, location) {
    httpResponse.write('post received: location lat ' + location.lat + ' lng ' + location.lng + '\n');
    googleClient.placesNearbyToLocation(location, httpResponse, placesCallback)
}

function geocodeCallback(httpResponse, mapResponse) {
    googleClient.getLocation(mapResponse.json, httpResponse, locationCallback);
}

const server = http.createServer((request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');

    if (request.method == 'POST') {
        console.log('POST');

        var body = '';

        request.on('data', function (data) {
            body += data;
            console.log('Partial body: ' + data);
        });

        request.on('end', function () {
            response.writeHead(200, {'Content-Type': 'text/html'});

            var queryStr =  cityQuery + mysqlConnection.escape(body);

            mysqlConnection.query(queryStr, function (error, cityResults, fields) {
                if (error) throw error;

                var cityName, provinceName, countryName;

                try {
                    cityName = cityResults[0].Name;
                } catch (error) {
                    response.end('post with bad data received, not querying');

                    return;
                }

                //ugly nested queries, fix this...

                queryStr = provinceQuery + cityResults[0].PID;

                mysqlConnection.query(queryStr, function (error, provinceResults, fields) {
                    if (error) throw error;
                    queryStr = countryQuery + cityResults[0].CID;

                    try {
                        provinceName = provinceResults[0].Name;
                    } catch (error) {
                        response.end('SQL query failed for Province, aborting');

                        return;
                    }

                    mysqlConnection.query(queryStr, function (error, countryResults, fields) {
                        if (error) throw error;

                        try {
                            countryName = countryResults[0].Name;
                        } catch (error) {
                            response.end('SQL query failed for Country, aborting');

                            return;
                        }

                        googleClient.geocodeLocString(cityName, provinceName, countryName, response, geocodeCallback);
                    })
                })
            });
        });
    }
    else {
        console.log('GET');
        //var html = fs.readFileSync('index.html');
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end('get received');
    }
});

server.listen(port, hostname, () => {
    console.log('Server running at http://' + hostname + ':' + port + '/');
});