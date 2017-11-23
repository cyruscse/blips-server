const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const cityCountQueryStr = "select count(*) from City";
const attractionTypeQueryStr = "select * from AttractionTypes";

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

var response;
var cityCount;
var attractionTypes;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

function reply() {
	var jsonReply = {};

	var attributeData = {
		city_count: cityCount
	};

	jsonReply["attributes"] = [];
	jsonReply["attributes"].push(attributeData);

	jsonReply["attraction_types"] = [];

	for (type in attractionTypes) {
		jsonReply["attraction_types"].push(attractionTypes[type]);
	}

	jsonReply = JSON.stringify(jsonReply);

	log(logging.trace_level, "Responding with " + jsonReply);
	response.write(jsonReply);

	response.end();
}

function attractionTypeCallback(results, callerCallback, queryArgs) {
	attractionTypes = results;

	reply();
}

function queryAttractionTypes() {
	mySQLClient.queryAndCallback(attractionTypeQueryStr, attractionTypeCallback, null, null);
}

function cityCountCallback(results, callerCallback, queryArgs) {
	var key = (Object.keys(results[0])[0]);
	cityCount = results[0][key];

	log(logging.trace_level, 'DBSYNC request got ' + cityCount);

	queryAttractionTypes();
}

function queryCityCount() {
	mySQLClient.queryAndCallback(cityCountQueryStr, cityCountCallback, null, null);
}

exports.sync = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received DBSYNC request");
	response = httpResponse;

	queryCityCount();
}
