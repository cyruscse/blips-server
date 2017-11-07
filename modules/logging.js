const fs = require('fs');
const log_directory = "/tmp";
exports.trace_level = 1;
exports.info_level = 2;
exports.warning_level = 3;
exports.error_level = 4;
exports.critical_level = 5;

var module_trace_level = 1;

var logging = function(module, module_trace_level){
	this.module = module;

	// Module trace level ranges from 1 - 5 (with 1 being the least important logging (i.e. info, tracing)
	// and 4 being the most important (i.e. warnings, errors))
	// Having a special level of 5 also logs the entry to stdout.
	// If the call to log is less than the module trace level, it is ignored.
	this.module_trace_level = module_trace_level;
}

logging.prototype.log = (entry_trace_level, entry) => {
	//if (entry_trace_level >= module_trace_level) {
        console.log(log_directory + "/" + module + ".log");
        fs.appendFileSync(log_directory + "/" + module + '.log', new Date().toISOString() + ' - ' + entry + '\n');
   // }

    if (module_trace_level == this.critical_level) {
    	console.log(new Date().toISOString() + ' - ' + entry + '\n');
    }
}

logging.prototype.setModuleTraceLevel = (level) => {
	module_trace_level = level;
}

module.exports = logging;
