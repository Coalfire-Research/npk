angular
	.module('app')
	.service('npkDB', ['cognito', 'APIGATEWAY_URL', function(cognitoSvc, APIGATEWAY_URL) {
		return {
			ddb: {},
			s3: {},
			s3w1: {},
			s3w2: {},
			s3e1: {},
			s3e2: {},

			init: function() {
				this.ddb = new AWS.DynamoDB({
					apiVersion: '2012-10-08'
				});

				this.s3 = new AWS.S3();
				this.s3w1 = new AWS.S3({region: 'us-west-1'});
				this.s3w2 = new AWS.S3({region: 'us-west-2'});
				this.s3e1 = new AWS.S3({region: 'us-east-1'});
				this.s3e2 = new AWS.S3({region: 'us-east-2'});

			},

			create: function(table,record) {
				var self = this;

				return new Promise((success, failure) => {
					self.ddb.putItem({
						TableName: table,
						Item: record
					}, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			get: function(table, key) {
				var self = this;

				return new Promise((success, failure) => {
					// TODO: figure out why this is PUT
					self.ddb.putItem({
						TableName: table,
						Item: record
					}, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			putSetting: function(compound_key, value) {
				var self = this;

				var keys = compound_key.split(":");
				switch (keys[0]) {
					case 'admin':
						var owner = 'admin';
					break;

					case 'self':
						var owner = AWS.config.credentials.identityId;
					break;

					default:
						console.log('Allowed key prefixes are "self" and "admin"');
					break;
				}



				return self.ddb.putItem({
					TableName: 'Settings',
					Item: AWS.DynamoDB.Converter.marshall({
						userid: owner,
						keyid: keys.slice(1).join(":"),
						value: value
					})
				}).promise();
			},

			delete: function(table, key) {

			},

			query: function(params) {
				var self = this;

				return new Promise((success, failure) => {
					self.ddb.query(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			select: function(compound_key, table) {
				var self = this;

				keys = compound_key.split(":");
				switch (keys[0]) {
					case 'admin':
						owner = 'admin';
					break;

					case 'self':
						owner = AWS.config.credentials.identityId;
					break;

					default:
						console.log('Allowed key prefixes are "self" and "admin"');
					break;
				}

				keys.shift();
				keys = keys.join(':');

				var params = {
				  ExpressionAttributeValues: {
				    ':id': {S: owner},
				    ':keyid': {S: keys}
				   },
				 KeyConditionExpression: 'userid = :id and begins_with(keyid, :keyid)',
				 ReturnConsumedCapacity: "INDEXES",
				 TableName: table
				};

				return self.query(params).then((data) => {
					var result = {};

					data.Items.forEach(function(s) {
		              var newData = AWS.DynamoDB.Converter.unmarshall(s);
		              var key = ((newData.userid == 'admin') ? 'admin' : 'self').concat(':', newData.keyid);

		              delete newData.userid;

		              result[key] = newData;
		            });

		            return result;
				});


			},

			s3ForRegion: function(region) {
				switch(region) {
					case null:
						return 's3'
					break;

					case 'us-west-1':
						return 's3w1'
					break;

					case 'us-west-2':
						return 's3w2'
					break;

					case 'us-east-1':
						return 's3e1'
					break;

					case 'us-east-2':
						return 's3e2'
					break;

					default:
						return 's3';
					break;
				}
			},

			listBucketContents: function(bucket, path, region) {

				var self = this;

				path = path.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Prefix: path,
					MaxKeys: 100
				};

				return new Promise((success, failure) => {
					self[self.s3ForRegion(region)].listObjects(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			getObject: function(bucket, key, region) {

				var self = this;

				key = key.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Key: key
				};

				return new Promise((success, failure) => {
					self[self.s3ForRegion(region)].getObject(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			headObject: function(bucket, key, region) {

				var self = this;

				key = key.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Key: key
				};

				return new Promise((success, failure) => {
					self[self.s3ForRegion(region)].headObject(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			getCampaigns: function() {
				var baseCampaigns = {
				  ExpressionAttributeValues: {
				    ':id': {S: AWS.config.credentials.identityId},
				    ':keyid': {S: 'campaigns:'}
				   },
				 KeyConditionExpression: 'userid = :id and begins_with(keyid, :keyid)',
				 TableName: 'Campaigns'
				};
			},

			cancelCampaign: function(campaign_id) {

				$('a#cancel-' + campaign_id).hide();
				$('img#action-' + campaign_id).show();

				params = {
					method: 'DELETE',
					url: 'https://' + APIGATEWAY_URL + '/v1/userproxy/campaign/' + campaign_id,
					headers: {},
					body: ""
				};

				$.ajax(cognitoSvc.signAPIRequest(params)).done((data) => {

					if (typeof data != "object") {
						try {
							data = JSON.parse(data);
						} catch (e) {
							data = {msg: "Error parsing response JSON.", success: false};
						}
					}

					location.href = location.href.split('#')[0];
				});
			},

			clearUnreadNotifications: function () {

			},

			getSignedUrl: function(action, params) {
				return this.s3.getSignedUrl(action, params);
			}
		};
	}]);