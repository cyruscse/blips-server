/**
 * Handle client query requests. Given the user's location, attraction type,
 * and requested radius, form a JSON response containing a list of attractions near the client.
 * Attractions are cached in the DB, and cache entries are considered stale after 24 hours.
 */

const googleClient = require('./google_client.js');
const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

// Logging Module setup
const log_file = '/tmp/query_request.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

// Frequently used SQL queries
const blipBulkInsertQueryStr = "insert ignore into Blips values ?";
const blipQuery = "select * from Blips where ";
const locationCacheQuery = "select * from LocationCache where ";
const locationCacheInsert = "insert into LocationCache values (";
const blipCacheClear  = "delete from Blips where BID = "

// JSON tags returned from Google API calls, used to filter
// response from Google
const geocodeFilter = "political";
const geocodeCityFilter = "locality";
const geocodeStateFilter = "administrative_area_level_1";
const geocodeCountryFilter = "country";

const oneDayInSeconds = 86400;
const R = 6371;

const clientTypeOffset = 3;

// Private variables used for querying
var lcID;                    // Location cache ID, ID for current row in LocationCache table
var response;                // httpResponse from main, JSON reply is written here and sent back to client
var nextPageToken = "";      // Next page token returned from Google, used to paginate response past 20 places

// Private variables relating to client's request
var cells;
var cellsIdx;

var cityRows;
var cellRadius;
var cellsRemaining = 0;

var clientRequest;			 // Client's JSON request
var clientCity;				 // Client's city name, this has too much responsibility, break this up
var clientCurrentType = 0;

var jsonReply = {};

/**
 * Calculate distance between two lat/lng points
 * Distance is returned in meters
 **/
function distance (lat1, lng1, lat2, lng2) {
	let dLat = deg2rad(lat2 - lat1);
	let dLng = deg2rad(lng2 - lng1);
	let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
			Math.sin(dLng/2) * Math.sin(dLng/2);

	let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	let d = R * c;

	return (d * 1000);		//Return in meters
}

function calculateNewLocation (oldLat, oldLng, dx, dy) {
	let newLocation = {
		lat: oldLat + ((dy / 1000) / R) * (180 / Math.PI),
		lng: oldLng + ((dx / 1000) / R) * (180 / Math.PI) / Math.cos(oldLat * Math.PI / 180)
	};

	return newLocation;
}

// Convert degrees to radians
function deg2rad (deg) {
	return deg * (Math.PI / 180);
}

function writeResponse () {
	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply);

	response.end();
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

	for (i = 0; i < results.length; i++) {
		let distanceFromClient = distance(results[i].Latitude, results[i].Longitude, clientRequest.latitude, clientRequest.longitude);

		if (distanceFromClient <= clientRequest.radius) {
			var data = {
				name: results[i].Name,
				type: results[i].Type,
				latitude: results[i].Latitude,
				longitude: results[i].Longitude
			};

			jsonReply[numberResults] = data;
			numberResults++;
		}
	}

	clientCurrentType++;

	if (clientCity.length == (clientCurrentType + clientTypeOffset)) {
		writeResponse();
	}
	else {
		queryNewType();
	}
}

/**
 * Called when either placesNearby(Callback) is finished or if a cache call was successful.
 *
 * Query the Blips DB for a list of responses corresponding to the current LocationCache ID.
 **/
function placeLookupComplete () {
	let queryStr = blipQuery + "LCID = " + lcID;

	mySQLClient.queryAndCallback(queryStr, blipLookupCallback);
}

/**
 * Callback for call to placesNearby.
 *
 * Parse the list of places, creating rows for the Blips table and using a bulk insert to insert all rows at once.
 * Google's placesNearby API only returns 20 places at a time. If 20 are returned, a next_page_token is included in the JSON reply,
 * which can be used as a key for the next 20 results (this is repeated up to 60 places). If next_page_token exists, call queryPlaces again
 * to get the rest of the results.
 **/
