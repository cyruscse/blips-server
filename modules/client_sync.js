/**
 * Handle client sync requests. Form a JSON response containing a list of supported attraction types.
 * This will be extended later to include other client-required information.
 */

const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const attractionTypeQueryStr = "select * from AttractionTypes";
const userIDQueryStr = "select * from Users where ID = "

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var clientRequest;
var response;
var attractionTypes;

/**
 * Form JSON containing list of attraction types to sync to client.
 *
 * There is also a section for attributes, this isn't currently used - but it will be used soon
 */
function reply() {
	var jsonReply = {};

	var attributeData = {
		city_count: 1
	};

	jsonReply["attributes"] = [];
	jsonReply["attributes"].push(attributeData);

	jsonReply["attraction_types"] = [];

	for (type in attractionTypes) {
		jsonReply["attraction_types"].push(attractionTypes[type]);
	}

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply);

	response.end();
}

// Callback for mysql_client. Call reply() with DB results.
function attractionTypeCallback(results) {
	attractionTypes = results;

	reply();
}

function userQueryCallback(results) {
	console.log(results);
}

// Query DB for AttractionTypes table
function queryAttractionTypes() {
	mySQLClient.queryAndCallback(attractionTypeQueryStr, attractionTypeCallback);
}

function queryUserExistence() {
	let query = userIDQueryStr + clientRequest.uid;

	mySQLClient.queryAndCallback(query, userQueryCallback);
}

/**
 * Public facing function for client_sync.
 *
 * Receives httpResponse to send back to client and JSON inputs from client
 * An example of a client request is available in postexamples/dbsync.json
 **/
exports.sync = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received DBSYNC request");
	response = httpResponse;
	clientRequest = jsonRequest;

	if (jsonRequest.syncType == "getattractions") {
        queryAttractionTypes();

    } else if (jsonRequest.requestType == "login") {
        queryUserExistence();       
    }
}
