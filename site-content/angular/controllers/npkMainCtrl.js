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

      $scope.getSettings = function() {
        $scope.settings = Promise.all([
          $scope.npkDB.select('admin:setting:', 'Settings'),
          $scope.npkDB.select('self:setting:', 'Settings')
        ]).then((data) => {

          var result = {};

          Object.keys(data).forEach(function(i) {
            Object.keys(data[i]).forEach(function(e) {
              result[e] = data[i][e].value;
            });
          });

          return result;
        }).catch((e) => {
          throw Error(e);
        });
      };

      $scope.$location = $location;
      $scope.notifications = [];

      /*
      window.isLoggedOn = function() {
        return cognitoSvc.isLoggedOn();
      };
      */

      // window.$$scope = $scope;

      $scope.handleLogin = function() {
          
          $scope.npkDB.init();

          $scope.user = {
            email: $scope.cognitoSvc.cognitoUserSession.idToken.payload.email,
            sub: AWS.config.credentials.identityId
          };

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
   .controller('logonCtrl', ['$scope', '$routeParams', '$location', function($scope, $routeParams, $location) {

      $scope.active = false;
      $scope.username;
      $scope.password;
      $scope.newpassword;
      $scope.confirmpassword;
      $scope.verificationcode;

      $scope.onReady = function() {
         // console.log("logonCtrl loaded");
         $scope.$parent.startApp();
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

      $scope.adminCompleteAuth = function() {

        if ($scope.confirmpassword.length < 12) {
          $scope.newpassword = "";
          $scope.confirmpassword = "";

          $('#adminCompleteAuth_modal').effect('shake');
          return false;
        }

        if ($scope.newpassword != $scope.confirmpassword) {
          $('#confirmpassword').addClass('error').effect('shake');
          return false;
        }

        $("#adminCompleteAuth_submit").prop('disabled', true);

        $scope.$parent.cognitoSvc.completeAdminChallenge($scope.confirmpassword).then((data) => {
          $('#adminCompleteAuth_modal').modal('hide');
          $scope.password = $scope.newpassword;
          $scope.signIn();
        }).catch((e) => {
          console.log(e);
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
          $('#adminCompleteAuth').effect('hide');
          $scope.username = $scope.confirmpassword;
          $scope.signIn();
        }).catch((e) => {
          $scope.$parent.ok_modal.set(
              'fa-exclamation-triangle',
              'Error Resetting Password',
              "The following error occured while attempting a password reset: " + JSON.stringify(e),
              "OK")
            .show();
        });
      };

      $scope.signOut = function() {
        $scope.cognitoSvc.cognitoUser.signOut();

        setTimeout(function() {
          localStorage.clear();
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

        $scope.$parent.npkDB.select('self:campaigns:', 'Campaigns').then((data) => {
          $scope.campaigns = JSON.parse(JSON.stringify(data)); //Deepcopy lol
          $scope.campaigns.totals = {hashes: 0, recovered_hashes: 0};

          var promises = [];
          $scope.active_campaigns = 0;
          $scope.inactive_campaigns = 0;
          Object.keys(data).forEach(function (e) {
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
        $scope.populateDashboard();
        $timeout(function() {
          $scope.tickTock();
        }, 30000);
      };

      $scope.executeCampaign = function(campaign_id) {

        $('a#start-' + campaign_id).hide();
        $('img#action-' + campaign_id).show();

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
  .controller('campaignCtrl', ['$scope', '$routeParams', '$timeout', 'pricingSvc', 'DICTIONARY_BUCKETS', 'USERDATA_BUCKET', 'APIGATEWAY_URL', function($scope, $routeParams, $timeout, pricingSvc, DICTIONARY_BUCKETS, USERDATA_BUCKET, APIGATEWAY_URL) {

    $scope.pricingSvc = pricingSvc;
    // window.campaignCtrl = $scope;

    $scope.hashType = 1000;
    $scope.showAll = false;
    $scope.disabled = true;

    $scope.bestPrice = null;
    $scope.idealInstance = 'none';
    $scope.selectedInstance = 'none';
    $scope.selectedRegion = false;
    $scope.forceRegion = false;

    $scope.rulesFiles = {Contents: [{Key: 0, Name: 'Select an Instance'}]};
    $scope.wordlistFiles = {Contents: [{Key: 0, Name: 'Select an Instance'}]};
    $scope.hashesFiles = {Contents: [{Key: 0, Name: '< None Available >'}]};

    $scope.selectedRules = [];
    $scope.selectedWordlist = [];
    $scope.selectedHashfile = "";

    $scope.upload_ready = true;
    $scope.uploading_hashes = false;
    $scope.uploadProgress = 30;
    $scope.upload_finished = false;

    $scope.idealG3Instance = {
      instanceType: "?",
      price: 0,
      az: ''
    };

    $scope.idealP2Instance = {
      instanceType: "?",
      price: 0,
      az: ''
    };

    $scope.idealP3Instance = {
      instanceType: "?",
      price: 0,
      az: ''
    };

    $scope.instances = {};

    $scope.pickForcedRegion = function(region) {
      $scope.forceRegion = ($scope.forceRegion == region) ? false : region;
      $scope.selectedInstance = 'none';

      $scope.processInstancePrices();
    };

    $scope.getLowestPrice = function(list) {

      var promises = [];

      Object.keys(list).forEach(function(e) {
        promises.push($scope.pricingSvc.getSpotPriceHistory(e, $scope.forceRegion));
      });

      return Promise.all(promises).then((data) => {
        var result = {
          cheapestRegion: '',
          cheapestType: '',
          price: null,
          gpus: 0
        };

        Object.keys(data).forEach(function(i) {
          if (data[i].price == null) {
            return false;
          }

          if ($scope.forceRegion !== false && data[i].price == null) {
            return false;
          }

          // TODO: Switch '<' at 551:115 to '>' to pick bigger instances.
          // Is better if cheaper or same price with more GPUs
          if ((data[i].price / list[data[i].instanceType]) < result.price ||
             ((data[i].price / list[data[i].instanceType]) < (result.price + 0.01) && list[data[i].instanceType] < result.gpus) ||
             result.price == null) {
            result = {
              cheapestRegion: data[i].cheapestRegion,
              cheapestType: data[i].instanceType,
              price: (data[i].price / list[data[i].instanceType]),
              gpus: list[data[i].instanceType]
            };
          }
        });

        return result;
      }).catch((err) => {
        console.trace(err);
      });

      return success(result);
    };

    $scope.$watch('selectedRegion', function() {
      if ($scope.selectedRegion != false) {
        $scope.rules_loading = true;
        $scope.wordlist_loading = true;

        $scope.$parent.npkDB.listBucketContents(DICTIONARY_BUCKETS[$scope.selectedRegion], "rules/", $scope.selectedRegion).then((data) => {
          Object.keys(data.Contents).forEach(function (e) {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[1].split('.').slice(0, -1).join('.');
          });

          $scope.rulesFiles = data;
          $scope.rules_loading = false;
          $scope.$digest();
          $('#rules_select').multiSelect('refresh');
        });

        $scope.$parent.npkDB.listBucketContents(DICTIONARY_BUCKETS[$scope.selectedRegion], "wordlist/", $scope.selectedRegion).then((data) => {
          Object.keys(data.Contents).forEach(function (e) {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[1].split('.').slice(0, -1).join('.');
          });

          $scope.wordlistFiles = data;
          $scope.wordlist_loading = false;
          $scope.$digest();
          // $('#wordlist_select').multiSelect('refresh');
        });
      }
    });

    $scope.updateInstances = function() {
      var empty = {
        hashes: "-",
        price: "?",
        hashprice: "?"
      };

      ['g3', 'p2', 'p3'].forEach(function(e) {
        if ($scope.hashType == null) {
          $scope.instances[e] = empty;
        }

        var price = 10;
        if (typeof $scope.pricingSvc[e] == "undefined" || typeof $scope.pricingSvc[e][$scope.hashType] == "undefined") {

          $scope.instances[e] = {
            hashes: "-",
            price: price,
            hashprice: "?"
          };

          return true;
        }

        $scope.instances[e] = {
          hashes: $scope.pricingSvc[e][$scope.hashType].speed,
          price:  price,
          hashprice: Math.round($scope.pricingSvc[e][$scope.hashType].speed / price * 100) / 100
        };

        if ($scope.instances[e].hashprice > $scope.bestPrice || $scope.bestPrice == null) {
          $scope.idealInstance = e;
          $scope.bestPrice = $scope.instances[e].hashprice;
        }
      });
    };

    $scope.selectedAZ = "";
    $scope.pickInstance = function(which) {
      $scope.selectedInstance = which.instanceType;
      $scope.selectedInstanceGeneration = which.instanceType.slice(0, 2);
      $scope.selectedRegion = which.az.slice(0, -1);
      $scope.selectedAZ = which.az;

      $scope.totalPrice = $scope.pricingSvc.spotPrice[$scope.selectedInstance].price * $scope.instanceCount * $scope.instanceDuration;
      $scope.updateTotalKeyspace();
    };

    $scope.knownMetadata = {};
    $scope.retrievingMetadata = 0;
    $scope.retrieveS3Metadata = function(bucket, key, region) {

      bucket = (bucket == "self") ? USERDATA_BUCKET : bucket;
      bucket = (bucket == "dict" && $scope.selectedRegion != "") ? DICTIONARY_BUCKETS[$scope.selectedRegion] : bucket;

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

    $scope.$watch('selectedRules', function() {
      $scope.updateWordlistAttack();
    });

    $scope.$watch('hashType', function() {
      $scope.updateWordlistAttack();

      if ($scope.selectedInstance != "none") {
        $scope.maskDuration = Math.floor($scope.maskKeyspace / $scope.instances[$scope.selectedInstanceGeneration].hashes / $scope.gpus[$scope.selectedInstance])
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
        promises.push($scope.retrieveS3Metadata('dict', e.Key, $scope.selectedRegion));
      });

      $scope.selectedRules.forEach(function(e) {
        promises.push($scope.retrieveS3Metadata('dict', e.Key, $scope.selectedRegion));
      });

      if ($scope.selectedInstance == "none") {
        return Promise.resolve(true);
      }

      return Promise.all(promises).then((data) => {
        $scope.wordlistAttackStats = {
          wordlist: {lines: 0, size: 0},
          rules: {keyspace: 1, lines: 0, size: 0},
          total: {keyspace: 0, size: 0, requiredDuration: 0}
        };

        bucket = DICTIONARY_BUCKETS[$scope.selectedRegion];

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

        $scope.wordlistAttackStats.total.requiredDuration = Math.floor($scope.wordlistAttackStats.total.keyspace / $scope.instances[$scope.selectedInstanceGeneration].hashes / $scope.gpus[$scope.selectedInstance])

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
      "f": "(Fubar. Something is wrong.)",
      0: "(Use Rules)",
      3: "(Mask Only)",
      6: "(Hybrid; Dictionary + Mask)"
    };

    $scope.totalKeyspace = 0;
    $scope.totalDuration = 0;
    $scope.updateTotalKeyspace = function() {
      $scope.totalKeyspace = (($scope.use_mask) ? $scope.maskKeyspace : 1) * (($scope.use_wordlist) ? $scope.wordlistAttackStats.total.keyspace : 1);
      $scope.totalDuration = $scope.totalKeyspace / (($scope.selectedInstance != "none") ? ($scope.gpus[$scope.selectedInstance] * ($scope.instances[$scope.selectedInstanceGeneration].hashes /4)) : 1);

      $scope.updateCoverage();

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

      $scope.attackType = 'f';
      return true;
    };

    $scope.totalCoverage = 0;
    $scope.instanceCount = 2;
    $scope.instanceDuration = 4;
    $scope.totalPrice = 0;

    $scope.updateCoverage = function() {
      if ($scope.selectedInstance == "none") {
        return false;
      }

      var countDuration = $scope.totalDuration / $scope.instanceCount;
      $scope.totalCoverage =  (($scope.instanceDuration * 60 * 60) / countDuration) * 100;
      $scope.totalPrice = $scope.pricingSvc.spotPrice[$scope.selectedInstance].price * $scope.instanceCount * $scope.instanceDuration;
    };

    $scope.use_mask = false;
    $scope.toggleMask = function() {
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
    };

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

      if ($scope.selectedInstance != "none") {
        $scope.maskDuration = Math.floor($scope.maskKeyspace / $scope.instances[$scope.selectedInstanceGeneration].hashes / $scope.gpus[$scope.selectedInstance])
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

    $scope.gpus = {
      // "g3s.xlarge": 1,
      "g3.4xlarge": 1,
      "g3.8xlarge": 2,
      "g3.16xlarge": 4,
      "p2.xlarge": 1,
      "p2.8xlarge": 8,
      "p2.16xlarge": 16,
      "p3.2xlarge": 1,
      "p3.8xlarge": 4,
      "p3.16xlarge": 8
    };

    $scope.uploadHashFile = function() {
      var reader = new FileReader();
      var file = $('#hashfile')[0].files[0];

      if (!file) {
        return false;
      }

      $scope.upload_ready = false;
      $scope.uploading_hashes = true;
      $scope.$digest();

      reader.onloadend = function() {
        var uploader = new AWS.S3.ManagedUpload({
          params: {Bucket: USERDATA_BUCKET, Key: AWS.config.credentials.identityId + "/uploads/" + file.name, Body: reader.result, ContentType: "text/plain"}
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

          console.log("Success");
          $scope.uploading_hashes = false;
          $scope.upload_finished = true;
          $scope.$digest();

          $scope.getHashFiles();
        });
      };

      reader.readAsArrayBuffer(file);
    };

    $scope.getHashFiles = function() {
      $scope.$parent.npkDB.listBucketContents(USERDATA_BUCKET, "self/uploads/").then((data) => {
        Object.keys(data.Contents).forEach(function (e) {
          if (data.Contents[e].Key.indexOf('.') > 0) {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[2].split('.').slice(0, -1).join('.');
          } else {
            data.Contents[e].Name = data.Contents[e].Key.split('/')[2];
          }
          
        });

        $scope.hashesFiles = data;
        $scope.hashfiles_loading = false;
        $scope.$digest();
      });
    }

    $scope.order = {};
    $scope.verifyOrder = function() {
      $scope.orderErrors = [];
      $scope.orderWarnings = [];

      if ($scope.selectedInstance == "none") {
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
      
      if (!$scope.use_wordlist && !$scope.use_mask) {
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

      if ($scope.use_mask) {
        $scope.extendMask('?l');

        if (!$scope.reduceMask()) {
          $scope.orderErrors.push("Invalid Mask.");
        }

        if ($scope.mask == "") {
          $scope.orderWarnings.push("Mask cannot be empty. Set a mask or disable the mask attack.");
        }
      }

      if ($scope.instanceCount < 1 || $scope.instanceCount > 6) {
        $scope.orderErrors.push("Invalid instance count.");
      }

      if ($scope.instanceDuration < 1 || $scope.instanceDuration > 24) {
        $scope.orderErrors.push("Invalid instance duration.");
      }

      if ($scope.instanceCount > 1 && $scope.instanceCount > $scope.instanceDuration / 2) {
        $scope.orderWarnings.push("Fewer instances with longer durations are more effective. Consider revising your count and duration.");
      }

      // TODO: Implement max price here.
      if ($scope.totalPrice > 100) {
        $scope.orderWarnings.push("Total price exceeds campaign limits. Your instances may terminate earlier than you intend.");
      }

      if ($scope.orderErrors.length > 0) {
        $('#orderErrorModal').modal('show');

        return false;
      }

      $scope.order = {
        region: $scope.selectedRegion,
        availabilityZone: $scope.selectedAZ,
        instanceType: $scope.selectedInstance,
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

      $scope.$parent.npkDB.s3.getSignedUrl('getObject', {
        Bucket: USERDATA_BUCKET,
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
      

      }).fail((data) => {
        $scope.submittingOrder = false;

        var response = {};

        try {
          response = JSON.parse(data.responseText);
        } catch (e) {
          response = {msg: "Unable to parse response as JSON", success: false};
        }

        $('#orderResponseModal').modal('hide');
        $scope.orderErrors = [response.msg];
        $scope.$digest();
        $('#orderErrorModal').modal('show');
      });
    }

    $scope.processInstancePrices = function() {
      $scope.cheapest_g3 = $scope.getLowestPrice({
        // "g3s.xlarge": 1,
        "g3.4xlarge": 1,
        "g3.8xlarge": 2,
        "g3.16xlarge": 4
      });

      $scope.cheapest_p2 = $scope.getLowestPrice({
        "p2.xlarge": 1,
        "p2.8xlarge": 8,
        "p2.16xlarge": 16
      });

      $scope.cheapest_p3 = $scope.getLowestPrice({
        "p3.2xlarge": 1,
        "p3.8xlarge": 4,
        "p3.16xlarge": 8
      });

      Promise.all([
        $scope.cheapest_g3,
        $scope.cheapest_p2,
        $scope.cheapest_p3
      ]).then((data) => {
        $scope.idealG3Instance = {
          instanceType: data[0].cheapestType,
          price: data[0].price,
          az: data[0].cheapestRegion
        };

        $scope.idealP2Instance = {
          instanceType: data[1].cheapestType,
          price: data[1].price,
          az: data[1].cheapestRegion
        };

        $scope.idealP3Instance = {
          instanceType: data[2].cheapestType,
          price: data[2].price,
          az: data[2].cheapestRegion
        };

        $scope.$apply()
      }).catch((err) => {
        throw Error(err);
      });
    }

    $scope.onReady = function() {
      $scope.$parent.startApp();
      $scope.updateInstances();

      $scope.toggleMask();
      $scope.toggleWordlist();

      $scope.processInstancePrices();

      $scope.getHashFiles();

      $timeout(function() {
        $('#rules_select').multiSelect();
        $('#rules_select').multiSelect('destroy');
        // $('#wordlist_select').multiSelect();
      });

      $("#instance_count").ionRangeSlider({
        type: "single",
        min: 1,
        max: 6,
        step: 1,
        grid: true,
        grid_num: 1,
        grid_snap: true
      });

      $("#instance_duration").ionRangeSlider({
        type: "single",
        min: 1,
        max: 24,
        step: 1,
        grid: true,
        grid_num: 1,
        grid_snap: true,
        prettify: function(num) {
          return num + " Hours";
        }
      });
      
    };

    $scope.$on('$routeChangeSuccess', function() {

      $scope.onReady();
    });
  }])
  .controller('filesCtrl', ['$scope', '$routeParams', '$location', 'USERDATA_BUCKET', function($scope, $routeParams, $location, USERDATA_BUCKET) {

    $scope.files = {};
    $scope.pathTree = {};
    $scope.files_loading = false;
    $scope.populateFiles = function() {
      $scope.files_loading = true;
      $scope.$parent.npkDB.listBucketContents(USERDATA_BUCKET, "self/").then((data) => {
        Object.keys(data.Contents).forEach(function (e) {
          $scope.files[data.Contents[e].Key] = data.Contents[e];
        });

        $scope.pathTree = $scope.getPathTree(Object.keys($scope.files));
        $scope.files_loading = false;
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
        Bucket: USERDATA_BUCKET,
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
        Bucket: USERDATA_BUCKET,
        Key: file,
        ResponseContentType: "text/plain"
      });
    }

    $scope.onReady = function() {
       $scope.$parent.startApp();
       $scope.populateFiles();
    };

    $scope.$on('$routeChangeSuccess', function() {
       
       $scope.onReady();
    });
  }])
  .controller('cmCtrl', ['$scope', '$routeParams', '$location', 'USERDATA_BUCKET', function($scope, $routeParams, $location, USERDATA_BUCKET) {

    $scope.data = {};
    $scope.campaigns = {};
    $scope.campaigns_loaded = false;

    $scope.first = 0;
    $scope.firstRecovery = 0;
    $scope.last = 0;
    $scope.selected_campaign = null;

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
      
      $scope.$parent.npkDB.getObject(USERDATA_BUCKET, "self/campaigns/" + campaign + "/manifest.json").then((data) => {
        try {
          $scope.manifest = JSON.parse(data.Body.toString('ascii'));
        } catch (e) {
          console.log('Unable to parse manifest');
          return false;
        }

        $scope.manifest.hashFileExpires = $scope.manifest.hashFileUrl.split('&')[1].split('=')[1];

        var instance = $scope.manifest.instanceType.split('.');
        $scope.manifest.instanceGeneration = instance[0].toUpperCase();
        $scope.manifest.instanceSize = instance[1];


        $scope.$digest();

      }).catch((err) => {
        console.log('Error retrieving campaign manifest: ' + err)
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
  ;