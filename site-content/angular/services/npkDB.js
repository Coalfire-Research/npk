angular
	.module('app')
	.service('npkDB', ['cognito', 'APIGATEWAY_URL', 'USERDATA_BUCKET', function(cognitoSvc, APIGATEWAY_URL, USERDATA_BUCKET) {
		return {
			init: function() {
				this.ddb = new AWS.DynamoDB({
					apiVersion: '2012-10-08'
				});

				this.s3 = new AWS.S3({region: USERDATA_BUCKET.region});
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

				const ddb = new AWS.DynamoDB({
					apiVersion: '2012-10-08'
				});

				return new Promise((success, failure) => {
					// TODO: figure out why this is PUT
					ddb.putItem({
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

				const ddb = new AWS.DynamoDB({
					apiVersion: '2012-10-08'
				});

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



				return ddb.putItem({
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
				const ddb = new AWS.DynamoDB({
					apiVersion: '2012-10-08'
				});

				return new Promise((success, failure) => {
					ddb.query(params, function(err, data) {
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

			selectEvents: function(type, table) {
				var self = this;

				if (['CampaignStarted', 'NodeFinished'].indexOf(type) < 0) {
					return Promise.reject('Invalid type');
				}

				return self.query({
				  	ExpressionAttributeValues: {
					    ':eventType': {S: type}
					 },
					 KeyConditionExpression: 'eventType = :eventType',
					 TableName: "Campaigns",
					 IndexName: "Events"
				}).then((data) => {
					var results = [];

					data.Items.forEach(function(s) {
						var newData = AWS.DynamoDB.Converter.unmarshall(s);
						results.push(newData);
		            });

		            return results;
				});
			},

			listBucketContents: function(bucket, path, region) {

				const s3 = new AWS.S3({ region });

				path = path.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Prefix: path,
					MaxKeys: 100
				};

				return new Promise((success, failure) => {
					s3.listObjects(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			getObject: function(bucket, key, region) {

				const s3 = new AWS.S3({ region });

				key = key.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Key: key
				};

				return new Promise((success, failure) => {
					s3.getObject(params, function(err, data) {
						if (err) {
							return failure(err);
						}

						return success(data);
					});
				});
			},

			headObject: function(bucket, key, region) {

				const s3 = new AWS.S3({ region });

				key = key.replace('self', AWS.config.credentials.identityId);

				var params = {
					Bucket: bucket,
					Key: key
				};

				return new Promise((success, failure) => {
					s3.headObject(params, function(err, data) {
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
				$('a#delete-' + campaign_id).hide();
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
				}).fail(function(xhr) {

					data = xhr.responseText;

					try {
						data = JSON.parse(data);
					} catch (e) {
						data = {msg: "Error parsing response JSON.", success: false};
					}

					if (data.success == false) {
						$scope.modalMessages.error = [data.msg];
					} else {
						$scope.modalMessages.success = [data.msg];
					}

					$scope.$digest();

					$('#messageModal').modal('show');
					$('img#action-' + campaign_id).hide();
				});
			},

			getSignedUrl: function(action, params) {
				return this.s3.getSignedUrl(action, params);
			}
		};
	}]);