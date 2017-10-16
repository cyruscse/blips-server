const maps = require('@google/maps');
const Promise = require('promise');

// Google API key for Blips
var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

var attractionType;
var callerCallback;

// Queries the Google API for nearby attractions, given a latitude, longitude and attractionType
// If the API call is successful, the callback function is called with the data returned from the Google API
var placesNearbyToLocation = (location) => {
    placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: attractionType }).asPromise()
	    .then ((mapResponse) => {
	    	callerCallback(location.lat, location.lng, mapResponse.json);
	    })
	    .catch ((err) => {
	        console.log(err);
	    });
}

// Queries the Google API for the latitude and longitude of a given Blip
// Takes the cityName, provinceName, and countryName as parameters
// (type parameter is used to filter nearby places to a specific attraction type, used later)
// (callback is used to synchronously return the data from this module to the caller)
exports.geocodeLocString = (city, province, country, type, callback) => {
	attractionType = type;
	callerCallback = callback;

	mapsClient.geocode({ address: (city + " " + province + " " + country) }).asPromise()
        .then ((mapResponse) => {
        	placesNearbyToLocation(mapResponse.json.results[0].geometry.location);
        })
        .catch ((err) => {
        	console.log(err);
            throw err;
        });
}
