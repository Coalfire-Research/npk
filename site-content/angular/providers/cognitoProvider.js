angular
   .module('app')
   .provider('cognito', ['COGNITO_CONFIG', 'COGNITO_CREDENTIALS', 'SAMLSSO', function(COGNITO_CONFIG, COGNITO_CREDENTIALS, SAMLSSO) {
      
      var logonRoute = "/";
      var userRoute = "/dashboard";

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

            isAdmin: function() {
               if (localStorage.getItem("authType") == null || !this.cognitoUserSession.hasOwnProperty('idToken')) {
                  console.log('Init::Auth not initialized');
                  return false;
               }

               // If the identity type is SAML, the 'payload' object is merged into the parent 'idToken'.
               if (!this.cognitoUserSession.idToken.hasOwnProperty('payload')) {
                  return this.cognitoUserSession.idToken['cognito:groups']?.indexOf('npk-admins') > -1;
               }

               return this.cognitoUserSession.idToken.payload['cognito:groups']?.indexOf('npk-admins') > -1;
            },

            isLoggedOn: function() {
               var self = this;

               if (localStorage.getItem("authType") == null) {
                  console.log('Init::Auth not initialized');
                  return false;
               }

               if (localStorage.getItem("authType") == "Cognito") {
                  if (typeof self.cognitoUserSession.isValid == "function") {
                     return self.cognitoUserSession.isValid();
                  } else {
                     return false;
                  }
               }

               if (localStorage.getItem("authType") == "SAML") {
                  return (Date.now() < localStorage.getItem("expiry"));
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
                        localStorage.setItem("authType", "Cognito");
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
               });
            },

            retrieveSamlCredentials: function() {
               var self = this;

               return new Promise((success, failure) => {

                  if (localStorage.getItem("idToken") == null) {
                     return failure('SAML not initialized');
                  }

                  var idToken = localStorage.getItem("idToken");
                  self.cognitoUserSession.idToken = JSON.parse(atob(idToken.split('.')[1]));

                  self.cognito_credentials.Logins[Object.keys(self.cognito_credentials.Logins)[0]] = idToken;
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
                  console.log('retrieveSamlCredentials() failed: ' + err);
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
                        return failure(err);
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
                        console.log(err);
                        if (err == {}) {
                           return success(true);
                        }

                        return failure(err);
                     }
                  });
               });
            },

            routeRequireAdmin: function() {
               var self = this;

               if (!this.isLoggedOn()) {

                  return new Promise((success, failure) => {
                     self.init();
                     self.onReady.then((result) => {
                        if (result === true) {
                           if (this.isAdmin()) {
                              return success(undefined);
                           }

                           console.log("routeRequireAdmin failed authorization check.");
                           return success(self.userRoute);
                        }

                        console.log("routeRequireAdmin failed login. Result: " + result);
                        return success(self.logonRoute);
                     }, (e) => {
                        console.log("onReady failed.");
                        return success(self.logonRoute);
                     });
                  });
               }

               return undefined;
            },

            routeRequireLogin: function() {
               var self = this;

               if (!this.isLoggedOn()) {

                  return new Promise((success, failure) => {
                     self.init();
                     self.onReady.then((result) => {
                        if (result === true) {
                           console.log("Successfully initialized existing credential");
                           return success(undefined);
                        }

                        console.log("routeRequireLogon failed. Result: " + result);
                        return success(self.logonRoute);
                     }, (e) => {
                        console.log("onReady failed.");
                        return success(self.logonRoute);
                     });
                  });
               }

               return undefined;
            },

            routeBlockLoggedOn: function(routePath) {
               var self = this;

               if (this.isLoggedOn()) {
                  console.log("User is logged on. Redirecting to " + routePath);
                  return (routePath);
               }

               return undefined;
            },

            init: function() {
               var self = this;

               this.onReady = new Promise((success, failure) => {

                  if (localStorage.getItem("authType") == null) {
                     console.log('Init::Auth not initialized');
                     return failure('Auth not initialized');
                  }

                  if (localStorage.getItem("authType") == "Cognito") {
                     self.restoreSession().then((data) => {
                        return self.retrieveCredentials();
                     }, (e) => {
                        console.log('Init::Auth Init Failed.');
                        return failure('Auth Init Failed.');
                     }).then((data) => {
                        console.log('Init::Logon successful')
                        return success('Logon successful');
                     }, (e) => {
                        console.log('Init::Logon Failed.');
                        return failure('Logon Failed.');
                     });
                  }

                  if (localStorage.getItem("authType") == "SAML") {
                     if (Date.now() > localStorage.getItem("expiry")) {
                        self.refreshSamlTokens().then((data) => {
                           console.log('Init::SamlAuth Logon Successful.');
                           return success('SamlAuth Logon Successful');
                        }, (e) => {
                           console.log('Init::SamlAuth Init Failed.');
                           return failure('SamlAuth Init Failed.');
                        });
                     } else {
                        self.retrieveSamlCredentials().then((data) => {
                           console.log('Init::SamlAuth Resumed Successfully');
                           return success('SamlAuth Resumed Successfully');
                        }, (e) => {
                           console.log('Unable to resume SamlAuth: ' + e);
                           return failure('Unable to resume SamlAuth: ' + e);
                        });
                     }
                  }

               });
            },

            authorizeViaSaml: function(code) {
               var self = this;

               return new Promise((success, failure) => {
                  $.ajax('https://' + SAMLSSO.SAMLDomain + '/oauth2/token', {
                     data: {
                        grant_type: "authorization_code",
                        client_id: COGNITO_CONFIG.ClientId,
                        code: code,
                        redirect_uri: SAMLSSO.SAMLRedirectUrl // Should have protocol; e.g. HTTPS
                     },
                     method: "POST",
                     success: function (data) {
                        console.log(data);
                        localStorage.setItem("authType", "SAML");
                        localStorage.setItem("expiry", (new Date(Date.now() + (data.expires_in * 1000))).getTime());
                        localStorage.setItem("refreshToken", data.refresh_token);
                        localStorage.setItem("idToken", data.id_token);
                        console.log(localStorage);
                        success(data);
                     },
                     error: function (xhr, error, obj) {
                        failure(error);
                     }
                  })
               }).catch((e) => {
                  console.log(e);
               })
            },

            refreshSamlTokens: function() {
               var self = this;

               return new Promise((success, failure) => {
                  $.ajax('https://' + SAMLSSO.SAMLDomain + '/oauth2/token', {
                     data: {
                        grant_type: "refresh_token",
                        client_id: COGNITO_CONFIG.ClientId,
                        refresh_token: localStorage.getItem("refreshToken"),
                        redirect_uri: SAMLSSO.SAMLRedirectUrl
                     },
                     method: "POST",
                     success: function (data) {
                        localStorage.setItem("authType", "SAML");
                        localStorage.setItem("expiry", new Date(Date.now() + (data.expires_in * 1000)).getTime());
                        localStorage.setItem("refreshToken", data.refresh_token);
                        localStorage.setItem("idToken", data.id_token);
                        success(data);
                     },
                     error: function (xhr, error, obj) {
                        failure(error);
                     }
                  })
               }).catch((e) => {
                  console.log(e);
               })
            }
         };
      };

      this.setLogonRoute = function(routePath) {
         logonRoute = routePath;
      };

      this.setUserRoute = function(routePath) {
         logonRoute = routePath;
      };

      this.$get = [function() {

         var instance = new cognito();
         instance.logonRoute = logonRoute;
         instance.init();

         return instance;
      }];
   }]);
