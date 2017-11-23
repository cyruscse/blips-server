const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const cityCountQueryStr = "select count(*) from City";
const attractionTypeQueryStr = "select * from AttractionTypes";

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.trace_level;

var response;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

function cityCountCallback(results, callerCallback, queryArgs) {
	var key = (Object.keys(results[0])[0]);

	log(logging.trace_level, 'DBSYNC request got ' + results[0][key]);

	response.end();
}

exports.sync = (httpResponse, jsonRequest) => {
	log(logging.trace_level, "received DBSYNC request");
	response = httpResponse;

	mySQLClient.queryAndCallback(cityCountQueryStr, cityCountCallback, null, null);
}
