# blips-server
# Originally written by Cyrus Sadeghi
Fourth Year Project - Blips server component

## NOTE regarding status after 2017-2018 academic year
All AWS services (ELB, RDS, etc.) have been shutdown now that our project is complete.
We made the mistake of keeping Google API keys in the code (very bad idea), and have revoked
these keys remotely.

If you want to redeploy this server application, you need to provision Amazon ELB (Elastic Beanstalk) and RDS (Relational Database Service),
acquire Google API keys for the server and client and update those values in the code.

## End note

blips-ios-client located at https://github.com/cyruscse/blips-iOS-client
blips-android-client located at https://github.com/cyruscse/blips-android-client
~~blips server AWS logging forwards to blipsserverlogs@gmail.com~~ (AWS services have been shut down)


## These descriptions are out of date, they were written in an earlier stage of the project
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

Important Commands
- ~~curl --request POST --data-binary "@postexamples/ottlodging.json" http://blipsserver-env.us-east-2.elasticbeanstalk.com/ (curl POST a file to server)~~ (URL is dead after AWS shutdown)
- zip -ur build/blips.zip . (package ELB deployment)
