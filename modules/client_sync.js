const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const attractionTypeQueryStr = "select * from AttractionTypes";

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var response;
var attractionTypes;

function reply() {
	var jsonReply = {};

	var attributeData = {
		city_count: 1
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

function attractionTypeCallback(results) {
	attractionTypes = results;
	console.log(results);

	reply();
}

function queryAttractionTypes() {
	mySQLClient.queryAndCallback(attractionTypeQueryStr, attractionTypeCallback);
}

exports.sync = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received DBSYNC request");
	response = httpResponse;

	queryAttractionTypes();
}
