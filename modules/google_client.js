const maps = require('@google/maps');
const Promise = require('promise');
const mySQLClient = require('./mysql_client.js');
const placeTypes = require('google-place-types');
const logging = require('./logging.js');

const blipBulkInsertQueryStr = "insert into Blips values ?";
const attrTypeBulkInsertQueryStr = "insert into AttractionTypes values ?";

// Google API key for Blips
var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

var clientLongitude, clientLatitude;
var requestedOpenNow = true;
var requestedRadius = 250;
var attractionType = "lodging";
var callerCallback;

// Logging Module setup
const log_file = '/tmp/google_client.log';
var module_trace_level = logging.warning_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

// Perform post DB-Setup tasks
function databaseReadyCallback(emptyDB) {
	if (emptyDB) {
		log(logging.warning_level, "Rebuilding Google attraction type table");

		var toInsert = new Array();
		var types = new Array();

		placeTypes.map(type => types.push(type));

		for (index in types) {
			var row = new Array();

			row.push("NULL");
			row.push(types[index]);

			toInsert.push(row);
		}

		var queryStr = attrTypeBulkInsertQueryStr;

		mySQLClient.bulkInsert(queryStr, toInsert, null);
	}
}

mySQLClient.addDBReadyCallback(databaseReadyCallback);

// Queries the Google API for nearby attractions, given a latitude, longitude and attractionType
// If the API call is successful, the callback function is called with the data returned from the Google API
exports.placesNearbyToLocation = (location, attractionType, requestedRadius, openNow, callback) => {
    console.log(location, requestedRadius, openNow, attractionType);
    mapsClient.placesNearby({ location: location, radius: requestedRadius, opennow: openNow, type: attractionType }).asPromise()
	    .then ((mapResponse) => {
	    	console.log("in");
	    	log(logging.trace_level, "placesNearbyToLocation succeeded");
	    	callback(mapResponse.json);
	    })
	    .catch ((err) => {
	    	var str = JSON.stringify(err.json);
	        log(logging.error_level, str);
	    });
}

exports.geocodeLatLng = (location, callback) => {
	mapsClient.reverseGeocode({ latlng: location }).asPromise()
		.then ((googleResponse) => {
			log(logging.trace_level, "geocodeLatLng succeeded");
			callback(googleResponse.json);
		})
		.catch ((err) => {
			var str = JSON.stringify(err.json);
	        log(logging.error_level, str);
		});
}

exports.geocodeLocation = (locationStr, callback) => {
	mapsClient.geocode({ address: locationStr }).asPromise()
		.then ((googleResponse) => {
			log(logging.trace_level, "geocodeLocation succeeded");
			callback(googleResponse.json);
		})
		.catch ((err) => {
			var str = JSON.stringify(err.json);
	        log(logging.error_level, str);
		});
}

var cachedReturnCallback = (results, callback, queryArgs) => {
	callerCallback();
}

var setCachedTime = () => {
	/*var queryStr = cachedQueryStr + mySQLClient.escape(blipID);

	mySQLClient.queryAndCallback(queryStr, cachedReturnCallback, null, null);*/
}

var dbCachingCallback = (apiResponse) => {
	var toInsert = new Array();

	log(logging.trace_level, "db caching callback with length " + apiResponse.results.length);

	if (apiResponse.results.length == 0) {
		return;
	}

	for (i = 0; i < apiResponse.results.length; i++) {
		var row = new Array();

		row.push(apiResponse.results[i].id);
		row.push(blipID);
		row.push(attractionType);
		row.push(apiResponse.results[i].name);
		row.push(apiResponse.results[i].geometry.location.lat);
		row.push(apiResponse.results[i].geometry.location.lng);
		
		if (apiResponse.results[i].rating != null) {
			row.push(apiResponse.results[i].rating);
		} else {
			row.push("0");
		}

		toInsert.push(row);
	}

	var queryStr = blipBulkInsertQueryStr;

	mySQLClient.bulkInsert(queryStr, toInsert, setCachedTime);
}
