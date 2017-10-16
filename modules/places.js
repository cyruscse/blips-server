const mysqlClient = require('./mysql_client.js');
const hostname = 'localhost';

const cityQuery = "select * from City where ID = ";
const provinceQuery = "select * from Province where ID = ";
const countryQuery = "select * from Country where ID = ";

const mysqlConnection = mysqlClient(hostname, 'root', 'pass', 'blips');
mysqlConnection.connect();

var countryLookup = (countryID, blip, callback) => {
	var queryStr = countryQuery + mysqlConnection.escape(countryID);

	mysqlConnection.query(queryStr, function (error, countryResults, fields) {
		if (error) throw error;

		blip.push(countryResults[0].Name);

		callback(blip[0], blip[1], blip[2]);
	});
}

var provinceLookup = (provinceID, blip, callback) => {
	var queryStr = provinceQuery + mysqlConnection.escape(provinceID);

	mysqlConnection.query(queryStr, function (error, provinceResults, fields) {
		if (error) throw error;

		blip.push(provinceResults[0].Name);

        countryLookup(provinceResults[0].CID, blip, callback);
	});
}

exports.blipLookup = (cityID, callback) => {
	var queryStr = cityQuery + mysqlConnection.escape(cityID);
	var blipToReturn = [];

	mysqlConnection.query(queryStr, function (error, cityResults, fields) {
		if (error) throw error;

		blipToReturn.push(cityResults[0].Name);

        provinceLookup(cityResults[0].PID, blipToReturn, callback);
	});
}
