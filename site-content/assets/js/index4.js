$(function() {
    "use strict";

	// chart 1
	
	$('#dashboard4-chart-1').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#008cff'
        });
		
	// chart 2
	
		$('#dashboard4-chart-2').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#fd3550'
        });
		
	// chart 3	
		
		$('#dashboard4-chart-3').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#15ca20'
        });
		
	// chart 4	
		
		$('#dashboard4-chart-4').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#ff9700'
        });
		
	// chart 5	
		
		$('#dashboard4-chart-5').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#0dceec'
        });
		
	// chart 6	
		
		$('#dashboard4-chart-6').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#e9eaea'
        });
	
	
	// chart 7
 
 var ctx = document.getElementById('dashboard4-chart-7').getContext('2d');
 
   var gradientStroke1 = ctx.createLinearGradient(0, 0, 0, 300);
       gradientStroke1.addColorStop(0, '#7f00ff');
       gradientStroke1.addColorStop(1, 'rgba(225, 0, 255, 0.1)');

   var gradientStroke2 = ctx.createLinearGradient(0, 0, 0, 300);
       gradientStroke2.addColorStop(0, '#3bb2b8');
       gradientStroke2.addColorStop(1, 'rgba(66, 230, 149, 0.1)');

      var myChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          datasets: [ {
            label: 'Apple',
            data: [0, 30, 60, 25, 60, 25, 50, 10, 60, 30, 80, 0],
            pointBorderWidth: 4,
            pointHoverBackgroundColor: gradientStroke1,
            backgroundColor: gradientStroke1,
            borderColor: gradientStroke1,
            borderWidth: 2
          },{
            label: 'Samsung',
            data: [0, 60, 25, 80, 35, 75, 30, 55, 20, 60, 10, 0],
            pointBorderWidth: 4,
            pointHoverBackgroundColor: gradientStroke2,
            backgroundColor: gradientStroke2,
            borderColor: gradientStroke2,
            borderWidth: 2
          }]
        },
        options: {
            
            tooltips: {
			  displayColors:false,	
              mode: 'nearest',
              intersect: false,
              position: 'nearest',
              xPadding: 10,
              yPadding: 10,
              caretPadding: 10
            },
			legend: {
			  position: 'top',
              display: true,
			  labels: {
				fontColor: '#ddd',  
                boxWidth:40
              }
            },
			scales: {
			  xAxes: [{
				ticks: {
                    beginAtZero:true,
                    fontColor: '#ddd'
                },
				gridLines: {
				  display: true ,
				  color: "rgba(221, 221, 221, 0.08)"
				},
			  }],
			   yAxes: [{
				ticks: {
                    beginAtZero:true,
                    fontColor: '#ddd'
                },
				gridLines: {
				  display: true ,
				  color: "rgba(221, 221, 221, 0.08)"
				},
			  }]
		     }

         }
      }); 

	  
// worl map

jQuery('#dashboard-map').vectorMap(
{
    map: 'world_mill_en',
    backgroundColor: 'transparent',
    borderColor: '#818181',
    borderOpacity: 0.25,
    borderWidth: 1,
    zoomOnScroll: false,
    color: '#009efb',
    regionStyle : {
        initial : {
          fill : '#fd3550'
        }
      },
    markerStyle: {
      initial: {
                    r: 9,
                    'fill': '#fff',
                    'fill-opacity':1,
                    'stroke': '#000',
                    'stroke-width' : 5,
                    'stroke-opacity': 0.4
                },
                },
    enableZoom: true,
    hoverColor: '#009efb',
    markers : [{
        latLng : [21.00, 78.00],
        name : 'Lorem Ipsum Dollar'
      
      }],
    hoverOpacity: null,
    normalizeFunction: 'linear',
    scaleColors: ['#b6d6ff', '#005ace'],
    selectedColor: '#c9dfaf',
    selectedRegions: [],
    showTooltip: true,
});	  
	  

// chart 8

  $("#dashboard4-chart-8").sparkline([3,5,3,7,5,10,3,6,5,0], {
            type: 'line',
            width: '100',
            height: '40',
            lineWidth: '2',
            lineColor: '#0dceec',
            fillColor: 'rgba(13, 206, 236, 0.2)',
            spotColor: '#0dceec',
    }); 

  
// chart 9    

  $("#dashboard4-chart-9").sparkline([3,5,3,7,5,10,3,6,5,0], {
            type: 'line',
            width: '100',
            height: '40',
            lineWidth: '2',
            lineColor: '#ff9700',
            fillColor: 'rgba(255, 151, 0, 0.2)',
            spotColor: '#ff9700',
    }); 

// chart 10    

  $("#dashboard4-chart-10").sparkline([3,5,3,7,5,10,3,6,5,0], {
            type: 'line',
            width: '100',
            height: '40',
            lineWidth: '2',
            lineColor: '#15ca20',
            fillColor: 'rgba(21, 202, 32, 0.2)',
            spotColor: '#15ca20',
    }); 

 // chart 11 
	
	Morris.Donut({
		element: 'dashboard4-chart-11',
		data: [{
			label: "Samsung",
			value: 15,

		}, {
			label: "Nokia",
			value: 30,
		}, {
			label: "Apple",
			value: 20,
		}],
		resize: true,
		labelColor: "#ffffff",
		colors:['#008cff', '#15ca20', '#fd3550']
	});
	
	
	  

});
      
	  