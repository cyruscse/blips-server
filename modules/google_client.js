const maps = require('@google/maps');
const Promise = require('promise');
const mySQLClient = require('./mysql_client.js');
const placeTypes = require('google-place-types');
const logging = require('./logging.js');

// Frequently used SQL queries
const blipBulkInsertQueryStr = "insert into Blips values ?";
const attrTypeBulkInsertQueryStr = "insert into AttractionTypes values ?";

// Google API key for Blips
var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

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
// Currently the one task is to get a list attraction types supported by Google
// and insert them into the DB if the DB is empty
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

// Set this module as an observer of mysql_client
mySQLClient.addDBReadyCallback(databaseReadyCallback);

// Queries the Google API for nearby attractions, given a latitude, longitude, attractionType and search radius
// This also handles placesNearby pagination. If placesNearby returns 20 results, there are more results waiting.
// The API returns a next page token. If the API is called again with this token, it gets the next page of results.
// If the API call is successful, the callback function is called with the data returned from the Google API
exports.placesNearbyToLocation = (location, attractionType, requestedRadius, openNow, nextPageToken, callback) => {
    if (nextPageToken.length != 0) {
  		// Handle next page token
    	mapsClient.placesNearby({ location: location, pagetoken: nextPageToken }).asPromise()
    		.then ((mapResponse) => {
    			var str = JSON.stringify(mapResponse.json);
    			log(logging.trace_level, str);
    			callback(mapResponse.json);
    		})
    		.catch ((err) => {
    			var str = JSON.stringify(err.json);
    			log(logging.error_level, str);
    		});
    }
    else {
	    mapsClient.placesNearby({ location: location, radius: requestedRadius, opennow: openNow, type: attractionType, pagetoken: nextPageToken }).asPromise()
		    .then ((mapResponse) => {
		    	var str = JSON.stringify(mapResponse.json);
		    	log(logging.trace_level, str);
		    	callback(mapResponse.json);
		    })
		    .catch ((err) => {
		    	var str = JSON.stringify(err.json);
		        log(logging.error_level, str);
		    });
    }
}

// Queries Google API for city, province, and country name of given latitude and longitude
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

// Queries Google API for latitude and longitude of given location (as String)
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
