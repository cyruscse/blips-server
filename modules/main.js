const http = require('http');
const fs = require('fs');
const Promise = require('promise');

const hostname = 'localhost';
const port = 3000;

const places = require('./places.js');
const googleClient = require('./google_client.js');

var httpResponse;
var jsonInputs;

var googleCallback = (blipLatitude, blipLongitude, apiResponse) => {
    httpResponse.write("Latitude: " + blipLatitude + " Longitude: " + blipLongitude + "\n");
    httpResponse.write(apiResponse.results.length + " locations: \n");

    for (i = 0; i < apiResponse.results.length; i++) {
        httpResponse.write("\t" + apiResponse.results[i].name + ", " + apiResponse.results[i].vicinity + "\n");
    }

    httpResponse.end();
}

var placeCallback = (cityName, provinceName, countryName) => {
    httpResponse.write(cityName + ", " + provinceName + ", " + countryName + "\n");
    googleClient.geocodeLocString(cityName, provinceName, countryName, jsonInputs.type, googleCallback);
}

var server = http.createServer((request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');

    if (request.method == 'POST') {
        var body = '';

        request.on('data', function (data) {
            body += data;
        });

        request.on('end', function () {
            response.writeHead(200, {'Content-Type': 'text/html'});

            var jsonRequest;

            try {
                jsonRequest = JSON.parse(body);
            } catch (error) {
                console.log('Bad JSON posted'); //redirect this somewhere, implement different logging levels and system to handle levels
                response.end();

                return;
            }

            jsonInputs = jsonRequest;
            httpResponse = response;

            places.blipLookup(jsonInputs.cityID, placeCallback);
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