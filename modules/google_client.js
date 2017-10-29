const maps = require('@google/maps');
const Promise = require('promise');
const mySQLClient = require('./mysql_client.js');

const cachedQueryStr = "update City set Updated = (now()) where ID =";

// Google API key for Blips
var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

var attractionType;
var callerCallback;
var blipID;
var city, province, country;

// Queries the Google API for nearby attractions, given a latitude, longitude and attractionType
// If the API call is successful, the callback function is called with the data returned from the Google API
var placesNearbyToLocation = (location) => {
    placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: attractionType }).asPromise()
	    .then ((mapResponse) => {
	    	dbCachingCallback(mapResponse.json)
	    })
	    .catch ((err) => {
	        console.log(err);
	    });
}

// Queries the Google API for the latitude and longitude of a given Blip
// Takes the cityName, provinceName, and countryName as parameters
// (type parameter is used to filter nearby places to a specific attraction type, used later)
// (callback is used to synchronously return the data from this module to the caller)
var geocodeLocString = () => {
	mapsClient.geocode({ address: (city + " " + province + " " + country) }).asPromise()
        .then ((mapResponse) => {
        	placesNearbyToLocation(mapResponse.json.results[0].geometry.location);
        })
        .catch ((err) => {
        	console.log(err);
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

	for (i = 0; i < apiResponse.results.length; i++) {
		var row = new Array();

		row.push(apiResponse.results[i].id);
		row.push(blipID);
		row.push(attractionType);
		row.push(apiResponse.results[i].name);
		row.push(apiResponse.results[i].geometry.location.lat);
		row.push(apiResponse.results[i].geometry.location.lng);
		row.push(apiResponse.results[i].rating);

		toInsert.push(row);
	}

	var queryStr = "insert into blips values ?";

	mySQLClient.bulkInsert(queryStr, toInsert, setCachedTime);
}

exports.cacheLocationWithType = (cityStr, provinceStr, countryStr, BID, type, callback) => {
	attractionType = type;
	callerCallback = callback;
	city = cityStr;
	province = provinceStr;
	country = countryStr;
	blipID = BID;

	geocodeLocString();
}
