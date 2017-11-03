/**
 * Main creates and listens on the pre-defined hostname and port
 * When a client POSTs a JSON file containing a BlipID and attraction type, uses
 * the Place and GoogleClient modules to query the SQL database and call the Google API to get
 * information on a Blip
 */

var port = process.env.PORT || 3000,
    http = require('http'),
    fs = require('fs'),
    promise = require('promise'),
    html = fs.readFileSync('index.html');

// Places queries the SQL database for the given Blip ID, provides city, province, and country names
const places = require('./modules/places.js');

// GoogleClient queries the Google Maps and Places API for exact latitude/longitude for a blip, then
// gets nearby attractions (which can be filtered by attraction type)
const googleClient = require('./modules/google_client.js');

const mySQLClient = require('./modules/mysql_client.js');

const oneDayInSeconds = 86400;

// Response that goes back to POSTing client
var httpResponse;

// Inputs from client
var jsonInputs;

var blip;

var attractionsCallback = (results, callerCallback, callerArgs) => {
    httpResponse.write(results.length + " locations: \n");

    /** MOVE THIS TO ITS OWN JSON MODULE **/

    var jsonReply = {}

    for (i = 0; i < results.length; i++) {
        jsonReply[i] = [];

        var data = {
            name: results[i].Name,
            latitude: results[i].Latitude,
            longitude: results[i].Longitude,
            rating: results[i].Rating
        };

        jsonReply[i].push(data);
    }

    jsonReply = JSON.stringify(jsonReply)

    console.log(jsonReply)
    httpResponse.write(jsonReply)

    httpResponse.end();
}

var blipRecacheCallback = () => {
    var queryStr = "select * from Blips where Type = " + mySQLClient.escape(jsonInputs.type);

    mySQLClient.queryAndCallback(queryStr, attractionsCallback, null, null);
}

var tableRowCountCallback = (rowCount) => {
    if (rowCount == 0) {
        googleClient.cacheLocationWithType(blip[0], blip[1], blip[2], jsonInputs.cityID, jsonInputs.type, blipRecacheCallback);
    }
    else {
        blipRecacheCallback();
    }
}

var blipModTimeCallback = (time) => {
    var currentTimeSeconds = Date.now() / 1000 | 0;

    if (currentTimeSeconds > (time + oneDayInSeconds)) {
        googleClient.cacheLocationWithType(blip[0], blip[1], blip[2], jsonInputs.cityID, jsonInputs.type, blipRecacheCallback);
    }
    else {
        mySQLClient.tableRowCount(jsonInputs.cityID, tableRowCountCallback);
    }
}

// Callback given to Places
// If Places successfully queries the SQL database for the POSTed BID (BlipID), this callback function
// adds the city name, province name, and country name to the HTTP response. It then calls the GoogleClient with
// the given city, province, and country name. (This can be further expanded to multiple callbacks that don't call the Google API)
var placeCallback = (cityName, provinceName, countryName) => {
    httpResponse.write(cityName + ", " + provinceName + ", " + countryName + "\n");

    blip.push(cityName);
    blip.push(provinceName);
    blip.push(countryName);

    mySQLClient.getBlipLastModifiedTime(cityName, blipModTimeCallback);
}

// AWS Logging mechanism
var log = function(entry) {
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

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

            /*var jsonRequest;

            try {
                jsonRequest = JSON.parse(body);

                console.log(jsonRequest);

                if (typeof jsonRequest != 'object') {
                    console.log('Bad JSON posted'); //redirect this somewhere, implement different logging levels and system to handle levels
                    response.end();

                    return;
                }
            } catch (error) {
                console.log('Bad JSON posted ' + error); //redirect this somewhere, implement different logging levels and system to handle levels
                response.end();

                return;
            }

            blip = new Array();
            jsonInputs = jsonRequest;
            httpResponse = response;*/

            log('received POST');
            response.write('post');
            response.end();

            //places.blipLookup(jsonInputs.cityID, placeCallback);

        });
    }
    else {
        console.log('GET');
        log('received GET');
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(html);
        response.end();
    }
});

// Listen on the earlier defined hostname and port
server.listen(port, () => {
    console.log('Server running at http://127.0.0.1:' + port + '/');
});