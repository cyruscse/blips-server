// need new module description

var port = process.env.PORT || 3000,
    http = require('http'),
    fs = require('fs'),
    promise = require('promise'),
    html = fs.readFileSync('index.html');

const googleClient = require('./modules/google_client.js');
const mySQLClient = require('./modules/mysql_client.js');
const logging = require('./modules/logging.js');
const clientSync = require('./modules/client_sync.js');
const queryRequest = require('./modules/query_request.js');

const oneDayInSeconds = 86400;

// Response that goes back to POSTing client
var httpResponse;
// Inputs from client
var jsonInputs;

// Logging Module setup
const log_file = '/tmp/main.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

/*
var attractionsCallback = (results, callerCallback, callerArgs) => {
    // MOVE THIS TO ITS OWN JSON MODULE

    var jsonReply = {};

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

    log(logging.trace_level, "Responding with " + jsonReply);
    httpResponse.write(jsonReply);

    httpResponse.end();
}

var blipRecacheCallback = () => {
    var queryStr = "select * from Blips where Type = " + mySQLClient.escape(jsonInputs.type) + " and BID = " + mySQLClient.escape(jsonInputs.cityID);

    mySQLClient.queryAndCallback(queryStr, attractionsCallback, null, null);
}

var tableRowCountCallback = (rowCount) => {
    if (rowCount == 0) {
        log(logging.warning_level, "db empty for blip, cache call for cityID " + jsonInputs.cityID);
        googleClient.cacheLocationWithType(blip[0], blip[1], blip[2], jsonInputs.cityID, jsonInputs.type, blipRecacheCallback);
    }
    else {
        blipRecacheCallback();
    }
}

var blipModTimeCallback = (time) => {
    var currentTimeSeconds = Date.now() / 1000 | 0;

    if (currentTimeSeconds > (time + oneDayInSeconds)) {
        log(logging.warning_level, "stale DB (cached at " + time + ", currently " + currentTimeSeconds + ") , cache call for cityID " + jsonInputs.cityID);
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

    log(logging.trace_level, 'Place callback with ' + cityName + ' ' + provinceName + ' ' + countryName);

    mySQLClient.getBlipLastModifiedTime(cityName, blipModTimeCallback);
}
*/

function handleJSONRequest (response, jsonRequest) {
    if (jsonRequest.requestType == "query") {
        queryRequest.query(response, jsonRequest);

    } else if (jsonRequest.requestType == "dbsync") {
        clientSync.sync(response, jsonRequest);        
    }
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
            // this initial input and JSON handling should be moved
            response.writeHead(200, {'Content-Type': 'text/html'});

            var jsonRequest;

            try {
                jsonRequest = JSON.parse(body);

                log(logging.trace_level, "Incoming request " + jsonRequest);

                if (typeof jsonRequest != 'object') {
                    log(logging.trace_level, 'Bad JSON posted');
                    response.end();

                    return;
                }
            } catch (error) {
                log(logging.trace_level, 'Bad JSON posted ' + error);
                response.end();

                return;
            }

            jsonInputs = jsonRequest;
            httpResponse = response;

            log(logging.trace_level, 'received POST with requestType ' + jsonInputs.requestType);

            handleJSONRequest(response, jsonInputs);
        });
    }
    else {
        log(logging.trace_level, 'received GET');
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(html);
        response.end();
    }
});

server.listen(port, () => {
    console.log('Server running on port ' + port);
});