function placesNearbyCallback (jsonReply) {
	var callback;
	var toInsert = new Array();

	// Loop through 2D array of city cells
	if (cellsRemaining == 0) {
		callback = placeLookupComplete;
	}
	else {
		cellsRemaining--;

		console.log(cellsIdx.i + " " + cellsIdx.j + " " + cityRows);

		if (cellsIdx.i == 5) {
			if ((cellsIdx.j + 1) < cityRows) {
				cellsIdx.i = 0;
				cellsIdx.j++;

				callback = queryPlaces;
			}
			else {
				callback = placeLookupComplete;
			}
		}
		else {
			cellsIdx.i++;

			callback = queryPlaces;
		}
	}

	console.log("post " + cellsIdx.i + " " + cellsIdx.j + " " + jsonReply.results);

	if (jsonReply.results.length == 0) {
		log(logging.warning_level, "Got no place results for city " + clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2] + " - jumping to callback");
		callback();
	}

	for (i = 0; i < jsonReply.results.length; i++) {
		var row = new Array();

		row.push(jsonReply.results[i].id);
		row.push(lcID);
		row.push(clientCity[clientCurrentType + clientTypeOffset]);
		row.push(jsonReply.results[i].name);
		row.push(jsonReply.results[i].geometry.location.lat);
		row.push(jsonReply.results[i].geometry.location.lng);

		toInsert.push(row);
	}

	var queryStr = blipBulkInsertQueryStr;

	mySQLClient.bulkInsert(queryStr, toInsert, callback);
}

/**
 * Now that we have the center coordinate, radius to city limits, and attraction type, call Google's placesNearby API to get a list of places
 *
 * Call placesNearbyCallback with the results.
 **/
function queryPlaces () {
	let currentCellLat = cells[cellsIdx.i][cellsIdx.j].lat;
	let currentCellLng = cells[cellsIdx.i][cellsIdx.j].lng;

	log(logging.trace_level, "Getting places on location " + currentCellLat + " " + currentCellLng + " of type " + clientCity[clientCurrentType + clientTypeOffset] + " with radius (in meters) " + cellRadius);

	if (nextPageToken.length == 0) {
		let location = [currentCellLat, currentCellLng];

		googleClient.placesNearbyToLocation(location, clientCity[clientCurrentType + clientTypeOffset], cellRadius, false, "", placesNearbyCallback);
	}
	else {
		console.log("GOT MORE THAN 20 RESULTS FIX FIX FI");
		response.end();
		return;
	}
}

// Save the ID of the newly created LocationCache row.
function idCallback (results) {
	lcID = results[0].ID;

	queryPlaces();
}

/**
 * Called from mysql_client after a new row is inserted into the LocationCache table.
 *
 * Ask the DB for the ID of the new row and then call idCallback with the results.
 */
function cacheCreationCallback (results) {
	let queryStr = locationCacheQuery + "city = \"" + clientCity[0] + "\" and state = \"" + clientCity[1] + "\" and country = \"" + clientCity[2] + "\" and Type = \"" + clientCity[clientCurrentType + clientTypeOffset] + "\"";

	mySQLClient.queryAndCallback(queryStr, idCallback);
}

/**
 * Callback function for Google geocode call.
 *
 * JSON reply from geocode call contains northeast and southwest bounds of city.
 * geocodeLocationCallback find the center coordinate and calculates the radius from the center to the northeast bound.
 * This center coordinate and radius is used to create a bounding circle around the city for the call to placesNearby.
 */
function geocodeLocationCallback (jsonReply) {
	let neBound = jsonReply.results[0].geometry.viewport.northeast;
	let swBound = jsonReply.results[0].geometry.viewport.southwest;

	let nwBound = {
		lat: neBound.lat,
		lng: swBound.lng
	};
	
	let seBound = {
		lat: swBound.lat,
		lng: neBound.lng
	};

	let cityLength = distance(neBound.lat, neBound.lng, nwBound.lat, nwBound.lng);
	let cityWidth = distance(nwBound.lat, nwBound.lng, swBound.lat, swBound.lng);

	cells = new Array();
	cellRadius = cityLength / 7;	//7 needs to be a const
	cityRows = Math.ceil(cityWidth / cellRadius);
	cellsRemaining = 7 * cityRows;

	cellsIdx = {
		i: 0,
		j: 0
	};

	for (i = 0; i < 7; i++) {
		cells[i] = new Array();
		for (j = 0; j < cityRows; j++) {
			var newPt = calculateNewLocation(swBound.lat, swBound.lng, (cellRadius * i), (cellRadius * j));
			cells[i][j] = newPt;
		}
	}

	log(logging.trace_level, "Geocoded client location, city is " + clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2]);
	log(logging.trace_level, "City length is " + cityLength + " width is " + cityWidth + " cellRadius is " + cellRadius + " cityRows " + cityRows);

	// Set up SQL insertion for new LocationCache row
	let queryStr = locationCacheInsert + "\"" + clientCity[0] + "\", \"" + clientCity[1] + "\", \"" + clientCity[2] + "\", \"" + clientCity[clientCurrentType + clientTypeOffset] + "\", (now()), NULL)";

	mySQLClient.queryAndCallback(queryStr, cacheCreationCallback);
}

