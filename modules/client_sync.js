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
const userPrefQueryStr = 'select AttractionTypes.Name, UserPreferences.Frequency from UserPreferences inner join AttractionTypes on UserPreferences.AID = AttractionTypes.ID where UserPreferences.UID = \"';
const userClearHistoryQueryStr = "delete from UserPreferences where UID = \"";
const userChangeAutoOptionsQueryStr = "insert into UserAutoQueryOptions ("
const userAutoOptionsQueryStr = "select Enabled, TypeGrabLength, OpenNow, Rating, PriceRange from UserAutoQueryOptions where UID = \"";
const userClearAutoOptionsQueryStr = "delete from UserAutoQueryOptions where UID = \"";
const blipSaveQueryStr = "insert into UserSavedBlips values (\"";
const savedBlipsQueryStr = "select Blips.ID, Blips.Name, Blips.Type, Blips.Rating, Blips.Price, Blips.IconURL, Blips.Latitude, Blips.Longitude from Blips inner join UserSavedBlips on Blips.ID = UserSavedBlips.BID where UserSavedBlips.UID = \"";

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

var userPrefsResults;
var autoQueryOptionsResults;

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
			jsonReply["userID"] = [];
			jsonReply["userID"].push(clientID);

			jsonReply["history"] = [];

			for (i = 0; i < userPrefsResults.length; i++) {
				let entry = {};
				entry[userPrefsResults[i].Name] = userPrefsResults[i].Frequency;
				jsonReply["history"].push(entry);
			}

			jsonReply["autoQueryOptions"] = [];

			jsonReply["autoQueryOptions"].push({
				"enabled": autoQueryOptionsResults[0].Enabled
			});

			jsonReply["autoQueryOptions"].push({
				"typeGrabLength": autoQueryOptionsResults[0].TypeGrabLength
			});

			jsonReply["autoQueryOptions"].push({
				"openNow": autoQueryOptionsResults[0].OpenNow
			});

			jsonReply["autoQueryOptions"].push({
				"rating": autoQueryOptionsResults[0].Rating
			});

			jsonReply["autoQueryOptions"].push({
				"priceRange": autoQueryOptionsResults[0].PriceRange
			});

			jsonReply["savedBlips"] = [];

			for (i = 0; i < results.length; i++) {
				let data = {
					name: results[i].Name,
					type: results[i].Type,
					rating: results[i].Rating,
					price: results[i].Price,
					placeID: results[i].ID,
					icon: results[i].IconURL,
					latitude: results[i].Latitude,
					longitude: results[i].Longitude
				}

				jsonReply["savedBlips"].push(data);
			}
		}
	}

	jsonReply["status"] = [];
	jsonReply["status"].push(errorType);

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply, function (err) { response.end() } );
}

function getSavedBlipsCallback(results) {
	reply(results, "OK");
}

function getAutoOptionsCallback(results) {
	autoQueryOptionsResults = results;

	let query = savedBlipsQueryStr + clientID + "\"";

	mySQLClient.queryAndCallback(query, getSavedBlipsCallback);
}

function getPrefsCallback(results) {
	userPrefsResults = results;

	let query = userAutoOptionsQueryStr + clientID + "\"";

	mySQLClient.queryAndCallback(query, getAutoOptionsCallback);
}

function getUserPreferences(results) {
	let query = userPrefQueryStr + clientID + "\"";

	mySQLClient.queryAndCallback(query, getPrefsCallback);
}

