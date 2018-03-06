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
const blipUnsaveQueryStr = "delete from UserSavedBlips where UID = \"";
const savedBlipsQueryStr = "select Blips.ID, Blips.Name, AttractionTypes.ProperName, Blips.Rating, Blips.Price, Blips.IconURL, Blips.Latitude, Blips.Longitude, LocationCache.city, LocationCache.country from Blips inner join UserSavedBlips on Blips.ID = UserSavedBlips.BID inner join LocationCache on Blips.LCID = LocationCache.ID inner join AttractionTypes on Blips.Type = AttractionTypes.Name where UserSavedBlips.UID = \"";
const clearSavedBlipsQueryStr = "delete from UserSavedBlips where UID = \"";

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var clientID = {};
var clientRequests = {};
var httpResponses = {};
var attractionTypes = {};

var userPrefsResults = {};
var autoQueryOptionsResults = {};

/**
 * Form JSON containing list of attraction types to sync to client.
 *
 * There is also a section for attributes, this isn't currently used - but it will be used soon
 */
function reply(requestKey, results, errorType) {
	var jsonReply = {};
	var clientRequest = clientRequests[requestKey];
	var httpResponse = httpResponses[requestKey];

	delete clientRequests[requestKey];
	delete httpResponses[requestKey];

	if (errorType == "OK") {
		if (clientRequest.syncType == "getattractions") {
			var attributeData = {
				client_key: googleClient.getClientKey()
			};

			jsonReply["attributes"] = [];
			jsonReply["attributes"].push(attributeData);

			jsonReply["attraction_types"] = [];

			let types = attractionTypes[requestKey];

			for (type in attractionTypes[requestKey]) {
				jsonReply["attraction_types"].push(types[type]);
			}

			delete attractionTypes[requestKey]
		}
		else if (clientRequest.syncType == "login") {
			jsonReply["userID"] = [];
			jsonReply["userID"].push(clientID[requestKey]);

			jsonReply["history"] = [];

			for (i = 0; i < userPrefsResults[requestKey].length; i++) {
				let entry = {};
				entry[userPrefsResults[requestKey][i].Name] = userPrefsResults[requestKey][i].Frequency;
				jsonReply["history"].push(entry);
			}

			jsonReply["autoQueryOptions"] = [];

			jsonReply["autoQueryOptions"].push({
				"enabled": autoQueryOptionsResults[requestKey][0].Enabled
			});

			jsonReply["autoQueryOptions"].push({
				"typeGrabLength": autoQueryOptionsResults[requestKey][0].TypeGrabLength
			});

			jsonReply["autoQueryOptions"].push({
				"openNow": autoQueryOptionsResults[requestKey][0].OpenNow
			});

			jsonReply["autoQueryOptions"].push({
				"rating": autoQueryOptionsResults[requestKey][0].Rating
			});

			jsonReply["autoQueryOptions"].push({
				"priceRange": autoQueryOptionsResults[requestKey][0].PriceRange
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
					longitude: results[i].Longitude,
					city: results[i].city,
					country: results[i].country
				}

				jsonReply["savedBlips"].push(data);
			}

			delete clientID[requestKey];
			delete autoQueryOptionsResults[requestKey];
		}
	}

	jsonReply["status"] = [];
	jsonReply["status"].push(errorType);

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	httpResponse.write(jsonReply, function (err) { httpResponse.end() } );
}

function getSavedBlipsCallback(results, requestKey) {
	reply(requestKey, results, "OK");
}

function getAutoOptionsCallback(results, requestKey) {
	autoQueryOptionsResults[requestKey] = results;

	let query = savedBlipsQueryStr + clientID[requestKey] + "\"";

	mySQLClient.queryAndCallback(query, getSavedBlipsCallback, requestKey);
}

function getPrefsCallback(results, requestKey) {
	userPrefsResults[requestKey] = results;

	let query = userAutoOptionsQueryStr + clientID[requestKey] + "\"";

	mySQLClient.queryAndCallback(query, getAutoOptionsCallback, requestKey);
}

function getUserPreferences(results, requestKey) {
	let query = userPrefQueryStr + clientID[requestKey] + "\"";

	mySQLClient.queryAndCallback(query, getPrefsCallback, requestKey);
}

