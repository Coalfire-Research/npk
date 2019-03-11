"use strict";

/* EXAMPLE EXECUTION (change 'npk' to your actual AWSCLI profile):
export AWS_ACCESS_KEY_ID=`aws configure get npkdirect.aws_access_key_id`;
export AWS_SECRET_ACCESS_KEY=`aws configure get npkdirect.aws_secret_access_key`;
node ./tester.js
*/

// Spot Monitor

var handler = require("./spot_monitor/main");

var sim = {event: {}, context: {}};

handler.main(sim.event, sim.context, function(err, data) {
	if (err) {
		throw Error(err);
	} else {
		console.log(data);
	}

	process.exit(0);
});