/**
 * Create HTTP server, and receive JSON inputs from clients.
 *
 * Determine which module should handle the request and hand off all responsibility to
 * the selected module.
 **/

var port = process.env.PORT || 3000,
    http = require('http'),
    fs = require('fs'),
    promise = require('promise');

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

// Hand off response handling to the appropriate module
function handleJSONRequest (response, jsonRequest) {
    if (jsonRequest.requestType == "query") {
        queryRequest.query(response, jsonRequest);
    } else if (jsonRequest.requestType == "dbsync") {
        clientSync.sync(response, jsonRequest);        
    } else {
        jsonRequest.syncType = "error"
        clientSync.sync(response, jsonRequest);
    }
}

// Create the HTTP server, use JavaScript's JSON parsing to format the client POSTed data
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

                log(logging.trace_level, "Incoming request" + JSON.stringify(jsonRequest));

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
});

server.listen(port, () => {
    console.log('Server running on port ' + port);
});

