/**
 * Handle client sync requests. Form a JSON response containing a list of supported attraction types.
 * This will be extended later to include other client-required information.
 */

const mySQLClient = require('./mysql_client.js');
const googleClient = require('./google_client.js');
const logging = require('./logging.js');
const pythonshell = require('python-shell');

const attr_replace_script = "modules/attraction_replace.py"

const attractionTypeQueryStr = "select * from AttractionTypes";
const userIDQueryStr = "select * from Users where Email = \"";
const userInsertQueryStr = "insert into Users values (NULL, ";
const userDeleteQueryStr = "delete from Users where ID = \"";
const userPrefQueryStr = "select AttractionTypes.Name, UserPreferences.Frequency from UserPreferences inner join AttractionTypes on UserPreferences.AID = AttractionTypes.ID where UserPreferences.UID = \""
const userClearHistoryQueryStr = "delete from UserPreferences where UID = \"";

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
function reply(results, errorType) {
	var jsonReply = {};

	if (errorType == "OK") {
		if (clientRequest.syncType == "getattractions") {
			var attributeData = {
				client_key: googleClient.getClientKey()
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
	}

	jsonReply["status"] = [];
	jsonReply["status"].push(errorType);

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply, function (err) { response.end() } );
}

function getPrefsCallback(results) {
	reply(results, "OK");
}

// need to query UserPreferences, modify reply() ^^^ to handle user logins and return a JSONified form of UserPrefs
function getUserPreferences() {
	let query = userPrefQueryStr + clientID + "\"";

	mySQLClient.queryAndCallback(query, getPrefsCallback);
}

function userCreationCallback(results) {
	clientID = results.insertId;
	getUserPreferences();
}

function createNewUser() {
	if (!("name" in clientRequest) || !("email" in clientRequest)) {
		log(logging.warning_level, "User creation arguments missing (clientRequest: " + clientRequest + ")\n");

		reply([], "USER_CREATE_ARGS_MISSING");

		return;
	}

	let query = userInsertQueryStr + "\"" + clientRequest.name + "\", \"" + clientRequest.email + "\")";

	mySQLClient.queryAndCallback(query, userCreationCallback);
}

// Callback for mysql_client. Call reply() with DB results.
function attractionTypeCallback(results) {
	attractionTypes = results;

	reply([], "OK");
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

function userQueryCallback(results) {
	reply(results, "OK");
}

function queryUserExistence() {
	if (!("email" in clientRequest)) {
		log(logging.warning_level, "User query arguments missing (clientRequest: " + clientRequest + ")\n");

		reply([], "USER_QUERY_ARGS_MISSING");

		return;
	}

	let query = userIDQueryStr + clientRequest.email + "\"";

	mySQLClient.queryAndCallback(query, userQueryCallback);
}

function clearHistoryCallback(results) {
	reply([], "OK");
}

function clearUserHistory() {
	if (!("userID" in clientRequest)) {
		log(logging.warning_level, "History clear arguments missing (clientRequest: " + clientRequest + ")\n");

		reply([], "HIST_CLEAR_ARGS_MISSING");

		return;
	}

	let query = userClearHistoryQueryStr + clientRequest.userID + "\"";

	mySQLClient.queryAndCallback(query, clearHistoryCallback);
}

function setUserHistory() {
	if (!("history" in clientRequest) || !("userID" in clientRequest)) {
		log(logging.warning_level, "User merge arguments missing (clientRequest: " + clientRequest + ")\n");
		reply([], "ATTR_MERGE_ARGS_MISSING");

		return;
	}

	let historyStr = clientRequest.history.replace("[", "{").replace("]", "}");
	let historyDict = JSON.parse(historyStr);

	var queryArgs = mySQLClient.getDBDetails();
	queryArgs.push(clientRequest.userID);

	for (entry in historyDict) {
		queryArgs.push(entry);
		queryArgs.push(historyDict[entry]);
	}
	
	var options = {
		mode: 'text',
		pythonPath: '/usr/bin/python35',
		args: queryArgs
	};

	pythonshell.run(attr_replace_script, options, function (error, results) {
		if (error) {
			log(logging.warning_level, "Failed to merge user and guest histories (clientRequest: " + clientRequest + ")\n");
			reply([], "ATTR_MERGE_FAILED");

			return;
		}
		
		reply([], "OK");
	});
}

function deleteUser() {
	if (!("userID" in clientRequest)) {
		log(logging.warning_level, "User deletion failed (clientRequest: " + clientRequest + ")\n");
		reply([], "USER_DELETE_ARGS_MISSING");

		return;
	}

	let query = userDeleteQueryStr + clientRequest.userID + "\"";

	mySQLClient.queryAndCallback(query, clearUserHistory);
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
    }
    else if (jsonRequest.syncType == "login") {
        queryUserExistence();       
    }
    else if (jsonRequest.syncType == "clearHistory") {
    	clearUserHistory();
    }
    else if (jsonRequest.syncType == "setHistory") {
    	setUserHistory();
    }
    else if (jsonRequest.syncType == "deleteUser") {
    	deleteUser();
    }
    else {
    	reply([], "BAD_REQUEST_TYPE");

    	return;
    }
}
