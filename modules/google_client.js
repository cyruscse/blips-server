const maps = require('@google/maps');
const Promise = require('promise');

var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

var attractionType;
var callerCallback;

var placesNearbyToLocation = (location) => {
    placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: attractionType }).asPromise()
	    .then ((mapResponse) => {
	    	callerCallback(location.lat, location.lng, mapResponse.json);
	    })
	    .catch ((err) => {
	        console.log(err);
	    });
}

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
