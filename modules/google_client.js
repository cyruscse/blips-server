const maps = require('@google/maps');
const Promise = require('promise');

var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

exports.getLocation = (json, res, callback) => {
	if (json.status == "OK") {
		callback(res, json.results[0].geometry.location);
	}
}

exports.geocodeLocString = (city, province, country, res, callback) => {
	mapsClient.geocode({ address: (city + " " + province + " " + country) }).asPromise()
        .then ((response) => {
        	console.log(response)
        	callback(res, response)
        })
        .catch ((err) => {
        	console.log(err)
            throw err;
        });
}

exports.placesNearbyFromLoc = (location) => {
    var placesRet = mapsClient.placesNearby({ location: location, radius: 500, opennow: true, type: "lodging" }).asPromise()
	    .then ((response) => {
	        console.log(response.json)
	    })
	    .catch ((err) => {
	        console.log(err)
	    });

	return placesRet;
}
