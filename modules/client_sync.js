const mySQLClient = require('./mysql_client.js');
const logging = require('./logging.js');

const cityCountQueryStr = "select count(*) from City";
const attractionTypeQueryStr = "select * from AttractionTypes";

// Logging Module setup
const log_file = '/tmp/client_sync.log';
var module_trace_level = logging.warning_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

exports.sync = (response, jsonRequest) => {
	log(logging.critical_level, "received DBSYNC request");

	response.end();
}