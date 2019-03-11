       
$(function() {
    "use strict";

	   //pie
            $("span.pie").peity("pie",{
                width: 150,
                height: 150 
            });
        
        //donut

          $("span.donut").peity("donut",{
                width: 150,
                height: 150 
            });

         // line
         $('.peity-line').each(function() {
            $(this).peity("line", $(this).data());
         });

         // bar
          $('.peity-bar').each(function() {
            $(this).peity("bar", $(this).data());
         });
         
   });