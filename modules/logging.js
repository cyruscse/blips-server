const fs = require('fs');

exports.trace_level = 1;
exports.warning_level = 2;
exports.critical_level = 3;

exports.log = (entry_trace_level, module_trace_level, log_file, entry) => {
	var toLog = new Date().toISOString() + ' - ' + entry + '\n';

	if (entry_trace_level >= module_trace_level) {       
        try {
        	fs.appendFileSync(log_file, toLog);
        } catch (err) {
        	// Failed to access log file, fallback to console logging
        	console.log(toLog);
        }
    }

    if (this.module_trace_level == this.critical_level) {
    	console.log(toLog);
    }
}
