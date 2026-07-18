angular
    .module('app', ["ngRoute", "ngSanitize"])
    .filter('prettyJson', function() {
    	return function(what) {
    		return JSON.stringify(what, null, ' ').trim();
    	};
    })
    .filter('fieldMemberOf', function() {
    	return function(source, field, mask) {
    		return source
    			.filter(e => mask.includes(e[field]));
    	}
    })
		.filter('keys', function() {
			return function(obj) {
				return Object.keys(obj)
			}
		})
    .filter('equals', function() {
    	return function(items, equals) {
    		if (typeof items != "object") {
				return "Equals filter requires object";
			}

			var answer = false;
			Object.keys(items).forEach(function (e) {
				if (items[e] == equals) {
					answer = e;
				}
			});

			return answer;
    	}
    })
	.filter('count', function() {
		return function(items) {
			if (items == null) {
				return null;
			}

			if (typeof items == "object") {
				return Object.keys(items).length;
			}

			if (typeof items == "array") {
				return items.length;
			}

			console.log("filter::count = " + typeof items);

			return false;
		};
	})
	.filter('filterObj', function() {
		return function(items, keys) { // keys = {attr: value}
			var result = {};

			if (typeof keys != "object") {
				return {};
			}
			
			angular.forEach(items, function(value, key) {
				if (typeof value[Object.keys(keys)[0]] != "undefined") {
					if (value[Object.keys(keys)[0]] == keys[Object.keys(keys)[0]]) {
						result[key] = value;
					}
				}
			});

			return result;
		};
	})
	.filter('toArray', function() {
		return function(object) {
			const newObject = Object.keys(object).reduce((acc, cur) => {
				object[cur]._id = cur;
				acc.push(object[cur]);

				return acc;
			}, []);

			return newObject;
		}
	})
	.filter('toHs', function() {
		return function(number) {

			if (number == "-" || number == "?") {
				return "???";
			}

			number = parseInt(number);
			
			if (number.toString().length < 4) {
				return number + " h/s";
			}

			if (number.toString().length < 7) {
				return (Math.round(number / 10) / 100) + " Kh/s";
			}

			if (number.toString().length < 10) {
				return (Math.round(number / 10000) / 100) + " Mh/s";
			}

			if (number.toString().length < 13) {
				return (Math.round(number / 10000000) / 100) + " Gh/s";
			}
		};
	})
	.filter('commonHashTypes', function() {
		var filter = function(items, favorites, filter) {
			var commonItems = [
				"NTLM",
				"NetNTLMv2",
				"WPA/WPA2",
				"WPA/WPA2 PMK"
			];

			favorites = favorites || [];

			result = {};
			Object.keys(items).forEach(function(e) {
				if (commonItems.indexOf(e) > -1 || favorites.indexOf(e) > -1 || filter === false) {
					result[e] = items[e];
				}
			});

			return result;
		};

		filter.$stateful = true;
		return filter;
	})
	.filter('momentns', function () {
	    return function (input, momentFn /*, param1, param2, ...param n */) {
	  		var args = Array.prototype.slice.call(arguments, 2),
	        momentObj = moment(Date.now() + (input * 1000));

	        if (input == 0 && momentFn == 'fromNow') {
	        	return 'Instantly';
	        }

	        if (input == null) {
	        	return 'Maybe';
	        }

	    	return momentObj[momentFn].apply(momentObj, args);
	  	};
	})
	.filter('momentfn', function () {
	    return function (input, momentFn /*, param1, param2, ...param n */) {
	  		var args = Array.prototype.slice.call(arguments, 2),
	        momentObj = moment((input * 1000));

	        if (input == 0 && momentFn == 'fromNow') {
	        	return 'Instantly';
	        }

	        if (input == null) {
	        	return 'Maybe';
	        }

	    	return momentObj[momentFn].apply(momentObj, args);
	  	};
	})
	.directive('ngEnter', function() {
		return function(scope, element, attrs) {
			element.bind("keydown keypress", function(event) {
				if(event.which === 13) {
					scope.$apply(function(){
						scope.$eval(attrs.ngEnter);
					});

					event.preventDefault();
				}
			});
		};
	})
    .config(['$routeProvider', '$locationProvider', 'cognitoProvider', function($routeProvider, $locationProvider, cognitoProvider) {

    	// Set the cognitoProvider's unauthenticated redirect route.
    	cognitoProvider.setLogonRoute('/');
    	cognitoProvider.setUserRoute('/dashboard');

    	$locationProvider.hashPrefix('');

	   	$routeProvider
	   	.when('/', {
	   		templateUrl: "views/signin.html",
	   		controller: "logonCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeBlockLoggedOn("/dashboard");
	   		}]
	   	})
	   	.when('/forgot', {
	   		templateUrl: "views/reset.html",
	   		controller: "logonCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeBlockLoggedOn("/dashboard");
	   		}]
	   	})
	   	.when('/pwreset-confirm', {
	   		templateUrl: "views/confirm-reset.html",
	   		controller: "logonCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeBlockLoggedOn("/dashboard");
	   		}]
	   	})
	   	.when('/dashboard', {
	   		templateUrl: "views/dashboard.html",
	   		controller: "dashboardCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/logout', {
	   		templateUrl: "views/signout.html",
	   		controller: "logonCtrl"
	   	})
	   	.when('/new-campaign', {
	   		templateUrl: "views/new-campaign.html",
	   		controller: "campaignCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/file-management', {
	   		templateUrl: "views/file-management.html",
	   		controller: "filesCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/file-management/:basePath*', {
	   		templateUrl: "views/file-management.html",
	   		controller: "filesCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/campaign-management', {
	   		templateUrl: "views/campaign-management.html",
	   		controller: "cmCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/campaign-management/:campaignId', {
	   		templateUrl: "views/campaign-management.html",
	   		controller: "cmCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/events', {
	   		templateUrl: "views/events.html",
	   		controller: "evCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireAdmin();
	   		}]
	   	})
	   	.when('/user-settings', {
	   		templateUrl: "views/user-settings.html",
	   		controller: "sCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireLogin();
	   		}]
	   	})
	   	.when('/users', {
	   		templateUrl: "views/user-administration.html",
	   		controller: "uaCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireAdmin();
	   		}]
	   	})
	   	.when('/dictionaries', {
	   		templateUrl: "views/dictionary-management.html",
	   		controller: "dmCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireAdmin();
	   		}]
	   	})
	   	.when('/quota', {
	   		templateUrl: "views/quota.html",
	   		controller: "htCtrl",
	   		resolveRedirectTo: ['cognito', function(cognito) {
	   			return cognito.routeRequireAdmin();
	   		}]
	   	})

	   	.otherwise({
	   		redirectTo: "/",
	   	});
    }])
    .directive('sidebar', function () {
    	return {
    		templateUrl: "sidebar.html"
    	};
    })
    .directive('jsonText', function() {
	    return {
	        restrict: 'A',
	        require: 'ngModel',
	        link: function(scope, element, attr, ngModel) {            
	          function into(input) {
	            return JSON.parse(input);
	          }
	          function out(data) {
	            return JSON.stringify(data);
	          }
	          ngModel.$parsers.push(into);
	          ngModel.$formatters.push(out);
	        }
	    };
	})
    ;

/*
var routeRequireLogon = function() {
	// console.log("Am logged in?: " + isLoggedOn());

	return new Promise((success, failure) => {
		if (!cognitoProvider.isLoggedOn()) {
			console.log('routeRequireLogon::isLoggedOn -> true');
			return success('/');
		}

		return success()
	);
};
*/