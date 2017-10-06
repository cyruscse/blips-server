const mysql = require('mysql');

module.exports = (host, user, password, database) => mysql.createConnection({
    host      : host,
    user      : user,
    password  : password,
    database  : database
});

exports.connect = () => this.connect(function(err) {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        throw err;
    }
});
