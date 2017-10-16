const maps = require('@google/maps');
const Promise = require('promise');

var mapsClient = maps.createClient({
	key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

exports.placesCallback = (httpResponse, places) => {
    for (i = 0; i < places.json.results.length; i++) {
        httpResponse.write(places.json.results[i].name + ", " + places.json.results[i].vicinity);
        httpResponse.write('\n');
    }

    httpResponse.end('top ' + places.json.results.length + ' lodging attractions displayed\n');
}

exports.locationCallback = (httpResponse, location) => {
    httpResponse.write('post received: location lat ' + location.lat + ' lng ' + location.lng + '\n');
    googleClient.placesNearbyToLocation(location, httpResponse, placesCallback)
}

exports.geocodeCallback = (httpResponse, mapResponse) => {
    googleClient.getLocation(mapResponse.json, httpResponse, locationCallback);
}

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
