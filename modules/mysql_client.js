const mysql = require('mysql');
const hostname = 'localhost';

var mySQLConnection = mysql.createConnection({
    host      : hostname,
    user      : 'root',
    password  : 'pass',
    database  : 'blips'
});

mySQLConnection.connect();

exports.queryAndCallback = (queryStr, queryCallback, callerCallback, queryArgs) => {
	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		queryCallback(results, callerCallback, queryArgs);
	});
}

exports.escape = (string) => {
	return mySQLConnection.escape(string);
}