function userCreationCallback(results, requestKey) {
	clientID[requestKey] = results.insertId;

	let query = userChangeAutoOptionsQueryStr + "UID) VALUES (" + clientID[requestKey] + ")";

	mySQLClient.queryAndCallback(query, getUserPreferences, requestKey);
}

function createNewUser(requestKey) {
	if (!("name" in clientRequests[requestKey]) || !("email" in clientRequests[requestKey])) {
		log(logging.warning_level, "User creation arguments missing (clientRequest: " + clientRequests[requestKey] + ")\n");

		reply(requestKey, [], "USER_CREATE_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let query = userInsertQueryStr + "\"" + clientRequests[requestKey].name + "\", \"" + clientRequests[requestKey].email + "\")";

	mySQLClient.queryAndCallback(query, userCreationCallback, requestKey);
}

// Callback for mysql_client. Call reply() with DB results.
function attractionTypeCallback(results, requestKey) {
	attractionTypes[requestKey] = results;

	reply(requestKey, [], "OK");
}

function userQueryCallback(results, requestKey) {
	if (results.length == 0) {
		createNewUser(requestKey);
	} else {
		clientID[requestKey] = results[0].ID;
		getUserPreferences([], requestKey);
	}
}

// Query DB for AttractionTypes table
function queryAttractionTypes(requestKey) {
	mySQLClient.queryAndCallback(attractionTypeQueryStr, attractionTypeCallback, requestKey);
}

function queryUserExistence(requestKey) {
	if (!("email" in clientRequests[requestKey])) {
		log(logging.warning_level, "User query arguments missing (clientRequest: " + clientRequests[requestKey] + ")\n");

		reply(requestKey, [], "USER_QUERY_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let query = userIDQueryStr + clientRequests[requestKey].email + "\"";

	mySQLClient.queryAndCallback(query, userQueryCallback, requestKey);
}

function clearSavedBlipsCallback(results, requestKey) {
	reply(requestKey, [], "OK");
}

function clearAutoOptionsCallback(results, requestKey) {
	let query = clearSavedBlipsQueryStr + clientRequests[requestKey].userID + "\"";

	mySQLClient.queryAndCallback(query, clearSavedBlipsCallback, requestKey);
}

function clearHistoryCallback(results, requestKey) {
	let query = userClearAutoOptionsQueryStr + clientRequests[requestKey].userID + "\"";

	mySQLClient.queryAndCallback(query, clearAutoOptionsCallback, requestKey);
}

function clearUserHistory(requestKey) {
	if (!("userID" in clientRequests[requestKey])) {
		log(logging.warning_level, "History clear arguments missing (clientRequest: " + clientRequests[requestKey] + ")\n");

		reply(requestKey, [], "HIST_CLEAR_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let query = userClearHistoryQueryStr + clientRequests[requestKey].userID + "\"";

	mySQLClient.queryAndCallback(query, clearHistoryCallback, requestKey);
}

function setUserHistory(requestKey) {
	if (!("history" in clientRequests[requestKey]) || !("userID" in clientRequests[requestKey])) {
		log(logging.warning_level, "User merge arguments missing (clientRequest: " + clientRequests[requestKey] + ")\n");
		reply(requestKey, [], "ATTR_MERGE_ARGS_MISSING");

		delete clientRequests[requestKey];

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
			reply(requestKey, [], "ATTR_MERGE_FAILED");

			delete clientRequests[requestKey];

			return;
		}
		
		reply(requestKey, [], "OK");
	});
}

function deleteUser(requestKey) {
	if (!("userID" in clientRequests[requestKey])) {
		log(logging.warning_level, "User deletion failed (clientRequest: " + clientRequests[requestKey] + ")\n");
		reply(requestKey, [], "USER_DELETE_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let query = userDeleteQueryStr + clientRequests[requestKey].userID + "\"";

	mySQLClient.queryAndCallback(query, clearUserHistory, requestKey);
}

function updateAutoQueryOptionsCallback(results, requestKey) {
	reply(requestKey, [], "OK");
}

function updateAutoQueryOptions(requestKey) {
	if (!("userID" in clientRequests[requestKey]) || !("options" in clientRequests[requestKey])) {
		log(logging.warning_level, "User deletion failed (clientRequest: " + clientRequests[requestKey] + ")\n");
		reply(requestKey, [], "AUTO_QUERY_OPTIONS_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	var columns = new Array();
	var colVals = new Array();

	columns.push("UID");
	colVals.push(clientRequests[requestKey].userID);

	for (i = 0; i < clientRequests[requestKey].options.length; i++) {
		if (clientRequests[requestKey].options[i].enabled != undefined) {
			columns.push("Enabled");
			colVals.push(clientRequests[requestKey].options[i].enabled);
		}

		if (clientRequests[requestKey].options[i].typeGrabLength != undefined) {
			columns.push("TypeGrabLength");
			colVals.push(clientRequests[requestKey].options[i].typeGrabLength);
		}

		if (clientRequests[requestKey].options[i].openNow != undefined) {
			columns.push("OpenNow");
			colVals.push(clientRequests[requestKey].options[i].openNow);
		}

		if (clientRequests[requestKey].options[i].rating != undefined) {
			columns.push("Rating");
			colVals.push(clientRequests[requestKey].options[i].rating);
		}

		if (clientRequests[requestKey].options[i].priceRange != undefined) {
			columns.push("PriceRange");
			colVals.push(clientRequests[requestKey].options[i].priceRange);
		}
	}

	if (columns.length == 0) {
    	reply(requestKey, [], "BAD_AUTO_QUERY_OPTION");

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

    mySQLClient.queryAndCallback(queryStr, updateAutoQueryOptionsCallback, requestKey);
}

function saveBlipQueryCallback(results, requestKey) {
	reply(requestKey, [], "OK");
}

function saveBlip(requestKey) {
	if (!("userID" in clientRequests[requestKey]) || !("blipID" in clientRequests[requestKey])) {
		log(logging.warning_level, "Blip save failed (clientRequest: " + clientRequests[requestKey] + ")\n");
		reply(requestKey, [], "BLIP_SAVE_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let queryStr = blipSaveQueryStr + clientRequests[requestKey].userID + "\", \"" + clientRequests[requestKey].blipID + "\")";

	mySQLClient.queryAndCallback(queryStr, saveBlipQueryCallback, requestKey);
}

function unsaveBlipQueryCallback(results, requestKey) {
	reply(requestKey, [], "OK");
}

function unsaveBlip(requestKey) {
	if (!("userID" in clientRequests[requestKey]) || !("blipID" in clientRequests[requestKey])) {
		log(logging.warning_level, "Blip unsave failed (clientRequest: " + clientRequests[requestKey] + ")\n");
		reply(requestKey, [], "BLIP_UNSAVE_ARGS_MISSING");

		delete clientRequests[requestKey];

		return;
	}

	let queryStr = blipUnsaveQueryStr + clientRequests[requestKey].userID + "\" and BID=\"" + clientRequests[requestKey].blipID + "\"";

	mySQLClient.queryAndCallback(queryStr, unsaveBlipQueryCallback, requestKey);
}

/**
 * Public facing function for client_sync.
 *
 * Receives requestKey to send back to client and JSON inputs from client
 * An example of a client request is available in postexamples/dbsync.json
 **/
exports.sync = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received DBSYNC request");

	let requestKey = Object.keys(clientRequests).length;

	clientRequests[requestKey] = jsonRequest;
	httpResponses[requestKey] = httpResponse;

	if (jsonRequest.syncType == "getattractions") {
        queryAttractionTypes(requestKey);
    } else if (jsonRequest.syncType == "login") {
        queryUserExistence(requestKey);
    } else if (jsonRequest.syncType == "clearHistory") {
    	clearUserHistory(requestKey);
    } else if (jsonRequest.syncType == "setHistory") {
    	setUserHistory(requestKey);
    } else if (jsonRequest.syncType == "deleteUser") {
    	deleteUser(requestKey);
    } else if (jsonRequest.syncType == "updateAutoQueryOptions") {
    	updateAutoQueryOptions(requestKey);
    } else if (jsonRequest.syncType == "saveBlip") {
    	saveBlip(requestKey);
    } else if (jsonRequest.syncType == "unsaveBlip") {
    	unsaveBlip(requestKey);
    } else {
    	reply(requestKey, [], "BAD_REQUEST_TYPE");

    	return;
    }
}
