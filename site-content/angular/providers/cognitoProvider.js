angular
   .module('app')
   .provider('cognito', ['COGNITO_CONFIG', 'COGNITO_CREDENTIALS', function(COGNITO_CONFIG, COGNITO_CREDENTIALS) {
      
      var logonRoute = "/";

      var cognito = function() {
         return {
            cognito_config: COGNITO_CONFIG,
            cognito_credentials: COGNITO_CREDENTIALS,
            userPool: new AmazonCognitoIdentity.CognitoUserPool(COGNITO_CONFIG),
            cognitoUser: null,
            cognitoSigner: null,
            cognitoUserSession: {},
            logonRoute: "/",

            signAPIRequest: function(params) {
               // console.log(params);

               params.data = params.body;
               params.headers = this.cognitoSigner.sign(params);
               return params;
            },

            isLoggedOn: function() {
               var self = this;

               if (typeof self.cognitoUserSession.isValid == "function") {
                  return self.cognitoUserSession.isValid();
               } else {
                  return false;
               }
            },
            
            restoreSession: function() {
               var self = this;
               
               console.log("restoring session");
               return new Promise((success, failure) => {
                  self.cognitoUser = self.userPool.getCurrentUser();

                  if (self.cognitoUser != null) {
                     self.cognitoUser.getSession(function(err, session) {
                        if (err) {
                           return failure(err);
                        }

                        self.cognitoUserSession = session;

                        return success(true);
                     });
                  } else {
                     return failure('Unable to restore session.');
                  }
               }).catch((e) => {
                  console.log(e);
               });
            },

            authenticateUser: function(username, password) {
               var self = this;
               
               return new Promise((success, failure) => {
                  self.cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                     "Username": username,
                     "Pool": self.userPool
                  });

                  self.cognitoUser.authenticateUser(new AmazonCognitoIdentity.AuthenticationDetails({
                     "Username": username,
                     "Password": password
                  }), {
                     onSuccess: function(result) {
                        return success('Successfully Logged In');
                        /*
                        self.restoreSession().then((data) => {
                           console.log(data);
                           return success();
                        });
                        */
                     },

                     onFailure: function(err) {
                        return failure({
                           code: "AuthenticationFailure",
                           message: "Authentication Failed."
                        });
                     },

                     newPasswordRequired: function(userAttributes, requiredAttributes) {
                        return failure({
                           code: "ResetRequiredException",
                           message: "You must reset your password before logging on the first time."
                        });
                     }
                  });
               });
            },

            completeAdminChallenge: function(newPassword) {
               var self = this;
               
               return new Promise((success, failure) => {
                  self.cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
                     onSuccess: function() {
                        self.retrieveCredentials();

                        return success(true);
                     },

                     onFailure: function(err) {
                        return failure(err);
                     },

                  });
                  
               });
            },

            retrieveCredentials: function() {
               var self = this;

               return new Promise((success, failure) => {

                  if (typeof self.cognitoUserSession.getIdToken != "function") {
                     return failure('Not initialized');
                  }

                  self.cognito_credentials.Logins[Object.keys(self.cognito_credentials.Logins)[0]] = self.cognitoUserSession.getIdToken().getJwtToken();
                  // console.log(self.cognito_credentials);

                  AWS.config.update({
                     region: window.aws_region,
                     credentials: new AWS.CognitoIdentityCredentials(self.cognito_credentials)
                  });

                  AWS.config.credentials.getPromise().then(function(data) {
                     if (AWS.config.credentials.accessKeyId !== "undefined") {
                        try {
                           self.cognitoSigner = new awsSignWeb.AwsSigner({
                              accessKeyId: AWS.config.credentials.accessKeyId, // REQUIRED
                              secretAccessKey: AWS.config.credentials.secretAccessKey, // REQUIRED
                              sessionToken: AWS.config.credentials.sessionToken, //OPTIONAL: If you are using temporary credentials you must include the session token
                              region: AWS.config.region, // REQUIRED: The region where the API is deployed.
                              service: 'execute-api'
                           });
                        } catch (e) {
                           console.log("AWSSigner Error: " + e);
                        }
                     }

                     return success(true);
                  }, function (err) {
                     if (err) {
                        return failure(err);
                     }                     
                  });
               }).catch((err) => {
                  console.log('retrieveCredentials() failed: ' + err);
               });
            },

            changePassword: function(oldpassword, newpassword) {
               var self = this;
               
               return new Promise((success, failure) => {
                  // self.cognitoUser
               });
            },

            forgotPassword: function(username) {
               var self = this;
               
               return new Promise((success, failure) => {
                  self.cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                     "Username": username,
                     "Pool": self.userPool
                  }).forgotPassword({
                     onFailure: function(err) {
                        //return failure(err);
                        return success(err);
                     },

                     inputVerificationCode: function() {
                        return success(true);
                     }
                  });
               });
            },

            resetPassword: function(username, token, newpassword) {
               var self = this;
               
               return new Promise((success, failure) => {
                  self.cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                     "Username": username,
                     "Pool": self.userPool
                  }).confirmPassword(token, newpassword, {
                     onSuccess: function() {
                        return success(true);
                     },

                     onFailure: function(err) {
                        return failure(err);
                     }
                  });
               });
            },

            routeRequireLogin: function() {
               var self = this;

               if (!this.isLoggedOn()) {

                  return new Promise((success, failure) => {
                     self.init();
                     self.onReady.then((result) => {
                        if (result === true) {
                           console.log()
                           return success(undefined);
                        }

                        console.log("routeRequireLogon failed. Result: " + result);
                        return success(self.logonRoute);
                     });
                  });
               }

               return undefined;
            },

            routeBlockLoggedOn: function(routePath) {
               var self = this;

               if (this.isLoggedOn()) {
                  return (routePath);
               }

               return undefined;
            },

            init: function() {
               var self = this;

               this.onReady = new Promise((success, failure) => {

                  self.restoreSession().then((data) => {
                     self.retrieveCredentials().then((data) => {
                        console.log('Init::Logon successful')
                        return success('Logon successful');
                     }).catch((e) => {
                        console.log('Init::Logon Failed.');
                        return failure('Logon Failed.');
                     });

                  }).catch((e) => {
                     console.log('Init::Auth Init Failed.');
                     return failure('Auth Init Failed.');
                  });

               }).catch((e) => {
                  console.log(e);
               });
            }
         };
      };

      this.setLogonRoute = function(routePath) {
         logonRoute = routePath;
      };

      this.$get = [function() {

         var instance = new cognito();
         instance.logonRoute = logonRoute;
         instance.init();

         return instance;
      }];
   }]);
