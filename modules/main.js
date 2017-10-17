/**
 * Main creates and listens on the pre-defined hostname and port
 * When a client POSTs a JSON file containing a BlipID and attraction type, uses
 * the Place and GoogleClient modules to query the SQL database and call the Google API to get
 * information on a Blip
 */

const http = require('http');
const fs = require('fs');
const Promise = require('promise');

// Server address and port
const hostname = 'localhost';
const port = 3000;

// Places queries the SQL database for the given Blip ID, provides city, province, and country names
const places = require('./places.js');

// GoogleClient queries the Google Maps and Places API for exact latitude/longitude for a blip, then
// gets nearby attractions (which can be filtered by attraction type)
const googleClient = require('./google_client.js');

// Response that goes back to POSTing client
var httpResponse;

// Inputs from client
var jsonInputs;

// Callback given to GoogleClient
// If the Google API successfully retrieves the blip's location and gets the specified attractions,
// this callback function formats the output and returns it to the Blips client
var googleCallback = (blipLatitude, blipLongitude, apiResponse) => {
    httpResponse.write("Latitude: " + blipLatitude + " Longitude: " + blipLongitude + "\n");
    httpResponse.write(apiResponse.results.length + " locations: \n");

    for (i = 0; i < apiResponse.results.length; i++) {
        httpResponse.write("\t" + apiResponse.results[i].name + ", " + apiResponse.results[i].vicinity + " id " + apiResponse.results[i].id + "\n");
    }

    httpResponse.end();
}

// Callback given to Places
// If Places successfully queries the SQL database for the POSTed BID (BlipID), this callback function
// adds the city name, province name, and country name to the HTTP response. It then calls the GoogleClient with
// the given city, province, and country name. (This can be further expanded to multiple callbacks that don't call the Google API)
var placeCallback = (cityName, provinceName, countryName) => {
    httpResponse.write(cityName + ", " + provinceName + ", " + countryName + "\n");
    googleClient.geocodeLocString(cityName, provinceName, countryName, jsonInputs.type, googleCallback);
}

// Create the HTTP server, use JavaScript's JSON parsing to format the client POSTed data
// Currently calls the Place blipLookup function
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

                if (typeof jsonRequest != 'object') {
                    console.log('Bad JSON posted'); //redirect this somewhere, implement different logging levels and system to handle levels
                    response.end();

                    return;
                }
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

// Listen on the earlier defined hostname and port
server.listen(port, hostname, () => {
    console.log('Server running at http://' + hostname + ':' + port + '/');
});