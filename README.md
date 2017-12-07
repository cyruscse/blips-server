# blips-server
Fourth Year Project - Blips server component

blips-ios-client located at https://github.com/cyruscse/blips-iOS-client
blips-android-client located at https://github.com/cyruscse/blips-android-client
blips server AWS logging forwards to blipsserverlogs@gmail.com (need to add password here)

Directory Structure & Contents

Root
./dbsetup - MySQL DB Schema and Python DB Table Generator scripts, these are used on server startup by mysql_client
   - table_definitions.sql - Contains MySQL DB Schema
   - force_rebuild (OPTIONAL) - If this file exists in dbsetup, the server will force rebuild the database (this file doesn't exist normally, must be added manually)

./modules - Node.JS Modules, server code - interfaces with MySQL database and calls into Google API
   - client_sync.js - On a client DB sync request, reply with information that a client needs from the server to create queries
   - google_client.js - Provides static functions for all other modules to call into Google API (also sets up attraction type table in DB)
   - logging.js - Utility functions to redirect logs from each module to separate files
   - mysql_client.js - Interface to MySQL database, performs direct insertions, retrievals, counting, etc. on the Blips DB
   - query_request.js - Handles client query request, gets blips close to client location, filtered by attraction type

./package.json - Metadata for AWS deployment, sets Node dependencies and defines initial call into Node
./main.js - Receives JSON POSTed by Blips clients, interconnects all other modules to return responses to Blips clients 
./ReportContent - All relevant documents needed for report deliverables

AWS Deployment Instructions

- Install awsebcli (pip install awsebcli)

- Change to project directory

- Edit .elasticbeanstalk/config.yml to contain
deploy:
  artifact: build/blips.zip

- eb init (blips-server is located in 13 - Ohio)

- zip -r build/blips.zip * (from project root)

- eb deploy

AWS Useful Tools

- With awsebcli installed:

- eb ssh (SSH to AWS server running blips-server, can manually view logs, change server environment)
- eb logs (self-explanatory, this should also return logs created by logging.js, need to confirm)
- eb status
