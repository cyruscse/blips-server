/**
 * Handle client query requests. Given the user's location, attraction type,
 * and requested radius, form a JSON response containing a list of attractions near the client.
 * Attractions are cached in the DB, and cache entries are considered stale after 24 hours.
 */

const googleClient = require('./google_client.js');
const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');
const pythonshell = require('python-shell');

// Logging Module setup
const log_file = '/tmp/query_request.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

const query_script = "modules/mt_query.py"

const blipQuery = "select Blips.Name, Blips.Latitude, Blips.Longitude, AttractionTypes.ProperName, Blips.Rating, Blips.Price, Blips.PhotoRef from Blips inner join AttractionTypes on Blips.Type = AttractionTypes.Name where ";

// JSON tags returned from Google API calls, used to filter
// response from Google
const geocodeFilter = "political";
const geocodeCityFilter = "locality";
const geocodeStateFilter = "administrative_area_level_1";
const geocodeCountryFilter = "country";

const clientTypeOffset = 3;

// Private variables used for querying
var lcID;                    // Location cache ID, ID for current row in LocationCache table
var response;                // httpResponse from main, JSON reply is written here and sent back to client

// Private variables relating to client's request
var clientRequest;			 // Client's JSON request
var clientCity;				 // Client's city name, this has too much responsibility, break this up
var queryArgs;

var jsonReply = {};

// Convert degrees to radians
function deg2rad (deg) {
	return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two lat/lng points
 * Distance is returned in meters
 **/
function distance (lat1, lng1, lat2, lng2) {
	let R = 6371;
	let dLat = deg2rad(lat2 - lat1);
	let dLng = deg2rad(lng2 - lng1);
	let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
			Math.sin(dLng/2) * Math.sin(dLng/2);
		
	let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	let d = R * c;
		
	return (d * 1000);		//Return in meters
}

function writeResponse (errorType) {
	jsonReply["status"] = [];
	jsonReply["status"].push(errorType);

	if (errorType != "OK") {
		log(logging.warning_level, "Query failed (clientRequest: " + clientRequest + ")\n");
	}

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply, function (err) { response.end() } );
}

/**
 * Callback for mysql_client Blips query
 *
 * Called with list of places corresponding to the current LocationCache ID.
 * Create a JSON response for the client that contains Blips within the client's specified radius
 * Write the JSON response to the client's httpResponse and send it back to the client.
 **/
function blipLookupCallback (results) {
	var numberResults = Object.keys(jsonReply).length;

	jsonReply["blips"] = [];

	for (i = 0; i < results.length; i++) {
		let distanceFromClient = distance(results[i].Latitude, results[i].Longitude, clientRequest.latitude, clientRequest.longitude);

		if ((distanceFromClient <= clientRequest.radius) && (results[i].Rating >= clientRequest.minRating) && (results[i].Price <= clientRequest.maxPrice)) {
			var data = {
				name: results[i].Name,
				type: results[i].ProperName,
				rating: results[i].Rating,
				price: results[i].Price,
				photo: results[i].PhotoRef,
				latitude: results[i].Latitude,
				longitude: results[i].Longitude
			};

			jsonReply["blips"].push(data);
			numberResults++;
		}
	}

	writeResponse("OK");
}

/**
 * Called when either placesNearby(Callback) is finished or if a cache call was successful.
 *
 * Query the Blips DB for a list of responses corresponding to the current LocationCache ID.
 **/
function placeLookupComplete (results) {
	let queryStr = blipQuery + "Blips.LCID = " + results[0];

	for (i = 1; i < results.length; i++) {
		queryStr = queryStr + " OR Blips.LCID = " + results[i];
	}

	mySQLClient.queryAndCallback(queryStr, blipLookupCallback);
}

function mtQuery () {
	var options = {
		mode: 'text',
		pythonPath: '/usr/bin/python35',
		args: queryArgs
	};

	pythonshell.run(query_script, options, function (error, results) {
		if (error) {
			log(logging.warning_level, "mt_query failed (clientRequest: " + clientRequest + ")\n");
			log(logging.warning_level, "mt_query failure specifics: " + error + "\n");

			writeResponse("QUERY_FAILED");
			return;
		}

		placeLookupComplete(results);
	});
}

/**
 * Reverse geocoding callback function for google_client
 *
 * JSON reply from Google contains city name, state/province name, and country name
 * These are filtered out from the JSON reply and saved in the clientCity array
 **/
function geocodeLatLngCallback (jsonReply) {
	var city, state, country;

	// Filter out city, state, and country
	for (i = 0; i < jsonReply.results[0].address_components.length; i++) {
		let geocodeTypes = jsonReply.results[0].address_components[i].types;
		let addressComp = jsonReply.results[0].address_components[i];

		if (geocodeTypes.includes(geocodeFilter)) {
			if (geocodeTypes.includes(geocodeCityFilter)) {
				city = addressComp.long_name;
			}

			if (geocodeTypes.includes(geocodeStateFilter)) {
				state = addressComp.long_name;
			}

			if (geocodeTypes.includes(geocodeCountryFilter)) {
				country = addressComp.long_name;
			}
		}
	}

	clientCity = new Array();

	clientCity.push(city);
	clientCity.push(state);
	clientCity.push(country);
	clientCity.push(clientRequest.userID);

	if (Array.isArray(clientRequest.types)) {
		for (i = 0; i < clientRequest.types.length; i++) {
			clientCity.push(clientRequest.types[i]);
		}
	}
	else {
		clientCity.push(clientRequest.types);
	}	

	queryArgs = mySQLClient.getDBDetails();
	queryArgs.push.apply(queryArgs, clientCity);

	mtQuery();
}

/**
 * Public facing function for query_request.
 *
 * Receives httpResponse to send back to client and JSON inputs from client
 * An example of a client request is available in postexamples/lodgingexample.json
 **/
exports.query = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received QUERY request");
	response = httpResponse;
	clientRequest = jsonRequest;
	jsonReply = {};

	if (!("latitude" in jsonRequest) || !("longitude" in jsonRequest)) {
		writeResponse("LOCATION_MISSING");

		return;
	}

	if (!("radius" in jsonRequest)) {
		writeResponse("SEARCH_RADIUS_MISSING");

		return;
	}

	if (!("types" in jsonRequest)) {
		writeResponse("ATTRACTION_TYPES_MISSING");

		return;
	}

	if (!("minRating" in jsonRequest)) {
		jsonRequest.minRating = 0.0;
	}

	if (!("maxPrice" in jsonRequest)) {
		jsonRequest.maxPrice = 3;
	}

	let location = [jsonRequest.latitude, jsonRequest.longitude];

	// Ask Google to reverse geocode client's location
	// Input is client's location as latitude and longitude
	// gecodeLatLngCallback is called from google_client with the JSON reply from Google
	googleClient.geocodeLatLng(location, geocodeLatLngCallback);
}
