const maps = require('@google/maps');
const Promise = require('promise');

var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

exports.getLocation = (json, httpResponse, callback) => {
	if (json.status == "OK") {
		callback(httpResponse, json.results[0].geometry.location);
	}
}

exports.geocodeLocString = (city, province, country, httpResponse, callback) => {
	mapsClient.geocode({ address: (city + " " + province + " " + country) }).asPromise()
        .then ((mapResponse) => {
        	console.log(mapResponse);
        	callback(httpResponse, mapResponse);
        })
        .catch ((err) => {
        	console.log(err);
            throw err;
        });
}

exports.placesNearbyToLocation = (location, httpResponse, callback) => {
    placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: "lodging" }).asPromise()
	    .then ((mapResponse) => {
	    	//console.log(mapResponse.json);
	    	callback(httpResponse, mapResponse);
	    })
	    .catch ((err) => {
	        console.log(err);
	    });
}