function userCreationCallback(results) {
	clientID = results.insertId;

	let query = userChangeAutoOptionsQueryStr + "UID) VALUES (" + clientID + ")";

	mySQLClient.queryAndCallback(query, getUserPreferences);
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

function queryUserExistence() {
	if (!("email" in clientRequest)) {
		log(logging.warning_level, "User query arguments missing (clientRequest: " + clientRequest + ")\n");

		reply([], "USER_QUERY_ARGS_MISSING");

		return;
	}

	let query = userIDQueryStr + clientRequest.email + "\"";

	mySQLClient.queryAndCallback(query, userQueryCallback);
}

function clearAutoOptionsCallback(results) {
	reply([], "OK");
}

function clearHistoryCallback(results) {
	let query = userClearAutoOptionsQueryStr + clientRequest.userID + "\"";

	mySQLClient.queryAndCallback(query, clearAutoOptionsCallback);
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

function updateAutoQueryOptionsCallback(results) {
	reply([], "OK");
}

function updateAutoQueryOptions() {
	if (!("userID" in clientRequest) || !("options" in clientRequest)) {
		log(logging.warning_level, "User deletion failed (clientRequest: " + clientRequest + ")\n");
		reply([], "AUTO_QUERY_OPTIONS_ARGS_MISSING");

		return;
	}

	var columns = new Array();
	var colVals = new Array();

	columns.push("UID");
	colVals.push(clientRequest.userID);

	for (i = 0; i < clientRequest.options.length; i++) {
		if (clientRequest.options[i].enabled != undefined) {
			columns.push("Enabled");
			colVals.push(clientRequest.options[i].enabled);
		}

		if (clientRequest.options[i].typeGrabLength != undefined) {
			columns.push("TypeGrabLength");
			colVals.push(clientRequest.options[i].typeGrabLength);
		}

		if (clientRequest.options[i].openNow != undefined) {
			columns.push("OpenNow");
			colVals.push(clientRequest.options[i].openNow);
		}

		if (clientRequest.options[i].rating != undefined) {
			columns.push("Rating");
			colVals.push(clientRequest.options[i].rating);
		}

		if (clientRequest.options[i].priceRange != undefined) {
			columns.push("PriceRange");
			colVals.push(clientRequest.options[i].priceRange);
		}
	}

	if (columns.length == 0) {
    	reply([], "BAD_AUTO_QUERY_OPTION");

    	return;
    }

    var queryStr = userChangeAutoOptionsQueryStr;

    for (i = 0; i < columns.length; i++) {
    	queryStr = queryStr + columns[i];

    	if (i < (columns.length - 1)) {
    		queryStr += ", ";
    	} else {
    		queryStr += ")";
    	}
    }

    queryStr = queryStr + " VALUES (";

    for (i = 0; i < colVals.length; i++) {
    	queryStr = queryStr + colVals[i];

    	if (i < (colVals.length - 1)) {
    		queryStr += ", ";
    	} else {
    		queryStr += ")";
    	}
    }

    queryStr = queryStr + " ON DUPLICATE KEY UPDATE ";

    for (i = 1; i < columns.length; i++) {
    	queryStr = queryStr + columns[i] + "=" + colVals[i];

    	if (i < (columns.length - 1)) {
    		queryStr += ", ";
    	}
    }

    mySQLClient.queryAndCallback(queryStr, updateAutoQueryOptionsCallback);
}

function saveBlipQueryCallback(results) {
	reply([], "OK");
}

function saveBlip() {
	if (!("userID" in clientRequest) || !("blipID" in clientRequest)) {
		log(logging.warning_level, "Blip save failed (clientRequest: " + clientRequest + ")\n");
		reply([], "BLIP_SAVE_ARGS_MISSING");

		return;
	}

	let queryStr = blipSaveQueryStr + clientRequest.userID + "\", \"" + clientRequest.blipID + "\")";

	mySQLClient.queryAndCallback(queryStr, saveBlipQueryCallback);
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
    } else if (jsonRequest.syncType == "clearHistory") {
    	clearUserHistory();
    } else if (jsonRequest.syncType == "setHistory") {
    	setUserHistory();
    } else if (jsonRequest.syncType == "deleteUser") {
    	deleteUser();
    } else if (jsonRequest.syncType == "updateAutoQueryOptions") {
    	updateAutoQueryOptions();
    } else if (jsonRequest.syncType == "saveBlip") {
    	saveBlip();
    } else {
    	reply([], "BAD_REQUEST_TYPE");

    	return;
    }
}
