const maps = require('@google/maps');
const Promise = require('promise');

exports.googleMapsClient = () => maps.createClient({
    key       : 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw',
    Promise   : Promise
});

exports.getLocation = (json) => {
	if (json.status == "OK") {
		return json.results[0].geometry.location;
	}

	return false;
}