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
// finish comments......
const blipBulkInsertQueryStr = "insert into Blips values ?";
const blipQuery = "select * from Blips where ";
const locationCacheQuery = "select * from LocationCache where ";
const locationCacheInsert = "insert into LocationCache values (";
const blipCacheClear  = "delete from Blips where BID = "

const geocodeFilter = "political";
const geocodeCityFilter = "locality";
const geocodeStateFilter = "administrative_area_level_1";
const geocodeCountryFilter = "country";

const oneDayInSeconds = 86400;

var lcID;
var response;
var nextPageToken = "";

var clientCityLat;
var clientCityLng;
var clientCityRadius;
var clientRequest;
var clientCity;

/**
 * Calculate distance between two lat/lng points
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

	return (d * 100);		//Return in meters
}

// Convert degrees to radians
function deg2rad (deg) {
	return deg * (Math.PI / 180);
}

function blipLookupCallback (results) {
	var jsonReply = {};
	var numberResults = 0;

	for (i = 0; i < results.length; i++) {
		let distanceFromClient = distance(results[i].Latitude, results[i].Longitude, clientRequest.latitude, clientRequest.longitude);

		if (distanceFromClient <= clientRequest.radius) {
			var data = {
				name: results[i].Name,
				latitude: results[i].Latitude,
				longitude: results[i].Longitude
			};

			jsonReply[numberResults] = data;
			numberResults++;
		}
	}

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply);

	response.end();
}

function placeLookupComplete () {
	let queryStr = blipQuery + "LCID = " + lcID;

	mySQLClient.queryAndCallback(queryStr, blipLookupCallback);
}

function placesNearbyCallback (jsonReply) {
	var callback;
	var toInsert = new Array();

	if (jsonReply.next_page_token) {
		nextPageToken = jsonReply.next_page_token;
		callback = queryPlaces;
	}
	else {
		callback = placeLookupComplete;
	}

	if (jsonReply.results.length == 0) {
		log(logging.warning_level, "Got no place results for city " + clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2]);
		return;
	}

	for (i = 0; i < jsonReply.results.length; i++) {
		var row = new Array();

		row.push(jsonReply.results[i].id);
		row.push(lcID);
		row.push(clientRequest.type);
		row.push(jsonReply.results[i].name);
		row.push(jsonReply.results[i].geometry.location.lat);
		row.push(jsonReply.results[i].geometry.location.lng);

		toInsert.push(row);
	}

	var queryStr = blipBulkInsertQueryStr;

	mySQLClient.bulkInsert(queryStr, toInsert, callback);
}

function pageTokenPlaceQuery () {
	let location = [clientCityLat, clientCityLng];
	var npToken = nextPageToken;
	nextPageToken = "";

	googleClient.placesNearbyToLocation(location, clientRequest.type, clientCityRadius, false, npToken, placesNearbyCallback);
}

function queryPlaces () {
	log(logging.trace_level, "Getting places on location " + clientCityLat + " " + clientCityLng + " of type " + clientRequest.type + " with radius (in meters) " + clientCityRadius);

	if (nextPageToken.length == 0) {
		let location = [clientCityLat, clientCityLng];

		googleClient.placesNearbyToLocation(location, clientRequest.type, clientCityRadius, false, "", placesNearbyCallback);
	}
	else {
		setTimeout(pageTokenPlaceQuery, 2000);
	}
}

function idCallback (results) {
	lcID = results[0].ID;

	queryPlaces();
}

function cacheCreationCallback (results) {
	let queryStr = locationCacheQuery + "city = \"" + clientCity[0] + "\" and state = \"" + clientCity[1] + "\" and country = \"" + clientCity[2] + "\" and Type = \"" + clientRequest.type + "\"";

	mySQLClient.queryAndCallback(queryStr, idCallback);
}

function geocodeLocationCallback (jsonReply) {
	let neBound = jsonReply.results[0].geometry.viewport.northeast;
	let swBound = jsonReply.results[0].geometry.viewport.southwest;

	clientCityLng = (neBound.lng + swBound.lng) / 2;
	clientCityLat = (neBound.lat + swBound.lat) / 2;

	clientCityRadius = distance(neBound.lat, neBound.lng, clientCityLat, clientCityLng);

	log(logging.trace_level, "Geocoded client location, city is " + clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2]);
	log(logging.trace_level, "City center is " + clientCityLat + ", " + clientCityLng + ", with radius " + clientCityRadius);

	let queryStr = locationCacheInsert + "\"" + clientCity[0] + "\", \"" + clientCity[1] + "\", \"" + clientCity[2] + "\", \"" + clientRequest.type + "\", " + clientCityLat + ", " + clientCityLng + ", " + clientCityRadius + ", (now()), NULL)";

	mySQLClient.queryAndCallback(queryStr, cacheCreationCallback);
}

function getCacheBounds () {
	let locationStr = clientCity[0] + ", " + clientCity[1] + ", " + clientCity[2];

	googleClient.geocodeLocation(locationStr, geocodeLocationCallback);
}

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

function cacheCallback (results) {
	log(logging.trace_level, "Cache callback got " + results.length + " results");

	if (results.length == 0) {
		getCacheBounds();
	}
	else {
		lcID = results[0].ID;
		clientCityLat = results[0].CenterLat;
		clientCityLng = results[0].CenterLng;
		clientCityRadius = results[0].Radius;

		let cachedTime = results[0].CachedTime;

		mySQLClient.getUnixTimestamp(cachedTime, timeCheckCallback);
	}
}

function geocodeLatLngCallback (jsonReply) {
	log(logging.trace_level, "Google geocode replied: " + jsonReply.results);

	var city, state, country;

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

	let queryStr = locationCacheQuery + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + clientRequest.type + "\"";

	mySQLClient.queryAndCallback(queryStr, cacheCallback);
}

exports.query = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received QUERY request");
	response = httpResponse;
	clientRequest = jsonRequest;

	let location = [jsonRequest.latitude, jsonRequest.longitude];

	googleClient.geocodeLatLng(location, geocodeLatLngCallback);
}
