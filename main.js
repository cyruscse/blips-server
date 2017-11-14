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

var loggingModule = require('./modules/logging.js');
var logging = new loggingModule('main', loggingModule.trace_level);

var attractionsCallback = (results, callerCallback, callerArgs) => {
    /** MOVE THIS TO ITS OWN JSON MODULE **/
    /** REALLY, THIS IS UGLY, ESPECIALLY PUSHING BASIC BLIP INFO **/

    var jsonReply = {};

    var data = {
        city: blip[0],
        state: blip[1],
        country: blip[2]
    };

    jsonReply["blip"] = [];
    jsonReply["blip"].push(data);

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

    jsonReply = JSON.stringify(jsonReply);

    logging.log(loggingModule.trace_level, "Responding with " + jsonReply);
    httpResponse.write(jsonReply);

    httpResponse.end();
}

var blipRecacheCallback = () => {
    var queryStr = "select * from Blips where Type = " + mySQLClient.escape(jsonInputs.type);

    mySQLClient.queryAndCallback(queryStr, attractionsCallback, null, null);
}

var tableRowCountCallback = (rowCount) => {
    if (rowCount == 0) {
        logging.log(loggingModule.info_level, "db empty for blip, cache call for cityID " + jsonInputs.cityID);
        googleClient.cacheLocationWithType(blip[0], blip[1], blip[2], jsonInputs.cityID, jsonInputs.type, blipRecacheCallback);
    }
    else {
        blipRecacheCallback();
    }
}

var blipModTimeCallback = (time) => {
    var currentTimeSeconds = Date.now() / 1000 | 0;

    if (currentTimeSeconds > (time + oneDayInSeconds)) {
        logging.log(loggingModule.info_level, "stale DB (cached at " + time + ", currently " + currentTimeSeconds + ") , cache call for cityID " + jsonInputs.cityID);
        googleClient.cacheLocationWithType(blip[0], blip[1], blip[2], jsonInputs.cityID, jsonInputs.type, blipRecacheCallback);
    }
    else {
        mySQLClient.tableRowCount(jsonInputs.cityID, tableRowCountCallback);
    }
}

// Callback given to Places
// If Places successfully queries the SQL database for the POSTed BID (BlipID), ... It then calls the GoogleClient with
// the given city, province, and country name. (This can be further expanded to multiple callbacks that don't call the Google API)
var placeCallback = (cityName, provinceName, countryName) => {
    blip.push(cityName);
    blip.push(provinceName);
    blip.push(countryName);

    mySQLClient.getBlipLastModifiedTime(cityName, blipModTimeCallback);
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

                logging.log(loggingModule.trace_level, "Incoming request " + jsonRequest);

                if (typeof jsonRequest != 'object') {
                    logging.log(loggingModule.trace_level, 'Bad JSON posted');
                    response.end();

                    return;
                }
            } catch (error) {
                logging.log(loggingModule.trace_level, 'Bad JSON posted ' + error);
                response.end();

                return;
            }

            blip = new Array();
            jsonInputs = jsonRequest;
            httpResponse = response;

            logging.log(loggingModule.trace_level, 'received POST');
            places.blipLookup(jsonInputs.cityID, placeCallback);
        });
    }
    else {
        logging.log(loggingModule.trace_level, 'received GET');
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(html);
        response.end();
    }
});

// Listen on the earlier defined hostname and port
server.listen(port, () => {
    console.log('Server running on port ' + port);
});