/**
 * Called from cacheCallback if a row for the client's city and attraction type combination doesn't exist.
 *
 * First step is to geocode the client's city, province/state, and country name to a set of coordinates and a radius of the city.
 **/
function getCacheBounds () {
	let locationStr = clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2];

	googleClient.geocodeLocation(locationStr, geocodeLocationCallback);
}

/**
 * Called by mysql_client with results of cache time check.
 *
 * If the requested LocationCache row was modified in the last 24 hours, then the cache is valid
 * and we can directly call placeLookupComplete.
 *
 * If the requested LocationCache row hasn't been modified in the last 24 hours, the cache is considered to be
 * stale. Call mysql_client to remove the stale row with a callback function of queryPlaces.
 **/
function timeCheckCallback (results) {
	let currentTimeSeconds = Date.now() / 1000 | 0;

	if (currentTimeSeconds > (results + oneDayInSeconds)) {
		log(logging.warning_level, "Stale location (" + clientCity[0] + " " + clientCity[1] + " " + clientCity[2] + "), cached at " + results + ", currently " + currentTimeSeconds + ")");
		
		let queryStr = blipCacheClear + " " + lcID;

		mySQLClient.queryAndCallback(queryStr, queryPlaces);
	}
	else {
		placeLookupComplete();
	}
}

/**
 * LocationCache search callback function for mysql_client
 *
 * If a row exists, results.length will be 1. Ask the DB to retrieve the last time that LocationCache entry was modified 
 *
 * If a row doesn't exist, results.length will be 0. Call getCacheBounds() to create a new row for LocationCache
 **/
function cacheCallback (results) {
	log(logging.trace_level, "Cache callback got " + results.length + " results, for clientCity " + clientCity);

	if (results.length == 0) {
		getCacheBounds();
	}
	else {
		lcID = results[0].ID;
		let cachedTime = results[0].CachedTime;

		mySQLClient.getUnixTimestamp(cachedTime, timeCheckCallback);
	}
}

function queryNewType () {
	// Check DB if a row exists in LocationCache for the client's city, with the client's requested attraction type
	let queryStr = locationCacheQuery + "city = \"" + clientCity[0] + "\" and state = \"" + clientCity[1] + "\" and country = \"" + clientCity[2] + "\" and Type = \"" + clientCity[clientCurrentType + clientTypeOffset] + "\"";

	log(logging.trace_level, "Checking LocationCache with query " + queryStr); 

	// Query DB server for LocationCache entry, then call cacheCallback with the results
	mySQLClient.queryAndCallback(queryStr, cacheCallback);
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

	clientCurrentType = 0;
	clientCity = new Array();

	clientCity.push(city);
	clientCity.push(state);
	clientCity.push(country);

	if (Array.isArray(clientRequest.types)) {
		for (i = 0; i < clientRequest.types.length; i++) {
			clientCity.push(clientRequest.types[i]);
		}
	}
	else {
		clientCity.push(clientRequest.types);
	}	

	queryNewType();
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

	let location = [jsonRequest.latitude, jsonRequest.longitude];

	// Ask Google to reverse geocode client's location
	// Input is client's location as latitude and longitude
	// gecodeLatLngCallback is called from google_client with the JSON reply from Google
	googleClient.geocodeLatLng(location, geocodeLatLngCallback);
}
