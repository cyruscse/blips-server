const http = require('http');
const fs = require('fs');
const Promise = require('promise');

const hostname = 'localhost';
const port = 3000;

const places = require('./places.js');
const googleClient = require('./google_client.js');

var httpResponse;

var endResponse = (data) => {
    httpResponse.end(data);
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

            httpResponse = response;

            places.blipLookup(jsonRequest.cityID, endResponse);

            //response.end(blip[0] + " " + blip[1] + " " + blip[2]);
            //googleClient.geocodeLocString(cityName, provinceName, countryName, response, geocodeCallback);
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