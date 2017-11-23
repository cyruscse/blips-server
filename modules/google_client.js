const maps = require('@google/maps');
const Promise = require('promise');
const mySQLClient = require('./mysql_client.js');
const placeTypes = require('google-place-types');

const cachedQueryStr = "update City set Updated = (now()) where ID =";
const blipBulkInsertQueryStr = "insert into Blips values ?";
const attrTypeBulkInsertQueryStr = "insert into AttractionTypes values ?";

// Google API key for Blips
var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

var loggingModule = require('./logging.js');
var logging = new loggingModule('google_client', loggingModule.trace_level);

var attractionType;
var callerCallback;
var blipID;
var city, province, country;


// Perform post DB-Setup tasks
function databaseReadyCallback(emptyDB) {
	if (emptyDB) {
		logging.log("Rebuilding Google attraction type table");

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
var placesNearbyToLocation = (location) => {
    placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: attractionType }).asPromise()
	    .then ((mapResponse) => {
	    	logging.log("placesNearbyToLocation succeeded");
	    	dbCachingCallback(mapResponse.json);
	    })
	    .catch ((err) => {
	        logging.log(loggingModule.error_level, err);
	    });
}

// Queries the Google API for the latitude and longitude of a given Blip
// Takes the cityName, provinceName, and countryName as parameters
// (type parameter is used to filter nearby places to a specific attraction type, used later)
// (callback is used to synchronously return the data from this module to the caller)
var geocodeLocString = () => {
	mapsClient.geocode({ address: (city + " " + province + " " + country) }).asPromise()
        .then ((mapResponse) => {
        	logging.log("geocodeLocString successful");
        	placesNearbyToLocation(mapResponse.json.results[0].geometry.location);
        })
        .catch ((err) => {
        	logging.log(loggingModule.error_level, err);
            throw err;
        });
}

var cachedReturnCallback = (results, callback, queryArgs) => {
	callerCallback();
}

var setCachedTime = () => {
	var queryStr = cachedQueryStr + mySQLClient.escape(blipID);

	mySQLClient.queryAndCallback(queryStr, cachedReturnCallback, null, null);
}

var dbCachingCallback = (apiResponse) => {
	var toInsert = new Array();

	logging.log("db caching callback with length " + apiResponse.results.length);

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

exports.cacheLocationWithType = (cityStr, provinceStr, countryStr, BID, type, callback) => {
	attractionType = type;
	callerCallback = callback;
	city = cityStr;
	province = provinceStr;
	country = countryStr;
	blipID = BID;

	logging.log("caching call on city" + city + " BID " + blipID);

	geocodeLocString();
}
