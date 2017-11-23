const fs = require('fs');
const log_directory = "/tmp";
const logging_debug_file = "/tmp/logging.log";
exports.trace_level = 1;
exports.info_level = 2;
exports.warning_level = 3;
exports.error_level = 4;
exports.critical_level = 5;

function logging(module, module_trace_level) {
	this.module = module;

	// Module trace level ranges from 1 - 5 (with 1 being the least important logging (i.e. info, tracing)
	// and 4 being the most important (i.e. war nings, errors))
	// Having a special level of 5 also logs the entry to stdout.
	// If the call to log is less than the module trace level, it is ignored.
	this.module_trace_level = module_trace_level;
}

logging.prototype.log = (entry_trace_level, entry) => {
	if (entry_trace_level >= this.module_trace_level) {
        fs.appendFileSync(logging_debug_file, new Date().toISOString() + ' - ' + log_directory + "/" + this.module + ".log\n");
        fs.appendFileSync(log_directory + "/" + this.module + '.log', new Date().toISOString() + ' - ' + entry + '\n');
    }

    if (this.module_trace_level == this.critical_level) {
    	fs.appendFileSync(logging_debug_file, new Date().toISOString() + ' - ' + entry + '\n');
    }
}

logging.prototype.setModuleTraceLevel = (level) => {
	this.module_trace_level = level;
}

module.exports = logging;
