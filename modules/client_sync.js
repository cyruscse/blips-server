/**
 * Handle client sync requests. Form a JSON response containing a list of supported attraction types.
 * This will be extended later to include other client-required information.
 */

const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const attractionTypeQueryStr = "select * from AttractionTypes";
const userIDQueryStr = "select * from Users where Email = \"";
const userInsertQueryStr = "insert into Users values (NULL, ";
const userPrefQueryStr = "select AttractionTypes.Name, UserPreferences.Frequency from UserPreferences inner join AttractionTypes on UserPreferences.AID = AttractionTypes.ID where UserPreferences.UID = \""

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var clientID;
var clientRequest;
var response;
var attractionTypes;

/**
 * Form JSON containing list of attraction types to sync to client.
 *
 * There is also a section for attributes, this isn't currently used - but it will be used soon
 */
function reply(results) {
	var jsonReply = {};

	if (clientRequest.syncType == "getattractions") {
		var attributeData = {
			city_count: 1
		};

		jsonReply["attributes"] = [];
		jsonReply["attributes"].push(attributeData);

		jsonReply["attraction_types"] = [];

		for (type in attractionTypes) {
			jsonReply["attraction_types"].push(attractionTypes[type]);
		}		
	}
	else if (clientRequest.syncType == "login") {
		jsonReply["userID"] = clientID;

		for (i = 0; i < results.length; i++) {
			jsonReply[results[i].Name] = results[i].Frequency;
		}
	}

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply);

	response.end();
}


// need to query UserPreferences, modify reply() ^^^ to handle user logins and return a JSONified form of UserPrefs
function getUserPreferences() {
	let query = userPrefQueryStr + clientID + "\"";

	mySQLClient.queryAndCallback(query, reply);
}

function userCreationCallback(results) {
	clientID = results[0].insertId;
	getUserPreferences();
}

function createNewUser() {
	let query = userInsertQueryStr + "\"" + clientRequest.name + "\", \"" + clientRequest.email + "\")";

	mySQLClient.queryAndCallback(query, userCreationCallback);
}

// Callback for mysql_client. Call reply() with DB results.
function attractionTypeCallback(results) {
	attractionTypes = results;

	reply([]);
}

function userQueryCallback(results) {
	if (results.length == 0) {
		createNewUser();
	}
	else {
		clientID = results[0].ID;
		getUserPreferences();
	}
}

// Query DB for AttractionTypes table
function queryAttractionTypes() {
	mySQLClient.queryAndCallback(attractionTypeQueryStr, attractionTypeCallback);
}

function queryUserExistence() {
	let query = userIDQueryStr + clientRequest.email + "\"";

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

    } else if (jsonRequest.syncType == "login") {
        queryUserExistence();       
    }
}
