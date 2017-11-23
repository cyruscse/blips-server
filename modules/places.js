const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

// SQL query constant strings
const cityQuery = "select * from City where ID = ";
const provinceQuery = "select * from Province where ID = ";
const countryQuery = "select * from Country where ID = ";

// Logging Module setup
const log_file = '/tmp/places.log';
var module_trace_level = logging.warning_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var countryLookupCallback = (results, callback, args) => {
	args[0].push(results[0].Name);

	log(logging.trace_level, "place lookup complete " + args[0][0] + " " + args[0][1] + " " + args[0][2]);

	callback(args[0][0], args[0][1], args[0][2]);
}

// Given a Country ID, query the SQL databse to get the Country row
// If the row exists, call the callback function with the contents of the Blip array
// (which contains the cityName, provinceName, and countryName)
var countryLookup = (countryID, callbackArgs, callback) => {
	var queryStr = countryQuery + mySQLClient.escape(countryID);

	mySQLClient.queryAndCallback(queryStr, countryLookupCallback, callback, callbackArgs)
}

var provinceLookupCallback = (results, callback, args) => {
	args[0].push(results[0].Name);

	countryLookup(results[0].CID, args, callback);
}

// Given a Province ID, query the SQL database to find the Country ID
// If a row exists, add the provinceName to the blip array, call countryLookup to get the corresponding 
// row from the Country table
var provinceLookup = (provinceID, callbackArgs, callback) => {
	var queryStr = provinceQuery + mySQLClient.escape(provinceID);

	mySQLClient.queryAndCallback(queryStr, provinceLookupCallback, callback, callbackArgs)
}

var cityLookupCallback = (results, callback, args) => {
	args[0].push(results[0].Name);

	provinceLookup(results[0].PID, args, callback);
}

// Given a BlipID (cityID), query the SQL database to find the Province ID (PID)
// If a row exists, add the cityName to the blip array, and call provinceLookup to find the CID
exports.blipLookup = (cityID, callback) => {
	var queryStr = cityQuery + mySQLClient.escape(cityID);
	var blipToReturn = [];
	var callbackArgs = new Array();
	callbackArgs.push(blipToReturn);

	mySQLClient.queryAndCallback(queryStr, cityLookupCallback, callback, callbackArgs);
}
