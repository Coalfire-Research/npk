angular
   .module('app')
   .factory('wowCompletionistFactory', ['$http', 'wowCompletionistSvc', function($http, wowCompletionistSvc) {

      var data = {};
      var service = {};

      var providers = {
         "loadCharacter": "loadCharacter"
      };

      // -- Takes an array of provider names --//
      // -- Will make sure they exist before returning. -- //
      service.expect = function(list) {
         promises = [];
         list.forEach(function(e) {
            promises.push(new Promise((success, failure) => {
               if (service[providers[e]]()) {
                  success(e);
               }

               failure('service.' + e + '() returned false;');
            }).then((name) => {
               console.log('service.' + name + '() returned successfully.');
            }, (err) => {
               throw err;
            }));
         });

         return Promise.all(promises);
      };


   }])
   ;