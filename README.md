# blips-server
Fourth Year Project - Blips server component

blips-ios-client located at https://github.com/cyruscse/blips-iOS-client
blips-android-client located at https://github.com/cyruscse/blips-android-client
blips server AWS logging forwards to blipsserverlogs@gmail.com (need to add password here)

Directory Structure & Contents

Root
./dbsetup - MySQL DB Schema and Python DB Table Generator scripts, both are needed for initial DB setup
   - table_definitions.sql - Contains MySQL DB Schema
   - build_cities_database.py - Inserts values for City, Province, and Country into DB

./modules - Node.JS Modules, server code - interfaces with MySQL database and calls into Google API
   - google_client.js - Interface to Google Maps and Places API, geocodes Blips from DB and retrieves attractions near a Blip
   - mysql_client.js - Interface to MySQL database, performs direct insertions, retrievals, counting, etc. on the Blips DB
   - places.js - Handles JSON POSTed by Blips clients, asks mysql_client to query the DB for city, province, and country
   - main.js - Receives JSON POSTed by Blips clients, interconnects all other modules to return responses to Blips clients
 
./ReportContent - All relevant documents needed for report delivarbles