const fs = require('fs');
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

const clientKey = 'AIzaSyB9_LQ5Osmo-XNjAMMqfNwc4qG_mEyXZ3Q';

// Logging Module setup
const log_file = '/tmp/google_client.log';
const translation_file = 'dbsetup/attraction_translate.txt'
var module_trace_level = logging.warning_level;
var translation_dict = {};

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

function translateAttractionName (attraction) {
	if (attraction in translation_dict) {
		return translation_dict[attraction];
	}
	else {
		return attraction;
	}
}

// Perform post DB-Setup tasks
// Currently the one task is to get a list attraction types supported by Google
// and insert them into the DB if the DB is empty
function databaseReadyCallback(emptyDB) {
	if (emptyDB) {
		log(logging.warning_level, "Rebuilding Google attraction type table");

		var translation_table = fs.readFileSync(translation_file).toString().split('\n');

		for (entry in translation_table) {
			var translation = translation_table[entry].split(' ');
			key = translation.shift();
			val = translation.join(' ').replace(/"/g, '');

			translation_dict[key] = val;
		}

		var toInsert = new Array();
		var types = new Array();

		placeTypes.map(type => types.push(type));

		for (index in types) {
			var row = new Array();

			row.push("NULL");
			row.push(types[index]);
			row.push(translateAttractionName(types[index]));

			toInsert.push(row);
		}

		var queryStr = attrTypeBulkInsertQueryStr;

		mySQLClient.bulkInsert(queryStr, toInsert, null);
	}
}

// Set this module as an observer of mysql_client
mySQLClient.addDBReadyCallback(databaseReadyCallback);

// Queries Google API for city, province, and country name of given latitude and longitude
exports.geocodeLatLng = (location, callback, callbackArgs) => {
	mapsClient.reverseGeocode({ latlng: location }).asPromise()
		.then ((googleResponse) => {
			log(logging.trace_level, "geocodeLatLng succeeded");
			callback(googleResponse.json, callbackArgs);
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

exports.getClientKey = () => {
	return clientKey;
}
