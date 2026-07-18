angular
   .module('app')
   .controller('npkMainCtrl', ['$timeout', '$scope', '$routeParams', '$location', '$window', 'cognito', 'npkDB', function($timeout, $scope, $routeParams, $location, $window, cognitoSvc, npkDB) {
      console.log("NPKMCtrl v0.0.1 loaded");

      /*
      $scope.cload_modal = new Custombox.modal({
         content: {
            effect: 'fadein',
            target: '#cload_modal'
         }
      });
      */

      $scope.npkDB = npkDB;

      $scope.updateSidebar = function() {
        $(".sidebar-menu a").removeClass("active").parent().removeClass("active");
        for (var i = window.location, o = $(".sidebar-menu a").filter(function() {
          return this.href == i;
          }).addClass("active").parent().addClass("active"); ;) {
          if (!o.is("li")) break;
          o = o.parent().addClass("in").parent().addClass("active");
        }
      };

      $scope.typeOf = function(what) {
        console.log(what);
        return typeof what;
      };

      $scope.settings = { self: {}, admin: {} };
      $scope.getSettings = function() {

        Promise.all([
          $scope.npkDB.select('admin:setting:', 'Settings'),
          $scope.npkDB.select('self:setting:', 'Settings')
        ]).then((data) => {

          var result = { admin: {}, self: {} };

          Object.keys(data).forEach(function(i) {
            Object.keys(data[i]).forEach(function(e) {
              var key = e.split(":");
              result[key[0]][key[2]] = data[i][e].value;
            });
          });

          $scope.settings = result;

          /*$scope.settings.admin.favoriteHashTypes = $scope.settings.admin.favoriteHashTypes || [];
          $scope.settings.self.favoriteHashTypes = $scope.settings.self.favoriteHashTypes || [];
          $scope.settings.favoriteHashTypes = [].concat($scope.settings.self.favoriteHashTypes).concat($scope.settings.admin.favoriteHashTypes);*/

          // console.log(pricingSvc.hashTypes.$dirty);

          if (!$scope.$$phase) {
            $scope.$digest();
          }

          console.log("Settings loaded.");

        }, (e) => {
          throw Error(e);
        });
      };

      $scope.$location = $location;
      $scope.notifications = [];

      $scope.dateTime = Math.round(Date.now() / 1000);

      $scope.clearUnreadNotifications = function() {
        $scope.settings.notificationsRead = Math.round(Date.now() / 1000);
        $scope.npkDB.putSetting('self:setting:notificationsRead', $scope.settings.notificationsRead);

        $scope.notifications = [];
      }

      $scope.newerThanRead = function () {
        return function(item) {
          return item.datetime > ($scope.settings.self.notificationsRead || 0);
        }
      }

      $.ajax("https://npkproject.io/news.json").done((data) => {
        $scope.notifications = data;
      });

      /*
      window.isLoggedOn = function() {
        return cognitoSvc.isLoggedOn();
      };
      */

      window.$$scope = $scope;

      $scope.handleLogin = function() {
          
          $scope.npkDB.init();

          $scope.user = {}

          switch (localStorage.getItem("authType")) {
            case "Cognito":
              $scope.user = {
                email: $scope.cognitoSvc.cognitoUserSession.idToken.payload.email,
                sub: AWS.config.credentials.identityId
              }

            break;

            case "SAML":
              var idToken = JSON.parse(atob(localStorage.getItem("idToken").split('.')[1]))

              $scope.user = {
                email: idToken.identities[0].userId,
                sub: AWS.config.credentials.identityId
              }

            break;
          }

          $scope.gravatar = md5($scope.user.email);
      };

      // TRACK ROUTE CHANGES

      $scope.$on('$routeChangeSuccess', function() {
        $scope.location = $location.url();
        $scope.checkLocation();
        $('i.why').tooltip();
        $scope.updateSidebar();
      });

      $scope.showNav = false;
      $scope.checkLocation = function() {
        var hiddenNavPagePatterns = [
          /^\/$/,
          /^\/forgot/,
          /^\/pwreset-confirm/,
          /^\/logout/,
        ];

        $scope.showNav = true;
        hiddenNavPagePatterns.forEach(function(e) {
          if (e.test($location.url())) {
            $scope.showNav = false;
            return false;
          }
        });

        return $scope.showNav;
      };
      // END TRACK ROUTE CHANGES



      // DETERMINE IF READY, NOTIFY CHILDREN
      $scope.ready = false;
      $scope.cognitoSvc = cognitoSvc;

      $scope.cognitoSvc.onReady.then((data) => {
        $scope.ready = true;
        $scope.startApp();
      }, (e) => {
        console.log("User is not authenticated - unable to start app.");
      });

      $scope.appStarted = false;
      $scope.startApp = function() {
         if ($scope.appStarted == true) {
            // console.log("Cannot start app: already started.");
         } else {

            $scope.appStarted = true;
            $scope.$broadcast('npkMainCtrlReady');

            if ($scope.cognitoSvc.isLoggedOn()) {
              $scope.handleLogin();
              $scope.getSettings();
            }
         }
      };
      // END READY

      $scope.ok_modal = {

        icon: "fa-star",
        title: "Uninit",
        body: "Uninit",
        accept: "OK",

        e: $('#ok_modal'),

        onAccept: function() {
          return true;
        },

        show: function() {
          this.e.modal('show');

          return this;
        },

        hide: function() {
          this.e.modal('hide');

          return this;
        },

        set: function(icon, title, body, accept, onAccept = null) {
          this.icon = icon;
          this.title = title;
          this.body = body;
          this.accept = accept;

          if (onAccept != null) {
            this.onAccept = onAccept;
          } else {
            this.onAccept = function() {
              return true;
            };
          }

          $scope.$apply();
          return this;
        }
      };

      $scope.retryPromise = (operation, delay, times) => new Promise((resolve, reject) => {
         return operation()
            .then(resolve)
            .catch((reason) => {
            if (times - 1 > 0) {
               return wait(delay)
                  .then($scope.retryPromise.bind(null, operation, delay, times - 1))
                  .then(resolve)
                  .catch(reject);
            }

            return reject(reason);
         });
      });
   }])
   .controller('logonCtrl', ['$scope', '$routeParams', '$location', 'SAMLSSO', 'COGNITO_CONFIG', function($scope, $routeParams, $location, SAMLSSO, COGNITO_CONFIG) {

      $scope.active = false;
      $scope.username;
      $scope.password;
      $scope.newpassword;
      $scope.confirmpassword;
      $scope.verificationcode;

      $scope.useSamlSSO = (SAMLSSO.useSamlSSO == "true");
      if ($scope.useSamlSSO == true) {
        $scope.samlSSOURL = "https://" + SAMLSSO.SAMLDomain + "/oauth2/authorize?identity_provider=" + SAMLSSO.SAMLIdp + "&redirect_uri=" + SAMLSSO.SAMLRedirectUrl + "&response_type=CODE&client_id=" + COGNITO_CONFIG.ClientId + "&scope=email%20openid"        
      }
      

      $scope.onReady = function() {
         // console.log("logonCtrl loaded");
         $scope.$parent.startApp();
         
         code = $location.$$absUrl.match(/\?code=([a-z0-9\-]{36})/)
         if (code != null && code.length == 2) {
          console.log('Got SSO code ' + code[1]);
          //$scope.$parent.ok_modal.set("fa-exclamation-circle", "SAML Code Detected", "Processing SAML SSO Request", "OK", "").show();
          $scope.handleSamlSSO(code[1]).then((data) => {
            location.href = "/";
          })
         }
      };

      $scope.$on('$routeChangeSuccess', function() {
         
         $scope.onReady();

         if ($scope.$parent.$location.url() == "/logout") {
          $scope.signOut();
         }

      });

      $scope.signIn = function() {
        $scope.active = true;
        return $scope.$parent.cognitoSvc.authenticateUser($scope.username, $scope.password).then((data) => {
          // console.log("Successfully logged in: " + JSON.stringify(data));
          $scope.$parent.cognitoSvc.init();
          $scope.$parent.cognitoSvc.onReady.then(() => {
            $scope.$parent.handleLogin();
            $location.path('/dashboard');
            $scope.$apply();
          });
        }).catch((err) => {
          console.log(err);
          $scope.active = false;

          var errHandlerMap = {
            NotAuthorizedException: function() {
              return false;
            },

            ResetRequiredException: function() {
              setTimeout(function() {
                $('#adminCompleteAuth_modal').modal('show');
              });
            },

            UnknownError: function() {
              return false;
            },

            PasswordResetRequiredException: function() {
              $scope.$parent.$location.path('/forgot');
            }
          };

          $scope.$parent.ok_modal.set("fa-exclamation-circle", err.code, err.message, "OK", errHandlerMap[err.code]).show();
        });
      };

      $scope.adminCompleteAuthErrors = [];
      $scope.adminCompleteAuth = function() {

        $scope.adminCompleteAuthErrors = [];

        if ($scope.confirmpassword.length < 12) {
          $scope.newpassword = "";
          $scope.confirmpassword = "";

          $('#adminCompleteAuth_modal').effect('shake');
          $scope.adminCompleteAuthErrors = ["Password must be at least 12 characters."];
          return false;
        }

        if ($scope.newpassword != $scope.confirmpassword) {
          $('#confirmpassword').addClass('error').effect('shake');
          $scope.adminCompleteAuthErrors = ["Passwords must match."];
          return false;
        }

        $("#adminCompleteAuth_submit").prop('disabled', true);

        $scope.$parent.cognitoSvc.completeAdminChallenge($scope.confirmpassword).then((data) => {
          $('#adminCompleteAuth_modal').modal('hide');
          $scope.adminCompleteAuthErrors = [];
          $scope.password = $scope.newpassword;
          $scope.signIn();
        }, (e) => {
          $scope.adminCompleteAuthErrors = [e];
          $scope.$digest();
        });
      };

      $scope.resetPassword = function() {
        $scope.$parent.cognitoSvc.forgotPassword($scope.username).then((data) => {

          $("#reset_modal").modal('show');

        }).catch((e) => {
          $scope.$parent.ok_modal.set('fa-exclamation-triangle',
              'Error Resetting Password',
              e.message,
              "OK")
            .show();
        });
      };

      $scope.showResetModal = function() {
        $("#reset_modal").modal('show');
      }

      $scope.confirmReset = function() {

        if ($scope.confirmpassword.length < 12) {
          $scope.newpassword = "";
          $scope.confirmpassword = "";

          $('#adminCompleteAuth').effect('shake');
          return false;
        }

        if ($scope.newpassword != $scope.confirmpassword) {
          $('#confirmpassword').addClass('error').effect('shake');
          return false;
        }

        $("#adminCompleteAuth_submit").prop('disabled', true);

        $scope.$parent.cognitoSvc.resetPassword($scope.username, $scope.verificationcode, $scope.confirmpassword).then((data) => {
          $("#reset_modal").modal('hide');
          $scope.password = $scope.confirmpassword;
          $scope.signIn();
        }, (e) => {
          $scope.$parent.ok_modal.set(
              'fa-exclamation-triangle',
              'Error Resetting Password',
              "The following error occured while attempting a password reset: " + JSON.stringify(e),
              "OK")
            .show();
          $("#adminCompleteAuth_submit").prop('disabled', false);
        });
      };

      window.cognitoNPK = $scope.$parent.cognitoSvc;

      $scope.handleSamlSSO = function(code) {
        return $scope.$parent.cognitoSvc.authorizeViaSaml(code).then((data) => {
          if (typeof data != "undefined" && data.hasOwnProperty("id_token")) {
            return $scope.$parent.cognitoSvc.retrieveSamlCredentials(data.id_token);
          } else {
            return Promise.reject('SAML SSO response missing idToken');
          }
        });
      }

      $scope.signOut = function() {
        try {
          $scope.cognitoSvc.cognitoUser.signOut();
        } catch (e) {
          console.log("Unable to sign out CognitoUser: " + e);
        }

        localStorage.clear();
        setTimeout(function() {
          location.href = location.origin + location.pathname;
        }, 0);
      };
   }])
  .controller('dashboardCtrl', ['$scope', '$routeParams', '$timeout', 'APIGATEWAY_URL', function($scope, $routeParams, $timeout, APIGATEWAY_URL) {

      window.dashboardCtrl = $scope;

      $scope.modalMessages = {success: [], warning: [], error: []};
      $scope.populateDashboard = function() {
        try {
          typeof $scope.$parent.npkDB;
        } catch (e) {
          return false;
        }

        return $scope.$parent.npkDB.select('self:campaigns:', 'Campaigns').then((data) => {
          $scope.campaigns = JSON.parse(JSON.stringify(data)); //Deepcopy lol
          $scope.campaigns.totals = {hashes: 0, recovered_hashes: 0};

          var promises = [];
          $scope.active_campaigns = 0;
          $scope.inactive_campaigns = 0;
          Object.keys(data)
          .filter(e => !data[e].deleted)
          .forEach(function (e) {
            $scope.campaigns.totals.hashes += $scope.campaigns[e].hashes;
            $scope.active_campaigns += ((data[e].active) ? 1 : 0);
            $scope.inactive_campaigns += ((!data[e].active) ? 1 : 0);

            promises.push($scope.$parent.npkDB.select('self:' + e.split(':')[2] + ':nodes:', 'Campaigns'));
            promises.push($scope.$parent.npkDB.select('self:' + e.split(':')[2] + ':events:', 'Campaigns'));
          });

          return Promise.all(promises);

        }).then((data) => {
          $scope.campaigns.totals.recovered_hashes = 0;
          Object.keys(data).forEach(function(i) {
            Object.keys(data[i]).forEach(function(e) {
              keys = e.split(':');

              var campaign_id = "self:campaigns:".concat(keys[1]);

              if (typeof $scope.campaigns[campaign_id] == "undefined") {
                throw Error("Received orphaned campaign detail");
              }

              if (typeof $scope.campaigns[campaign_id][keys[2]] == "undefined") {
                $scope.campaigns[campaign_id].nodes = {};
                $scope.campaigns[campaign_id].events = {};
              }

              if (typeof $scope.campaigns[campaign_id][keys[2]][keys[3]] == "undefined") {
                $scope.campaigns[campaign_id][keys[2]][keys[3]] = {recovered_hashes: 0};
              }

              switch (keys[2]) {
                case 'nodes':
                  $scope.campaigns[campaign_id].nodes[keys[3]][keys[4].toString()] = data[i][e];

                  if (parseInt(data[i][e].recoveredHashes) > 0 && typeof $scope.campaigns[campaign_id].nodes[keys[3]].firstRecovery == "undefined") {
                    $scope.campaigns[campaign_id].nodes[keys[3]].firstRecovery = keys[4];
                  }

                  if (parseInt(data[i][e].recoveredHashes) > $scope.campaigns[campaign_id].nodes[keys[3]].recovered_hashes) {
                    $scope.campaigns[campaign_id].nodes[keys[3]].recovered_hashes = parseInt(data[i][e].recoveredHashes);
                  }

                  if (data[i][e].status == "COMPLETED" || data[i][e].status == "ERROR") {
                    $scope.campaigns[campaign_id].nodes[keys[3]].finished = keys[4];
                  }
                break;

                case 'events':
                  $scope.campaigns[campaign_id].events[keys[3]][keys[4].toString()] = data[i][e];
                break;
              }
            });
          });

          $scope.campaigns.totals.recovered_hashes = 0;
          Object.keys($scope.campaigns).forEach(function(campaign_id) {
            if (typeof $scope.campaigns[campaign_id].nodes == "undefined") {
              return false;
            }

            $scope.campaigns[campaign_id].recovered_hashes = 0;
            Object.keys($scope.campaigns[campaign_id].nodes).forEach(function(e) {

              var timedKeys = $scope.timedKeys(Object.keys($scope.campaigns[campaign_id].nodes[e]));
              var first = timedKeys.slice(0, 1)[0];
              var last  = timedKeys.slice(-1)[0];

              $scope.campaigns[campaign_id].nodes[e].last = last;
              $scope.campaigns[campaign_id].nodes[e].first = first;
              $scope.campaigns[campaign_id].nodes[e].latest = $scope.campaigns[campaign_id].nodes[e][last];

              if (typeof $scope.campaigns[campaign_id].nodes[e].firstRecovery == "undefined") {
                $scope.campaigns[campaign_id].nodes[e].firstRecovery = last;
              }

              if ($scope.campaigns[campaign_id].recovered_hashes < parseInt($scope.campaigns[campaign_id].nodes[e].recovered_hashes)) {
                $scope.campaigns[campaign_id].recovered_hashes = parseInt($scope.campaigns[campaign_id].nodes[e].recovered_hashes);
              }
            });

            $scope.campaigns.totals.recovered_hashes += $scope.campaigns[campaign_id].recovered_hashes;
          });
          

          $scope.campaigns_loaded = true;
          $scope.$apply();
          return $scope.campaigns;

        }).catch((e) => {
          console.trace();
          throw Error(e);
        });
        // End campaigns
      };

      $scope.now = function() {
        return (new Date().getTime() / 1000).toFixed(0);
      };

      $scope.objLength = function(what) {
        if (typeof what == "undefined") { 
          return 0;
        }

        return Object.keys(what).length;
      };

      $scope.timedKeys = function(list) {
        var newlist = [];
        list.forEach(function(e) {
          if (/^\d+$/.test(e)) {
            newlist.push(e);
          }
        });

        return newlist;
      };

      $scope.timeout = "";
      $scope.tickTock = function() {
        $scope.populateDashboard()
        $timeout(function() {
          $scope.tickTock();
        }, 30000);
      };

      $scope.executeCampaign = function(campaign_id) {

        $('a#start-' + campaign_id).hide();
        $('img#action-' + campaign_id).show();

        $scope.modalMessages.error = [];
        $scope.modalMessages.success = [];

        params = {
          method: 'PUT',
          url: 'https://' + APIGATEWAY_URL + '/v1/userproxy/campaign/' + campaign_id,
          headers: {},
          body: JSON.stringify($scope.order),
        };

        $.ajax($scope.$parent.cognitoSvc.signAPIRequest(params))
        .done((data) => {

          if (typeof data != "object") {
            try {
              data = JSON.parse(data);
            } catch (e) {
              data = {msg: "Error parsing response JSON.", success: false};
            }
          }

          if (data.success == false) {
            $scope.modalMessages.error = [data.msg];
          } else {
            $scope.modalMessages.success = [data.msg];
          }

          $scope.$digest();

          $('#messageModal').modal('show');

          $timeout(function() {
            $scope.populateDashboard()
          }, 2000);
          
          // location.href = location.href.split('#')[0];
        }).fail(function(xhr, a, b) {

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
          $('a#start-' + campaign_id).show();
        });
      };

      $scope.onReady = function() {
         $scope.$parent.startApp();

          window.dashboard = $scope;

          // Populate campaign details
          $scope.campaigns = {};
          $scope.active_campaigns = 0;
          $scope.inactive_campaigns = 0;
          $scope.campaigns_loaded = false;
      };

      $scope.$on('$routeChangeSuccess', function() {
         
         $scope.onReady();
         $scope.tickTock();

      });
   }])
  .controller('campaignCtrl', ['$scope', '$routeParams', '$timeout', 'pricingSvc', 'DICTIONARY_BUCKET', 'USERDATA_BUCKET', 'APIGATEWAY_URL', 'QUOTAS', 'FAMILIES', 'FAMILYREGIONS', function($scope, $routeParams, $timeout, pricingSvc, DICTIONARY_BUCKET, USERDATA_BUCKET, APIGATEWAY_URL, QUOTAS, FAMILIES, FAMILYREGIONS) {

    $scope.pricingSvc = pricingSvc;
    pricingSvc.gpuSpeeds = pricingSvc.gpuWordlistSpeeds;
    // window.campaignCtrl = $scope;

    $scope.hashType = 1000;
    $scope.showAll = false;
    $scope.showAdvanced = false;
    $scope.disabled = true;

    $scope.bestPrice = null;
    $scope.idealInstance = 'none';
    $scope.selectedFamily = false;
    $scope.selectedRegion = false;
    $scope.selectedInstance = false;
    $scope.forceRegion = false;

    $scope.rulesFiles = {Contents: [{Key: 0, Name: 'Select an Instance'}]};
    $scope.wordlistFiles = {Contents: [{Key: 0, Name: 'Select an Instance'}]};
    $scope.hashesFiles = {Contents: [{Key: 0, Name: '< None Available >'}]};

    $scope.selectedRules = [];
    $scope.selectedWordlist = [];
    $scope.selectedHashfile = "";

    $scope.upload_ready = true;
    $scope.uploading_hashes = false;
    $scope.uploadProgress = 0;
    $scope.upload_finished = false;

    $scope.familySortOrder = 'effectiveness';

    $scope.instanceOptions = [];

    $scope.families = FAMILIES;
    $scope.familyRegions = FAMILYREGIONS;

    // $scope.instances = {};

    $scope.toggleAdvancedView = function() {
      $scope.showAdvanced = $('#use_advanced').prop('checked');
    }

    $scope.selectFamily = function(instance) {
      $scope.selectedFamily = instance;

      $scope.selectedRegion = false;
    }

    $scope.selectRegion = function(region) {
      $scope.selectedRegion = region;

      $scope.selectedInstance = false;
    }

    $scope.selectInstance = function(instance) {
      $scope.selectedInstance = instance;

      $scope.updateTotalKeyspace();
      $scope.buildSliders();
    }

    $scope.setFamilySortOrder = function(method) {
      $scope.familySortOrder = method;
    }

    $scope.settingOptions = false

    $scope.getInstanceOptions = async function() {
      if ($scope.settingOptions) {
        return false;
      }

      $scope.settingOptions = true;
      $scope.instanceOptions = [];

      await Promise.all(Object.keys(FAMILIES).map(async (gpu) => {

        pricingSvc.getFamilySpotPriceHistory(gpu).then((data) => {

          if (data[gpu].length > 0) {
            const cheapest = data[gpu].reduce((cheapest, option) => {
              option.instances.forEach(instance => {
                  if (cheapest == 0 || instance.price < cheapest) {
                    cheapest = instance.price;
                  }
              });

              return cheapest;
            }, 0);

            const effectiveness = (!pricingSvc.gpuSpeeds?.[gpu]?.[$scope.hashType] || !cheapest) ?
              0 : pricingSvc.gpuSpeeds[gpu][$scope.hashType] / cheapest;

            $scope.instanceOptions.push({
              gpu,
              cost: data[gpu],
              performance: pricingSvc.gpuSpeeds?.[gpu]?.[$scope.hashType] ?? 0,
              cheapest,
              effectiveness
            });

            $scope.$digest();
            $scope.pricesLoaded = true;

          }
        });
      }));

      $scope.settingOptions = false;
    };

    $scope.pricesLoaded = false;
    $scope.rules_loading = true;
    $scope.wordlist_loading = true;

    $scope.$parent.npkDB.listBucketContents(DICTIONARY_BUCKET.name, "rules/", DICTIONARY_BUCKET.region).then((data) => {
      Object.keys(data.Contents).forEach(function (e) {
        data.Contents[e].Name = data.Contents[e].Key.split('/')[1].split('.').slice(0, -1).join('.');
      });

      $scope.rulesFiles = data;
      $scope.rules_loading = false;
      $scope.$digest();
      $('#rules_select').multiSelect('refresh');
    });

    $scope.$parent.npkDB.listBucketContents(DICTIONARY_BUCKET.name, "wordlist/", DICTIONARY_BUCKET.region).then((data) => {
      Object.keys(data.Contents).forEach(function (e) {
        data.Contents[e].Name = data.Contents[e].Key.split('/')[1].split('.').slice(0, -1).join('.');
      });

      $scope.wordlistFiles = data;
      $scope.wordlist_loading = false;
      $scope.$digest();
      // $('#wordlist_select').multiSelect('refresh');
    });

    $scope.$watch('selectedInstance', function() {
      $scope.buildSliders();
    });

    $scope.isSalted = function() {
      var result = false;
      Object.keys($scope.pricingSvc.hashTypes).forEach(function(e) {
        if ($scope.pricingSvc.hashTypes[e] == $scope.hashType) {
          result = (e.indexOf('$salt') >= 0 || e.indexOf('crypt') >= 0);
          // console.log(e);
        }
      });

      return result;
    };

    $scope.knownMetadata = {};
    $scope.retrievingMetadata = 0;
    $scope.retrieveS3Metadata = function(bucket, key, region) {

      bucket = (bucket == "self") ? USERDATA_BUCKET.name : bucket;
      bucket = (bucket == "dict") ? DICTIONARY_BUCKET.name : bucket;

      if (typeof $scope.knownMetadata[bucket + ":" + key] != "undefined") {
        return new Promise((success, failure) => {
          success($scope.knownMetadata[bucket + ":" + key]);
        });
      }

      $scope.retrievingMetadata++;

      return new Promise((success, failure) => {
        $scope.$parent.npkDB.headObject(bucket, key, region).then((data) => {
          $scope.knownMetadata[bucket + ":" + key] = data.Metadata;

          $scope.retrievingMetadata--;

          return success(data.Metadata);
        });
      });
    }

    $scope.use_wordlist = false;
    $scope.toggleWordlist = function() {
      $('#use_wordlist').prop('checked', !$('#use_wordlist').prop('checked'))
      $scope.use_wordlist = $('#use_wordlist').prop('checked');

      if ($scope.use_wordlist) {
        $scope.wordlistKeyspace = 1;
        $('#wordlistConfig').css('opacity', 1);
        $('#wordlist_select').prop('disabled', false);
        $('#rules_select').multiSelect();
      } else {
        $scope.selectedRules = [];
        $scope.selectedWordlist = [];
        $scope.wordlistKeyspace = 0;
        $('#wordlistConfig').css('opacity', 0.4);
        $('#wordlist_select').prop('disabled', true);
        $('#rules_select').multiSelect('destroy');
      }
    }

    $scope.selectedHashes = [];
    $scope.$watch('selectedHashes', function() {
      if ($scope.selectedHashes.length > 1) {
        $scope.selectedHashes.pop();
      }
    });

    $scope.$watch('selectedWordlist', function() {
      if ($scope.selectedWordlist.length > 1) {
        $scope.selectedWordlist.pop();
      }

      $scope.updateWordlistAttack();
    });

    $scope.$watch('selectedInstance', function() {
      $scope.updateWordlistAttack();
    });

    $scope.$watch('use_wordlist', function() {
      $scope.updateWordlistAttack();
    });

    $scope.$watch('selectedRules', function() {
      $scope.updateWordlistAttack();
    });

    $scope.$watch('hashType', function() {
      $scope.getInstanceOptions();
      $scope.updateWordlistAttack();

      if ($scope.selectedInstance != "none" && !!$scope.selectedInstance) {
        $scope.maskDuration = Math.floor($scope.maskKeyspace / (pricingSvc.gpuSpeeds?.[$scope.selectedFamily.gpu]?.[$scope.hashType] || 1) / FAMILIES[$scope.selectedFamily.gpu].instances[$scope.selectedInstance.instanceType][0])
      }

      $scope.updateTotalKeyspace();
    });

    $scope.wordlistAttackStats = {
      wordlist: {lines: 0, size: 0},
      rules: {lines: 0, size: 0},
      total: {keyspace: 0, size: 0, requiredDuration: 0}
    };

    $scope.updateWordlistAttack = function() {
      var promises = [];
      $scope.selectedWordlist.forEach(function(e) {
        promises.push($scope.retrieveS3Metadata('dict', e.Key, DICTIONARY_BUCKET.region));
      });

      $scope.selectedRules.forEach(function(e) {
        promises.push($scope.retrieveS3Metadata('dict', e.Key, DICTIONARY_BUCKET.region));
      });

      if (!$scope.selectedInstance) {
        $scope.updateTotalKeyspace();
        return Promise.resolve(true);
      }

      return Promise.all(promises).then((data) => {
        $scope.wordlistAttackStats = {
          wordlist: {lines: 0, size: 0},
          rules: {keyspace: 1, lines: 0, size: 0},
          total: {keyspace: 0, size: 0, requiredDuration: 0}
        };

        bucket = DICTIONARY_BUCKET.name;

        $scope.selectedWordlist.forEach(function(e) {
          var metadata = $scope.knownMetadata[bucket + ":" + e.Key];
          $scope.wordlistAttackStats.wordlist.lines += parseInt(metadata.lines);
          $scope.wordlistAttackStats.wordlist.size += parseInt(metadata.size);
        });

        $scope.selectedRules.forEach(function(e) {
          var metadata = $scope.knownMetadata[bucket + ":" + e.Key];
          $scope.wordlistAttackStats.rules.keyspace *= parseInt(metadata.lines);
          $scope.wordlistAttackStats.rules.lines += parseInt(metadata.lines);
          $scope.wordlistAttackStats.rules.size += parseInt(metadata.size);
        });

        $scope.wordlistAttackStats.wordlist.lines = ($scope.wordlistAttackStats.wordlist.lines < 1) ? 1 : $scope.wordlistAttackStats.wordlist.lines;
        $scope.wordlistAttackStats.rules.lines = ($scope.wordlistAttackStats.rules.lines < 1) ? 1 : $scope.wordlistAttackStats.rules.lines;

        $scope.wordlistAttackStats.total.keyspace = $scope.wordlistAttackStats.wordlist.lines * $scope.wordlistAttackStats.rules.keyspace;
        $scope.wordlistAttackStats.total.size = $scope.wordlistAttackStats.wordlist.size + $scope.wordlistAttackStats.rules.size;

        $scope.wordlistAttackStats.total.requiredDuration = Math.floor($scope.wordlistAttackStats.total.keyspace / (pricingSvc.gpuSpeeds?.[$scope.selectedFamily.gpu]?.[$scope.hashType] || 1) / FAMILIES[$scope.selectedFamily.gpu].instances[$scope.selectedInstance.instanceType][0])

        $scope.$digest();
      });
    }

    $scope.$watch('wordlistAttackStats.total.keyspace', function() {
      $scope.updateTotalKeyspace();
    });

    $scope.$watch('maskKeyspace', function() {
      $scope.updateTotalKeyspace();
    });

    $scope.attackType = 0;
    $scope.attackTypeDescription = {
      "-": "None (No attack types enabled)",
      "i": "Invalid (Conflicting options selected)",
      0: "(Use Rules)",
      3: "(Mask Only)",
      6: "(Hybrid; Dictionary + Mask)"
    };

    $scope.totalKeyspace = 0;
    $scope.totalDuration = 0;
    $scope.updateTotalKeyspace = function() {

      if (!!$scope.selectedInstance) {

        $scope.totalKeyspace = (($scope.use_mask) ? $scope.maskKeyspace : 1) * (($scope.use_wordlist) ? $scope.wordlistAttackStats.total.keyspace : 1);
        $scope.totalDuration = $scope.totalKeyspace / (($scope.selectedInstance != "none") ? (FAMILIES[$scope.selectedFamily.gpu].instances[$scope.selectedInstance.instanceType][0] * (pricingSvc.gpuSpeeds[$scope.selectedFamily.gpu][$scope.hashType])) : 1);

        $scope.updateCoverage();
      }
      
      $scope.compileManualCommands();

      if ($scope.useTargetOverride) {
        console.log(1);
        if ($scope.use_mask || $scope.use_wordlist) {
          console.log(2);
          $scope. attackType = "i";
          return true;
        }

        $scope.attackType = 3;
        return true;
      }

      if ($scope.selectedRules.length > 0) {
        $scope.attackType = 0;
        return true;
      }

      if ($scope.use_wordlist) {
        if ($scope.use_mask) {
          $scope.attackType = 6;
        } else {
          $scope.attackType = 0;
        }

        return true;
      }

      if ($scope.use_mask) {
        $scope.attackType = 3;
        return true;
      }

      $scope.attackType = '-';
      return true;
    };

    $scope.totalCoverage = 0;
    $scope.instanceCount = 0;
    $scope.instanceDuration = 0;
    $scope.totalPrice = 0;

    $scope.updateCoverage = function() {
      if ($scope.selectedInstance == "none") {
        return false;
      }

      var countDuration = $scope.totalDuration / $scope.instanceCount;
      $scope.totalCoverage =  (($scope.instanceDuration * 60 * 60) / countDuration) * 100;
      $scope.totalPrice = $scope.selectedInstance.price * $scope.instanceCount * $scope.instanceDuration;
    };

    $scope.use_mask = false;
    $scope.toggleMask = function() {
      $('#use_mask').prop('checked', !$('#use_mask').prop('checked'));
      $scope.use_mask = $('#use_mask').prop('checked');

      if ($scope.use_mask) {
        $scope.mask = "";
        $scope.maskKeyspace = 1;
        $('#maskConfig').css('opacity', 1);
        $('#maskConfig button').each(function(i, e) { $(e).prop('disabled', false)});
      } else {
        $scope.mask = "";
        $scope.maskKeyspace = 0;
        $('#maskConfig').css('opacity', 0.4);
        $('#maskConfig button').each(function(i, e) { $(e).prop('disabled', true)});
      }

      $scope.updateTotalKeyspace();
    };

    $scope.toggleManual = function() {
      $('#use_manual').prop('checked', !$('#use_manual').prop('checked'));
      $scope.use_manual = $('#use_manual').prop('checked');

      if ($scope.use_manual) {
        $scope.manual_arguments = "";
        $('manual_arguments').prop('disabled', false);
        $('useTargetOverride').prop('disabled', false);
        $('#manualConfig').css('opacity', 1);
      } else {
        $scope.manual_arguments = "";
        $('manual_arguments').prop('disabled', true);
        $('useTargetOverride').prop('disabled', true);
        $('#manualConfig').css('opacity', 0.4);
      }

      $scope.updateTotalKeyspace();
    }

    $scope.$watch('useTargetOverride', function() {
      if ($scope.useTargetOverride) {
        $scope.mask = "< Manual Mask Enabled >";
        $('#maskConfig button').each(function(i, e) { $(e).prop('disabled', true)});
      } else {
        $scope.mask = "";
        $('#maskConfig button').each(function(i, e) { $(e).prop('disabled', false)});
      }
    });

    $scope.$watch('useTargetOverride', function() {
      $scope.updateTotalKeyspace();
    });

    $scope.$watch('attackType', function() {
      $scope.compileManualCommands();

      pricingSvc.gpuSpeeds = pricingSvc.gpuWordlistSpeeds;
      if ($scope.attackType == 3) {
        pricingSvc.gpuSpeeds = pricingSvc.gpuMaskSpeeds;
      }

      $scope.getInstanceOptions();
    });

    $scope.$watch('manual_arguments', function() {
      $scope.compileManualCommands();
    });

    $scope.$watch('target_override', function() {
      $scope.compileManualCommands();
    });


    $scope.manual_command = "";
    $scope.keyspace_command = "";
    $scope.compileManualCommands = function() {
      if (!$scope.use_manual) {
        $scope.manual_command = "";
        $scope.keyspace_command = "";
        return false;
      }

      if ($scope.useTargetOverride && ($scope.use_mask || $scope.use_wordlist)) {
        $scope.manual_command = "< Invalid Campaign Configuration >";
        $scope.keyspace_command = false;
        return false;
      }

      var args = [
        "./hashcat/hashcat.bin",
        "--quiet",
        "-O",
        "-w",
        "4",
        "-m",
        $scope.hashType,
        "-a",
        $scope.attackType,
      ];

      if ($scope.attackType == 0) {
        $scope.selectedRules.forEach(function(e) {
          console.log(e);
          args.push("-r");
          args.push(e.Key);
        });
      }

      args.push($scope.manual_arguments);

      args.push("hashes.txt");

      if ([0,6].indexOf($scope.attackType) >= 0) {
        $scope.selectedWordlist.forEach(function(f) {
          args.push(f.Key);
        });
      }

      if ([3,6].indexOf($scope.attackType) >= 0) {
        if ($scope.useTargetOverride) {
          args.push($scope.target_override);
        } else {
          args.push($scope.mask);
        }
      }

      $scope.manual_command = args.join(" ");

      switch($scope.attackType) {
        case '0':
          $scope.keyspace_command = false;
        break;

        case '3':
          if ($scope.useTargetOverride) {
            $scope.keyspace_command = "/root/hashcat/hashcat64.bin --keyspace -a 3 " + $scope.target_override;
          } else {
            $scope.keyspace_command = "/root/hashcat/hashcat64.bin --keyspace -a 3 " + $scope.mask;
          }
        break;

        case '6':
          $scope.keyspace_command = false;
        break;
      }
    }

    $scope.mask = "";
    $scope.maskKeyspace = 1;
    $scope.maskDuration = 0;
    $scope.extendMask = function(value) {

      switch (value) {
        case "?l":
          $scope.maskKeyspace *= 26;
        break;

        case "?u":
          $scope.maskKeyspace *= 26;
        break;

        case "?d":
          $scope.maskKeyspace *= 10;
        break;

        case "?s":
          $scope.maskKeyspace *= 33;
        break;

        case "?a":
          $scope.maskKeyspace *= 95;
        break;

        case "?b":
          $scope.maskKeyspace *= 256;
        break;

        default:
          throw Error("Unsupported mask key: " + value);
          return false;
        break;
      }

      if ($scope.selectedInstance) {
        $scope.maskDuration = Math.floor($scope.maskKeyspace / (pricingSvc.gpuSpeeds?.[$scope.selectedFamily.gpu]?.[$scope.hashType] || 1) / FAMILIES[$scope.selectedFamily.gpu].instances[$scope.selectedInstance.instanceType][0])
      }

      $scope.mask += value;
      return true;
    };

    $scope.reduceMask = function() {
      var oldmask = $scope.mask;
      $scope.mask = "";
      $scope.maskKeyspace = 1;

      var result = true;
      oldmask.split('?').slice(1, -1).forEach(function(e) {
        if (!$scope.extendMask('?' + e)) {
          result = false;
        }
      });

      return result;
    };

    $scope.wordlistKeyspace = 0;

    $scope.view_layout = QUOTAS;

    $scope.quotaFor = function(instanceType) {
      if (typeof instanceType == "undefined") {
        return false;
      }

      if (typeof instanceType == "n") {
        return 0;
      }

      return Object.keys(FAMILIES).reduce((limit, gpu) => {
        if (!FAMILIES[gpu].instances?.[instanceType]) return limit;

        let cpus = FAMILIES[gpu].instances?.[instanceType][1];
        let code = FAMILIES[gpu].quotaCode;
        limit = Object.keys(QUOTAS).reduce((acc, cur) => {
          if (!QUOTAS[cur]?.[code]) return acc;

          acc[cur] = QUOTAS[cur]?.[code]
          return acc;
        }, {});

        return limit;
      });
    }

    $scope.quotas = QUOTAS;

    $scope.uploadHashFile = function() {
      var file = $('#hashfile')[0].files[0];

      if (!file) {
        return false;
      }

      $scope.upload_ready = false;
      $scope.uploading_hashes = true;
      $scope.$digest();

      $('#textuploadbtn').hide();
      var uploader = new AWS.S3.ManagedUpload({
        params: {Bucket: USERDATA_BUCKET.name, Key: AWS.config.credentials.identityId + "/uploads/" + file.name, Body: file.slice(0, file.length), ContentType: "text/plain"}
      })
      .on('httpUploadProgress', function(evt) {
        $scope.uploadProgress = Math.floor(evt.loaded / file.size * 100);
        $scope.$digest();
      })
      .send(function(err, result) {
        if (err) {
          console.log("Upload failed. " + err);
          return false;
        }

        console.log("Success");
        $scope.uploading_hashes = false;
        $scope.upload_finished = true;
        $scope.uploadedFile = file.name;
        $scope.$digest();

        $scope.getHashFiles();
      });
    };

    $scope.uploadHashText = function() {

      var body = $('#hashes_paste').val();
      var filename = "console_upload_" + new Date().toISOString();

      if (body == "") {
        $scope.orderWarnings.push("You probably didn't mean to create an empty hashfile.");
        $('#orderErrorModal').modal('show');
        return false;
      }

      $scope.upload_ready = false;
      $scope.uploading_hashes = true;
      $('#fileuploadbtn').hide();

      var uploader = new AWS.S3.ManagedUpload({
        params: {Bucket: USERDATA_BUCKET.name, Key: AWS.config.credentials.identityId + "/uploads/" + filename, Body: body, ContentType: "text/plain"}
      })
      .on('httpUploadProgress', function(evt) {
        $scope.uploadProgress = Math.floor(evt.loaded / evt.total * 100);
        $scope.$digest();
      })
      .send(function(err, result) {
        if (err) {
          console.log("Upload failed. " + err);
          return false;
        }

        $scope.uploading_hashes = false;
        $scope.upload_finished = true;
        $scope.uploadedFile = filename;
        $scope.$digest();

        $scope.getHashFiles();
      });
    };

    $scope.uploadedFile = null;

    $scope.getHashFiles = function() {
      $scope.$parent.npkDB.listBucketContents(USERDATA_BUCKET.name, "self/uploads/", USERDATA_BUCKET.region).then((data) => {
        Object.keys(data.Contents).forEach(function (e) {
          if (data.Contents[e].Key.indexOf('.') > 0) {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[2].split('.').slice(0, -1).join('.');
          } else {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[2];
          }

          if ($scope.uploadedFile == data.Contents[e].Key.split('/')[2]) {
            $scope.selectedHashes = [data.Contents[e]];
          }
        });

        $scope.hashesFiles = data;
        $scope.hashfiles_loading = false;
        $scope.$digest();
      });
    }

    $scope.order = {};
    $scope.orderErrors = [];
    $scope.orderWarnings = [];
    $scope.verifyOrder = function() {
      $scope.orderErrors = [];
      $scope.orderWarnings = [];

      if (!$scope.selectedInstance) {
        $scope.orderErrors.push("Select an instance.")
      }

      if ($scope.totalCoverage < 100) {
        $scope.orderWarnings.push("Coverage below 100% is a really bad idea. Consider revising your order to ensure a more thorough campaign.");
      }

      if ($scope.selectedHashes.length < 1) {
        console.log($scope.orderErrors.push("Select a target hash list first."));
      }

      if ($scope.selectedHashes.length > 1) {
        $scope.orderErrors.push("Only one target hash list may be chosen.");
      }
      
      if (!$scope.use_wordlist && !$scope.use_mask && !$scope.useTargetOverride) {
        $scope.orderErrors.push("Select an attack type.")
      }

      if ($scope.use_wordlist) {
        if ($scope.selectedWordlist.length < 1) {
          $scope.orderErrors.push("Select a dictionary file.");
        }

        if ($scope.selectedRules.length < 1) {
          $scope.orderWarnings.push("No rule files are selected. Consider adding some.");
        }
      }

      if ($scope.use_manual) {
        $scope.orderWarnings.push("Custom parameters may affect performance, making coverage estimates inaccurate. You must account for this yourself.");
      }

      if ($scope.useTargetOverride) {
        $scope.orderWarnings.push("Coverage estimates cannot be provided for manual masks. You must account for this yourself.");

        if ($scope.use_mask) {
          $scope.orderErrors.push("Manual masks cannot be combined with the mask builder.")
        }

        if ($scope.use_wordlist) {
          $scope.orderErrors.push("Manual masks cannot be combined with wordlist attacks.")
        }
      }

      var hasShellChars = false
      "|$[]{}()<>'\"\\`&".split("").forEach(function(c) {
        if ($scope.manual_arguments.indexOf(c) > -1) {
          hasShellChars = true;
        }
      });

      if (hasShellChars) {
        $scope.orderWarnings.push("Manual arguments are parameterized, and therefore do not support shell control characters. This command might not do what you expect.");
      }

      if ($scope.use_mask) {
        $scope.extendMask('?l');

        if (!$scope.reduceMask()) {
          $scope.orderErrors.push("Invalid Mask.");
        }

        if ($scope.mask == "") {
          $scope.orderWarnings.push("Mask cannot be empty. Set a mask or disable the mask attack.");
        }
      }

      if ($scope.instanceCount < 1 || $scope.instanceCount > $scope.selectedInstance.limit) {
        $scope.orderErrors.push("Invalid instance count.");
      }

      if ($scope.instanceDuration < 1 || $scope.instanceDuration > 24) {
        $scope.orderErrors.push("Invalid instance duration.");
      }

      if ($scope.instanceCount > 1 && $scope.instanceCount > $scope.instanceDuration / 2) {
        $scope.orderWarnings.push("Fewer instances with longer durations are more effective. Consider revising your count and duration.");
      }

      // TODO: Implement max price here.
      /*if ($scope.totalPrice > 100) {
        $scope.orderWarnings.push(`Total price exceeds campaign limit of ${}. Your instances may terminate earlier than you intend.`);
      }*/

      if ($scope.orderErrors.length > 0) {
        $('#orderErrorModal').modal('show');

        return false;
      }

      $scope.order = {
        region: $scope.selectedRegion.region,
        instanceType: $scope.selectedInstance.instanceType,
        hashFile: $scope.selectedHashes[0].Key.split('/').slice(1).join('/'),
        hashFileUrl: "...",
        hashType: $scope.hashType,
        instanceCount: $scope.instanceCount,
        instanceDuration: $scope.instanceDuration,
        priceTarget: $scope.totalPrice
      }

      if ($scope.use_mask) {
        $scope.order.mask = $scope.mask;
      }

      if ($scope.use_wordlist) {
        $scope.order.dictionaryFile = $scope.selectedWordlist[0].Key,
        $scope.order.rulesFiles     = $scope.selectedRules.map(function(e) {
          return e.Key;
        });
      }

      if ($scope.use_manual) {
        $scope.order.manualArguments = $scope.manual_arguments;

        if ($scope.useTargetOverride) {
          $scope.order.manualMask = $scope.target_override;
        }
      }

      $scope.$parent.npkDB.s3.getSignedUrl('getObject', {
        Bucket: USERDATA_BUCKET.name,
        Key: AWS.config.credentials.identityId + '/' + $scope.order.hashFile,
        Expires: 3600
      }, function(err, url) {
        if (err) {
          throw Error(err);
        }
        
        $scope.order.hashFileUrl = url;
        $('#orderModal').modal('show');
      });

    }

    $scope.submittingOrder = true;
    $scope.orderResponse = {success: false};
    $scope.submitOrder = function() {

      $scope.orderErrors = [];
      $scope.orderWarnings = [];
      $scope.submittingOrder = true;

      $('#orderModal').modal('hide');
      $('#orderResponseModal').modal('show');

      params = {
        method: 'POST',
        url: 'https://' + APIGATEWAY_URL + '/v1/userproxy/campaign',
        headers: {},
        body: JSON.stringify($scope.order),
      }

      $.ajax($scope.cognitoSvc.signAPIRequest(params))
      .done((data) => {
        $scope.submittingOrder = false;
        
        $scope.orderResponse = data;
        $scope.campaignId = data.campaignId;
        $scope.$digest();
      
      })
      .fail((data) => {
        $('#orderResponseModal').modal('hide');
        $scope.submittingOrder = false;

        var response = {};

        try {
          response = JSON.parse(data.responseText);
        } catch (e) {
          response = {msg: "Unable to parse response as JSON", success: false};
        }

        $scope.orderErrors = [response.msg];
        $scope.orderWarnings = [];
        $scope.$digest();
        $('#orderErrorModal').modal('show');
      });
    }

    $scope.maxInstances = "0";
    $scope.buildSliders = function() {

      if (!$scope.selectedInstance) return false;

      if ($scope.instanceCount > $scope.selectedInstance.limit) {
        $scope.instanceCount = $scope.selectedInstance.limit;
      }

      if ($scope.selectedInstance.limit > 0) {
        $("#instance_count").data("ionRangeSlider").update({
          min: 0,
          max: $scope.selectedInstance.limit,
          block: false
        });
      } else {
        $("#instance_count").data("ionRangeSlider").update({
          min: 0,
          max: 0,
          block: true
        });
      }  
    };

    $scope.onReady = function() {
      $scope.$parent.startApp();
      // $scope.updateInstances();

      $scope.toggleMask();
      $scope.toggleWordlist();
      $scope.toggleManual();

      $scope.getInstanceOptions();

      $scope.getHashFiles();

      $timeout(function() {
        $('#rules_select').multiSelect();
        $('#rules_select').multiSelect('destroy');
        // $('#wordlist_select').multiSelect();
      });

      $("#instance_count").ionRangeSlider({
        type: "single",
        min: 0,
        max: 1,
        step: 1,
        grid: true,
        grid_num: 1,
        grid_snap: true,
        block: true
      });

      $("#instance_duration").ionRangeSlider({
        type: "single",
        min: 0,
        max: 24,
        step: 1,
        grid: true,
        grid_num: 1,
        grid_snap: true,
        prettify: function(num) {
          return num + " Hours";
        }
      });

      $('[data-toggle="tooltip"]').tooltip();
      
    };

    $scope.$on('$routeChangeSuccess', function() {

      $scope.onReady();
    });
  }])
  .controller('filesCtrl', ['$scope', '$timeout', '$routeParams', '$location', 'USERDATA_BUCKET', function($scope, $timeout, $routeParams, $location, USERDATA_BUCKET) {

    $scope.files = {};
    $scope.basePath = "";
    $scope.pathTree = {};
    $scope.files_loading = true;
    $scope.populateFiles = function() {
      $scope.$parent.npkDB.listBucketContents(USERDATA_BUCKET.name, "self/" + $scope.basePath, USERDATA_BUCKET.region).then((data) => {
        Object.keys(data.Contents).forEach(function (e) {
          $scope.files[data.Contents[e].Key] = data.Contents[e];
        });

        $scope.pathTree = $scope.getPathTree(Object.keys($scope.files));
        $scope.files_loading = false;
        $scope.$digest();
      });
    }

    $scope.large_file_uploading = false;
    $scope.largeFileSubmit = function() {
      $scope.large_file_uploading = true;

      var filename = $('#largeFileInput').val().split('\\').slice(-1)[0];
      var key = AWS.config.credentials.identityId + "/uploads/" + filename
      $scope.watchForFile(key);
    }

    $scope.delay = function(t, v) {
       return new Promise(function(resolve) { 
           setTimeout(resolve.bind(null, v), t)
       });
    }

    $scope.watchForFile = function(key) {
      return new Promise((success, failure) => {
        if (Object.keys($scope.files).indexOf(key) < 0) {
          $scope.populateFiles();

          return $scope.delay(1000).then(() => $scope.watchForFile(key));
        }

        $scope.large_file_uploading = false;
        $scope.$digest();

        return success(true);
      });
    }


    $scope.generatePresignedPost = function() {

      var s3 = new AWS.S3({ region: USERDATA_BUCKET.region });
      var filename = $('#largeFileInput').val().split('\\').slice(-1)[0];
      var key = AWS.config.credentials.identityId + "/uploads/" + filename

      s3.createPresignedPost({
        Bucket: USERDATA_BUCKET.name,
        Fields: {
          key: key
        },
        ContentType: "text/plain"
      }, (err, data) => {
        $('form#largeFile').attr('action', data.url);

        $('div#s3HiddenElems').empty();

        data.fields['key'] = key;
        Object.keys(data.fields).forEach((key) => {
          $('div#s3HiddenElems').append(`<input type="hidden" name="${key}" value="${data.fields[key]}" />`);
        });
        console.log(data);
        $scope.$digest();
      });
    }

    $scope.objLength = function(what) {
      if (typeof what == "undefined") { 
        return 0;
      }

      return Object.keys(what).length;
    };

    $scope.deleteS3Item = function(key) {
      console.log(key);
      $scope.$parent.npkDB.s3.deleteObject({
        Bucket: USERDATA_BUCKET.name,
        Key: key
      }, function(err, data) {
        if (err) {
          console.log(err);
        } else {
          delete $scope.files[key];
          $scope.populateFiles();
          $scope.$digest();
        }
      });
    };

    $scope.getPathTree = function(paths) {
      var pathTree = {};
      paths.forEach(path => {
        var levels = path.split("/");
        var file = levels.pop();

        levels.reduce((prev, lvl, i) => {
          if (levels.length - i - 1) {
            return prev[lvl] = prev[lvl] || {};
          } else {
            var tmp = (prev[lvl] || {});
            tmp[file] = path;
            return prev[lvl] = tmp;
          } 
        }, pathTree);
      });

      return pathTree;
    }

    $scope.typeOf = function(what) {
      return typeof what;
    }

    $scope.signedUrlOf = function(file) {
      return $scope.$parent.npkDB.getSignedUrl('getObject', {
        Bucket: USERDATA_BUCKET.name,
        Key: file,
        ResponseContentType: "text/plain"
      });
    }

    $scope.onReady = function() {
      $scope.$parent.startApp();

      if (!!$routeParams.basePath) {
        $scope.basePath = $routeParams.basePath;
        console.log($scope.basePath);
      }

      $scope.populateFiles();
    };

    $scope.$on('$routeChangeSuccess', function() {
       
       $scope.onReady();
    });
  }])
  .controller('cmCtrl', ['$scope', '$routeParams', '$location', 'USERDATA_BUCKET', 'pricingSvc', 'FAMILIES', function($scope, $routeParams, $location, USERDATA_BUCKET, pricingSvc, FAMILIES) {

    $scope.data = {};
    $scope.campaigns = {};
    $scope.campaigns_loaded = false;

    $scope.first = 0;
    $scope.firstRecovery = 0;
    $scope.last = 0;
    $scope.selected_campaign = null;
    $scope.manifest = {};

    $scope.gpus = Object.keys(FAMILIES).reduce((gpus, family) => {
      const instances = Object.keys(FAMILIES[family].instances).forEach((instance) => {
        let [gpu, vcpu] = FAMILIES[family].instances[instance];

        gpus[instance] = {
          gpu,
          vcpu,
          family
        };
      });

      return gpus;
    }, {});

    // Apply the tooltips after campaigns are loaded.
    $scope.$watch('campaigns_loaded', function() {
      $scope.$$postDigest(function() {
        $('[data-toggle="tooltip"]').tooltip();
      });
    });

    $scope.getTypeFromHash = function(hashId) {
      var type = false;
      Object.keys(pricingSvc.hashTypes).forEach(function(e) {
        if (pricingSvc.hashTypes[e] == hashId) {
          type = e;
        }
      });

      return type;
    };

    $scope.objLength = function(what) {
      if (typeof what == "undefined") { 
        return 0;
      }

      return Object.keys(what).length;
    };

    $scope.populateCampaignDetails = function(campaign) {
      $scope.getManifest(campaign);
      campaigns = { totals: { recovered_hashes: 0 }};
      campaigns["self:campaigns:".concat(campaign)] = { nodes: {}, events: {}, base: {}};

      $scope.$parent.npkDB.select('self:campaigns:' + campaign, 'Campaigns').then((data) => {
        Object.keys(data).forEach(function(e) {
          campaigns[e].base = data[e];

          if (!Array.isArray(campaigns?.[e]?.base?.spotRequestHistory)) {
            return false;
          }

          campaigns[e].base.spotRequestHistory.forEach(function(h) {
            if (h.EventInformation.EventSubType == "launched" || h.EventInformation.EventSubType == "terminated") {
              h.EventInformation.EventDescription = JSON.parse(h.EventInformation.EventDescription);
            }
          })
        });
      });

      var promises = []
      promises.push($scope.$parent.npkDB.select('self:' + campaign + ':nodes:', 'Campaigns'));
      promises.push($scope.$parent.npkDB.select('self:' + campaign + ':events:', 'Campaigns'));

      Promise.all(promises).then((data) => {
          Object.keys(data).forEach(function(i) {
          Object.keys(data[i]).forEach(function(e) {
            keys = e.split(':');

            var campaign_id = "self:campaigns:".concat(keys[1]);

            if (typeof campaigns[campaign_id][keys[2]][keys[3]] == "undefined") {
              campaigns[campaign_id][keys[2]][keys[3]] = {recovered_hashes: 0};
            }

            switch (keys[2]) {
              case 'nodes':
                campaigns[campaign_id].nodes[keys[3]][keys[4].toString()] = data[i][e];

                if (parseInt(data[i][e].recoveredHashes) > 0 && typeof campaigns[campaign_id].nodes[keys[3]].firstRecovery == "undefined") {
                  campaigns[campaign_id].nodes[keys[3]].firstRecovery = keys[4];
                  $scope.firstRecovery = keys[4]; // Super lazy
                }

                if (parseInt(data[i][e].recoveredHashes) > campaigns[campaign_id].nodes[keys[3]].recovered_hashes) {
                  campaigns[campaign_id].nodes[keys[3]].recovered_hashes = parseInt(data[i][e].recoveredHashes);
                }

                if (data[i][e].status == "COMPLETED" || data[i][e].status == "ERROR") {
                  campaigns[campaign_id].nodes[keys[3]].finished = keys[4];
                }
              break;

              case 'events':
                campaigns[campaign_id].events[keys[3]][keys[4].toString()] = data[i][e];
              break;
            }
          });
        });

        campaigns.totals.recovered_hashes = 0;
        Object.keys(campaigns).forEach(function(campaign_id) {
          if (typeof campaigns[campaign_id].nodes == "undefined") {
            return false;
          }

          campaigns[campaign_id].recovered_hashes = 0;
          Object.keys(campaigns[campaign_id].nodes).forEach(function(e) {

            var timedKeys = $scope.timedKeys(Object.keys(campaigns[campaign_id].nodes[e]));
            var first = timedKeys.slice(0, 1)[0];
            var last  = timedKeys.slice(-1)[0];

            $scope.first = first; //this is lazy.
            $scope.last = last; //this is lazy.
            campaigns[campaign_id].nodes[e].last = last;
            campaigns[campaign_id].nodes[e].first = first;
            campaigns[campaign_id].nodes[e].latest = campaigns[campaign_id].nodes[e][last];

            if (typeof campaigns[campaign_id].nodes[e].firstRecovery == "undefined") {
              campaigns[campaign_id].nodes[e].firstRecovery = last;
              $scope.firstRecovery = last;  // Super lazy
            }

            if (campaigns[campaign_id].recovered_hashes < parseInt(campaigns[campaign_id].nodes[e].recovered_hashes)) {
              campaigns[campaign_id].recovered_hashes = parseInt(campaigns[campaign_id].nodes[e].recovered_hashes);
            }
          });

          campaigns.totals.recovered_hashes += campaigns[campaign_id].recovered_hashes;
        });

        $scope.data = campaigns["self:campaigns:".concat(campaign)];
        console.log($scope.data);
        $scope.campaigns_loaded = true;
        $scope.$apply();
        return $scope.campaigns;

      }).catch((e) => {
        console.trace(e);
        throw Error(e);
      });
    }

    $scope.timedKeys = function(list) {
      var newlist = [];
      list.forEach(function(e) {
        if (/^\d+$/.test(e)) {
          newlist.push(e);
        }
      });

      return newlist;
    };

    $scope.getCampaignList = function() {
      $scope.campaigns_loaded = false;
      $scope.$parent.npkDB.select('self:campaigns:', 'Campaigns').then((data) => {
        $scope.campaigns = {};
        
        Object.keys(data).forEach(function(i) {
          $scope.campaigns[i.split(':')[2]] = data[i];
        })

        $scope.campaigns_loaded = true;
        $scope.$digest();
      });
    }

    $scope.getManifest = function(campaign) {
      
      $scope.$parent.npkDB.getObject(USERDATA_BUCKET.name, "self/campaigns/" + campaign + "/manifest.json", USERDATA_BUCKET.region).then((data) => {
        try {
          $scope.manifest = JSON.parse(data.Body.toString('ascii'));
        } catch (e) {
          $scope.manifest = false;          
          console.log('Unable to parse manifest');
          $scope.$digest();
          return false;
        }

        $scope.manifest.hashFileExpires = $scope.manifest.hashFileUrl.split('&')[1].split('=')[1];

        var instance = $scope.manifest.instanceType.split('.');
        $scope.manifest.instanceGeneration = instance[0].toUpperCase();
        $scope.manifest.instanceSize = instance[1];


        $scope.$digest();
        console.log($scope.manifest);

      }, (e) => {
        $scope.manifest = false;
        $scope.$digest();
        console.log('Error retrieving campaign manifest: ' + e)
      });
    }

    $scope.onReady = function() {
      $scope.$parent.startApp();

      $scope.getCampaignList();

      if ($routeParams.campaignId) {
        $scope.selected_campaign = $routeParams.campaignId;
        $scope.populateCampaignDetails($scope.selected_campaign);
      }
    };

    $scope.$on('$routeChangeSuccess', function() {
       
      $scope.onReady();
    });
  }])
  .controller('sCtrl', ['$scope', '$routeParams', '$location', '$timeout', 'npkDB', function($scope, $routeParams, $location, $timeout, npkDB) {

    $scope.availableSettings = {
      admin: {
        // "favoriteHashTypes": "array"
      },
      self: {
        // "favoriteHashTypes": "array",
        "notificationsRead": "number"
      },
    };

    $scope.updateSetting = function(user, setting, value) {
      
      if (!$scope.availableSettings[user].hasOwnProperty(setting)) {
        return Promise.reject("Specified setting is not known");
      }

      switch ($scope.availableSettings[user][setting]) {
        case "array":
          try {
            value = JSON.parse(value)
          } catch (e) {
            return Promise.reject(e);
          }

          if (!Array.isArray(value)) {
            return Promise.reject("Setting requires array value.");
          }
        break;

        case "number":
          if (value / 1 != value) {
            return Promise.reject("Setting requires numeric value");
          }
        break;
      }

      return npkDB.putSetting(user + ':setting:' + setting, value).then((data) => {
        $scope.$parent.settings[user][setting] = value;

        if (setting == "favoriteHashTypes") {
          $scope.$parent.settings.favoriteHashTypes = [].concat($scope.settings.self.favoriteHashTypes).concat($scope.settings.admin.favoriteHashTypes);
        }

        $scope.$digest();
        return Promise.resolve(data);
      }, (e) => {
        console.log(e);
        return Promise.reject(e);
      });
    };

    $scope.waitForSettings = function() {
      if (Object.keys($scope.$parent.settings).length == 0) {
        $timeout(function() {
          $scope.waitForSettings();
        }, 20);
      } else {
        if (!$scope.$$phase) {
          $scope.$digest();
        }

        $timeout(function() {
          $('[data-toggle="tooltip"]').tooltip();
        });
      }
    };

    $scope.$watch('editSetting', function () {
      if ($scope.editType != "" && $scope.editSetting != "") {
        if ($scope.$parent.settings[$scope.editType].hasOwnProperty([$scope.editSetting])) {
          $scope.editModel = JSON.stringify($scope.$parent.settings[$scope.editType][$scope.editSetting]);
        } else {
          $scope.editModel = "";
        }
      } else {
        $scope.editModel = "";
      }
    });

    $scope.$watch('editType', function () {
      if ($scope.editType != "" && $scope.editSetting != "") {
        if ($scope.$parent.settings[$scope.editType].hasOwnProperty([$scope.editSetting])) {
          $scope.editModel = JSON.stringify($scope.$parent.settings[$scope.editType][$scope.editSetting]);
        } else {
          $scope.editSetting = "";
          $scope.editModel = "";
        }
      } else {
        $scope.editModel = "";
      }
    });

    $scope.editMessages = [];
    $scope.editType = "";
    $scope.editSetting = "";
    $scope.editModel = "";
    $scope.openEditSettingModal = function(type, setting) {
      $scope.editType = type;
      $scope.editSetting = setting;

      $('#editUserSettingModal').modal('show');
    }

    $scope.saveEdits = function() {
      return $scope.updateSetting($scope.editType, $scope.editSetting, $scope.editModel).then((data) => {
        $('#editUserSettingModal').modal('hide');
      }, (e) => {
        $scope.editMessages = [e.toString().replace("  ", "").replace("\n", "")];
        $scope.$digest();
      });
    }

    $scope.onReady = function() {
      $scope.$parent.startApp();
      $scope.waitForSettings();
    };

    $scope.$on('$routeChangeSuccess', function() {
      $scope.onReady();
    });
  }])
  .controller('uaCtrl', ['$scope', '$routeParams', '$location', '$timeout', 'userSvc', function($scope, $routeParams, $location, $timeout, userSvc) {

    $scope.users = [];

    $scope.raiseAlert = function(message) {
      console.log(message);
    }

    $scope.createUser = function(element, email, isAdmin) {
      $(element).removeClass('btn-success').addClass('btn-secondary').innerText = "...";
      userSvc.createUser(email, isAdmin).then((data) => {
        $(element).removeClass('btn-secondary').addClass('btn-success').innerText = "Save";
        $('#newUserModal').modal('hide');

        return Promise.resolve();
      }, (e) => {
        $(element).removeClass('btn-secondary').addClass('btn-success').innerText = "Save";
        $scope.modalMessages = [e];

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.getAuthEvents = function(user) {
      userSvc.getUserAuthEvents(user.Username).then((data) => {
        user.authEvents = data.AuthEvents;

        if (!$scope.$$phase) {
          $scope.$digest();
        }        
      });
    };

    $scope.promoteUser = function (element, user) {
      $(element).removeClass('btn-outline-success').addClass('btn-outline-secondary');

      userSvc.makeUserAdmin(user).then((data) => {
        $(element).removeClass('btn-outline-secondary').addClass('btn-outline-success');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.demoteUser = function (element, user) {
      $(element).removeClass('btn-outline-warning').addClass('btn-outline-secondary');

      userSvc.makeUserLimited(user).then((data) => {
        $(element).removeClass('btn-outline-secondary').addClass('btn-outline-warning');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.resetUserPassword = function (element, user) {
      $(element).removeClass('btn-outline-secondary').addClass('btn-secondary');

      userSvc.resetUserPassword(user).then((data) => {
        $(element).removeClass('btn-secondary').addClass('btn-outline-secondary');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.forceResetUserPassword = function (element, user) {
      $(element).removeClass('btn-success').addClass('btn-secondary').innerText = "...";
      userSvc.forceResetUser(user.email).then((data) => {
        $(element).removeClass('btn-secondary').addClass('btn-success').innerText = "Save";
        $('#newUserModal').modal('hide');

        return Promise.resolve();
      }, (e) => {
        $(element).removeClass('btn-secondary').addClass('btn-success').innerText = "Save";
        $scope.modalMessages = [e];

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.deleteUser = function (element, user) {
      $(element).removeClass('btn-outline-primary').addClass('btn-outline-secondary');

      userSvc.deleteUser(user).then((data) => {
        $(element).removeClass('btn-outline-secondary').addClass('btn-outline-primary');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.disableUser = function (element, user) {
      $(element).removeClass('btn-outline-secondary').addClass('btn-secondary');

      userSvc.disableUser(user).then((data) => {
        $(element).removeClass('btn-secondary').addClass('btn-outline-secondary');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.enableUser = function (element, user) {
      $(element).removeClass('btn-outline-primary').addClass('btn-outline-secondary');

      userSvc.enableUser(user).then((data) => {
        $(element).removeClass('btn-outline-secondary').addClass('btn-outline-primary');

        return Promise.resolve();
      }, (e) => {
        $scope.raiseAlert(e);

        return Promise.resolve();
      }).then(() => {
        $scope.loadUsers();
      });
    };

    $scope.loadUsers = function() {
      userSvc.listUsers().then((data) => {
        $scope.users = userSvc.users;

        if (!$scope.$$phase) {
          $scope.$digest();
        }

        $('.arrow').hide();
        $('.tooltip-inner').hide();
        $timeout(function() {
          $('[data-toggle="tooltip"]').tooltip();
        });
      });
    }

    $scope.newUserEmail = "";
    $scope.newUserIsAdmin = false;
    $scope.openNewUserModal = function() {
      $('#newUserModal').modal('show');
    };
    
    $scope.onReady = function() {
      $scope.$parent.startApp();
      $scope.loadUsers();
    };

    $scope.$on('$routeChangeSuccess', function() {
      $scope.onReady();
    });
  }])
  .controller('evCtrl', ['$scope', '$routeParams', '$location', '$timeout', 'userSvc', 'npkDB', function($scope, $routeParams, $location, $timeout, userSvc, npkDB) {

    $scope.events = [];
    $scope.loadEvents = function() {
      Promise.all([
        npkDB.selectEvents('CampaignStarted'),
        npkDB.selectEvents('NodeFinished')
      ]).then((data) => {
        $scope.events = [];

        data.forEach(function(t) {
          t.forEach(function(e) {
            $scope.events.push(e);
          });
        });

        if (!$scope.$$phase) {
          $scope.$digest();
        }

        $('.arrow').hide();
        $('.tooltip-inner').hide();
        $timeout(function() {
          $('[data-toggle="tooltip"]').tooltip();
        });

      }, (e) => {
        console.log(e);
      })
    }

    // this is useless because of https://github.com/aws-amplify/amplify-js/issues/54
    /* $scope.users = [];
    $scope.userMap = {};
    $scope.loadUsers = function() {
      userSvc.listUsers().then((data) => {
        $scope.users = userSvc.users;

        $scope.userMap = {};
        $scope.users.forEach(function(e) {
          $scope.userMap[e.Username] = e.email;
        });

        console.log($scope.users)

        if (!$scope.$$phase) {
          $scope.$digest();
        }
      });
    }*/
    
    $scope.onReady = function() {
      $scope.$parent.startApp();
      // $scope.loadUsers();
      $scope.loadEvents();
    };

    $scope.$on('$routeChangeSuccess', function() {
      $scope.onReady();
    });
  }])
  .controller('dmCtrl', ['$scope', '$timeout', '$routeParams', '$location', 'DICTIONARY_BUCKET', function($scope, $timeout, $routeParams, $location, DICTIONARY_BUCKET) {

    $scope.files = {};
    $scope.basePath = "";
    $scope.pathTree = {};
    $scope.files_loading = true;
    $scope.knownMetadata = {};
    $scope.populateFiles = function() {
      $scope.$parent.npkDB.listBucketContents(DICTIONARY_BUCKET.name, "", DICTIONARY_BUCKET.region).then((data) => {
        $scope.files = {};
        Object.keys(data.Contents).forEach(function (e) {
          $scope.files[data.Contents[e].Key] = data.Contents[e];
          $scope.files[data.Contents[e].Key].metadata = {};
          $scope.retrieveS3Metadata(DICTIONARY_BUCKET.name, data.Contents[e].Key, DICTIONARY_BUCKET.region).then((metadata) => {
            console.log(metadata);
            $scope.files[data.Contents[e].Key].metadata = metadata;
            $scope.$digest();
          });
        });

        $scope.pathTree = $scope.getPathTree(Object.keys($scope.files));

        $scope.files_loading = false;
        $scope.$digest();
      });
    }

    $scope.retrieveS3Metadata = function(bucket, key, region) {

      bucket = (bucket == "self") ? USERDATA_BUCKET.name : bucket;
      bucket = (bucket == "dict") ? DICTIONARY_BUCKET.name : bucket;

      if (typeof $scope.knownMetadata[bucket + ":" + key] != "undefined") {
        return new Promise((success, failure) => {
          success($scope.knownMetadata[bucket + ":" + key]);
        });
      }

      $scope.retrievingMetadata++;

      return new Promise((success, failure) => {
        $scope.$parent.npkDB.headObject(bucket, key, region).then((data) => {
          $scope.knownMetadata[bucket + ":" + key] = data.Metadata;

          $scope.retrievingMetadata--;

          return success(data.Metadata);
        });
      });
    }

    $scope.large_file_uploading = false;
    $scope.largeFileSubmit = function() {
      $scope.large_file_uploading = true;

      var filename = $('#largeFileInput').val().split('\\').slice(-1)[0];
      var key = `to_process/${$scope.type}/${filename}`;
      $scope.watchForFile(key);
    }

    $scope.delay = function(t, v) {
       return new Promise(function(resolve) { 
           setTimeout(resolve.bind(null, v), t)
       });
    }

    $scope.watchToProcess = function() {
      if (!!$scope.pathTree.to_process) {
        $scope.populateFiles();
      }

      $scope.delay(3000).then(() => $scope.watchToProcess());
    }

    $scope.watchToProcess();

    $scope.watchForFile = function(key) {
      return new Promise((success, failure) => {
        if (Object.keys($scope.files).indexOf(key) < 0) {
          $scope.populateFiles();

          return $scope.delay(1000).then(() => $scope.watchForFile(key));
        }

        $scope.large_file_uploading = false;
        $scope.$digest()

        return success(true);
      });
    }

    $scope.generatePresignedPost = function() {

      var s3 = new AWS.S3({ region: DICTIONARY_BUCKET.region });
      var filename = $('#largeFileInput').val()?.split('\\')?.slice(-1)?.[0];

      if (!filename || !$scope.type) {
        return false;
      }

      var key = `to_process/${$scope.type}/${filename}`;

      s3.createPresignedPost({
        Bucket: DICTIONARY_BUCKET.name,
        Fields: {
          key: key
        },
        ContentType: "text/plain"
      }, (err, data) => {
        $('form#largeFile').attr('action', data.url);

        $('div#s3HiddenElems').empty();

        data.fields['key'] = key;
        Object.keys(data.fields).forEach((key) => {
          $('div#s3HiddenElems').append(`<input type="hidden" name="${key}" value="${data.fields[key]}" />`);
        });
        console.log(data);
      });
    }

    $scope.upload_ready = true;
    $scope.uploading_hashes = false;
    $scope.uploadProgress = 0;
    $scope.upload_finished = false;

    $scope.uploadFile = function(type) {
      var reader = new FileReader();
      var file = $(`#${type}file`)[0].files[0];

      if (!file) {
        return false;
      }

      $scope.upload_ready = false;
      $scope.uploading_hashes = true;
      $scope.$digest();

      const btnToHide = (type == "wordlist") ? "#rulesupload" : "#wordlistupload";
      $(btnToHide).hide();

      var uploader = new AWS.S3.ManagedUpload({
        params: {Bucket: DICTIONARY_BUCKET.name, Key: `to_process/${type}/${file.name}`, Body: file.slice(0, file.length), ContentType: file.type}
      })
      .on('httpUploadProgress', function(evt) {
        $scope.uploadProgress = Math.floor(evt.loaded / file.size * 100);
        $scope.$digest();
      })
      .send(function(err, result) {
        if (err) {
          console.log("Upload failed. " + err);
          return false;
        }

        console.log("Success");
        $scope.uploading_hashes = false;
        $scope.upload_finished = true;
        $scope.uploadedFile = file.name;
        $scope.populateFiles();

        $timeout(() => {
          $(btnToHide).show();
          $scope.upload_finished = false;
          $scope.upload_ready = true;
        }, 3000);

      });
    };

    $scope.type = undefined;

    $scope.objLength = function(what) {
      if (typeof what == "undefined") { 
        return 0;
      }

      return Object.keys(what).length;
    };

    $scope.olderThan = function (date, seconds) {
      return (date.getTime() < Date.now() - (seconds * 1000));
    };

    $scope.deleteS3Item = function(key) {
      console.log(key);
      $scope.$parent.npkDB.s3.deleteObject({
        Bucket: DICTIONARY_BUCKET.name,
        Key: key
      }, function(err, data) {
        if (err) {
          console.log(err);
        } else {
          delete $scope.files[key];
          $scope.populateFiles();
          $scope.$digest();
        }
      });
    };

    $scope.getPathTree = function(paths) {
      var pathTree = {};
      paths.forEach(path => {
        var levels = path.split("/");
        var file = levels.pop();

        levels.reduce((prev, lvl, i) => {
          if (levels.length - i - 1) {
            return prev[lvl] = prev[lvl] || {};
          } else {
            var tmp = (prev[lvl] || {});
            tmp[file] = path;
            return prev[lvl] = tmp;
          } 
        }, pathTree);
      });

      return pathTree;
    }

    $scope.typeOf = function(what) {
      return typeof what;
    }

    $scope.signedUrlOf = function(file) {
      return $scope.$parent.npkDB.getSignedUrl('getObject', {
        Bucket: DICTIONARY_BUCKET.name,
        Key: file,
        ResponseContentType: "text/plain"
      });
    }

    $scope.onReady = function() {
      $scope.$parent.startApp();

      if (!!$routeParams.basePath) {
        $scope.basePath = $routeParams.basePath;
        console.log($scope.basePath);
      }

      $scope.populateFiles();
    };

    $scope.$on('$routeChangeSuccess', function() {
       
       $scope.onReady();
    });
  }]).controller('htCtrl', ['$scope', '$timeout', '$routeParams', '$location', 'DICTIONARY_BUCKET', 'QUOTAS', 'FAMILIES', 'FAMILYREGIONS', 'REGIONS', function($scope, $timeout, $routeParams, $location, DICTIONARY_BUCKET, QUOTAS, FAMILIES, FAMILYREGIONS, REGIONS) {

    $scope.loading = false;
    $scope.quotas = QUOTAS;
    $scope.families = FAMILIES;
    $scope.familyregions = FAMILYREGIONS;
    $scope.all_regions = REGIONS;

    $scope.onReady = function() {
      $scope.$parent.startApp();

      if (!!$routeParams.basePath) {
        $scope.basePath = $routeParams.basePath;
        console.log($scope.basePath);
      }
    };

    $scope.$on('$routeChangeSuccess', function() {
       
       $scope.onReady();
    });
  }])
  ;