/**
 * LOGGING
 * Cyrus Sadeghi
 * November 2017
 *
 * Basic universal logging method for all other modules
 */

const fs = require('fs');

// Logging verbosity levels, by default most modules should have this set to warning_level
exports.trace_level = 1;
exports.warning_level = 2;
exports.critical_level = 3;

// Given log entry, log file, and entry verbosity, log the event
// If the verbosity is greather than or equal to the module trace level, log to the module specific file
// If the verbosity is critical, also log to console
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

    if (entry_trace_level == this.critical_level) {
    	console.log(toLog);
    }
}
