
  $(function() {
    "use strict";

    $('#sparklinechart1').sparkline([ 1, 4, 5, 9, 8, 10, 5, 8,4,10,7,5,7], {
            type: 'bar',
            height: '65',
            barWidth: '4',
            resize: true,
            barSpacing: '5',
            barColor: '#008cff'
        });
    
  $('#sparklinechart2').sparkline([20, 20, 20], {
            type: 'pie',
            width: '65',
            height: '65',
            resize: true,
            sliceColors: ['#008cff', '#15ca20', '#fd3550']
        });   
    
  $("#sparklinechart3").sparkline([2,4,4,6,8,5,6,4,8,6,6,2 ], {
    type: 'line',
    width: '100',
    height: '65',
    lineColor: '#15ca20',
    fillColor: '#15ca20',
    maxSpotColor: '#15ca20',
    highlightLineColor: 'rgba(0, 0, 0, 0.2)',
    highlightSpotColor: '#15ca20'
  });
  
  
   $("#sparklinechart4").sparkline([0, 5, 10, 5, 15, 10, 20, 10, 5, 10, 5, 15, 10 ], {
            type: 'line',
            width: '100',
            height: '65',
            lineWidth: '2',
            lineColor: '#fd3550',
            fillColor: 'transparent',
            spotColor: '#fff',
            minSpotColor: undefined,
            maxSpotColor: undefined,
            highlightSpotColor: undefined,
            highlightLineColor: undefined
    }); 


$('#sparklinechart5').sparkline([40, 40, 40], {
      type: 'pie',
      height: '200',
      resize: true,
      sliceColors: ['#008cff', '#15ca20', '#fd3550']
  });
  
  $("#sparklinechart6").sparkline([5,6,2,8,9,4,7,10,11,12,10,4,7,10], {
  type: 'bar',
  height: '200',
  barWidth: 10,
  barSpacing: 7,
  barColor: '#15ca20'
  });

   $('#sparklinechart7').sparkline([5, 6, 2, 9, 4, 7, 10, 12,4,7,10], {
      type: 'bar',
      height: '200',
      barWidth: '10',
      resize: true,
      barSpacing: '7',
      barColor: '#fd3550'
  });

$('#sparklinechart7').sparkline([5, 6, 2, 9, 4, 7, 10, 12,4,7,10], {
    type: 'line',
    height: '200',
    lineColor: '#fd3550',
    fillColor: 'transparent',
    composite: true,
    highlightLineColor: 'rgba(0,0,0,.1)',
    highlightSpotColor: 'rgba(0,0,0,.2)'
});

$("#sparklinechart8").sparkline([0, 23, 43, 35, 44, 45, 56, 37, 40, 45, 56, 7, 10], {
      type: 'line',
      width: '100%',
      height: '200',
      lineColor: '#fff',
      fillColor: 'transparent',
      spotColor: '#fff',
      minSpotColor: undefined,
      maxSpotColor: undefined,
      highlightSpotColor: undefined,
      highlightLineColor: undefined
  }); 


$('#sparklinechart9').sparkline([15, 23, 55, 35, 54, 45, 66, 47, 30], {
      type: 'line',
      width: '100%',
      height: '200',
      chartRangeMax: 50,
      resize: true,
      lineColor: '#008cff',
      fillColor: 'rgba(0, 123, 255, 0.37)',
      highlightLineColor: 'rgba(0,0,0,.1)',
      highlightSpotColor: 'rgba(0,0,0,.2)',
  });


$('#sparklinechart9').sparkline([0, 13, 10, 14, 15, 10, 18, 20, 0], {
      type: 'line',
      width: '100%',
      height: '200',
      chartRangeMax: 40,
      lineColor: '#fd3550',
      fillColor: 'rgba(220, 53, 69, 0.59)',
      composite: true,
      resize: true,
      highlightLineColor: 'rgba(0,0,0,.1)',
      highlightSpotColor: 'rgba(0,0,0,.2)',
  });



   });