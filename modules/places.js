const mysqlClient = require('./mysql_client.js');
const hostname = 'localhost';

// SQL query constant strings
const cityQuery = "select * from City where ID = ";
const provinceQuery = "select * from Province where ID = ";
const countryQuery = "select * from Country where ID = ";

const mysqlConnection = mysqlClient(hostname, 'root', 'pass', 'blips');
mysqlConnection.connect();

// Given a Country ID, query the SQL databse to get the Country row
// If the row exists, call the callback function with the contents of the Blip array
// (which contains the cityName, provinceName, and countryName)
var countryLookup = (countryID, blip, callback) => {
	var queryStr = countryQuery + mysqlConnection.escape(countryID);

	mysqlConnection.query(queryStr, function (error, countryResults, fields) {
		if (error) throw error;

		blip.push(countryResults[0].Name);

		callback(blip[0], blip[1], blip[2]);
	});
}

// Given a Province ID, query the SQL database to find the Country ID
// If a row exists, add the provinceName to the blip array, call countryLookup to get the corresponding 
// row from the Country table
var provinceLookup = (provinceID, blip, callback) => {
	var queryStr = provinceQuery + mysqlConnection.escape(provinceID);

	mysqlConnection.query(queryStr, function (error, provinceResults, fields) {
		if (error) throw error;

		blip.push(provinceResults[0].Name);

        countryLookup(provinceResults[0].CID, blip, callback);
	});
}

// Given a BlipID (cityID), query the SQL database to find the Province ID (PID)
// If a row exists, add the cityName to the blip array, and call provinceLookup to find the CID
exports.blipLookup = (cityID, callback) => {
	var queryStr = cityQuery + mysqlConnection.escape(cityID);
	var blipToReturn = [];

	mysqlConnection.query(queryStr, function (error, cityResults, fields) {
		if (error) throw error;

		blipToReturn.push(cityResults[0].Name);

        provinceLookup(cityResults[0].PID, blipToReturn, callback);
	});
}
