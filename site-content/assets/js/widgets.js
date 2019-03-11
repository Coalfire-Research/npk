// chart 1
	
	$('#widget-chart-1').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#008cff'
        });
		
	// chart 2
	
		$('#widget-chart-2').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#fd3550'
        });
		
	// chart 3	
		
		$('#widget-chart-3').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#15ca20'
        });
		
	// chart 4	
		
		$('#widget-chart-4').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#ff9700'
        });
		
	// chart 5	
		
		$('#widget-chart-5').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#0dceec'
        });
		
	// chart 6	
		
		$('#widget-chart-6').sparkline([5,8,7,10,9,10,8,6,4,6,8,7,6,8,9,10,8,6,4,5,8,7,10,9,5,8,7,9,5,4], {
            type: 'bar',
            height: '25',
            barWidth: '2',
            resize: true,
            barSpacing: '2',
            barColor: '#223035'
        });
		
		
	// chart 7

 var ctx = document.getElementById('widget-chart-7').getContext('2d');

  var gradientStroke1 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke1.addColorStop(0, '#008cff');
      gradientStroke1.addColorStop(1, 'rgba(22, 195, 233, 0.1)');

      var myChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Revenue',
            data: [3, 30, 10, 10, 22, 12, 5],
            pointBorderWidth: 2,
            pointHoverBackgroundColor: gradientStroke1,
            backgroundColor: gradientStroke1,
            borderColor: 'transparent',
            borderWidth: 1
          }]
        },
        options: {
            legend: {
			  position: 'bottom',
              display:false
            },
            tooltips: {
			  displayColors:false,	
              mode: 'nearest',
              intersect: false,
              position: 'nearest',
              xPadding: 10,
              yPadding: 10,
              caretPadding: 10
            }
         }
      });



// chart 8

var ctx = document.getElementById("widget-chart-8").getContext('2d');

  var gradientStroke1 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke1.addColorStop(0, '#ee0979');
      gradientStroke1.addColorStop(1, '#ff6a00');
    
  var gradientStroke2 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke2.addColorStop(0, '#283c86');
      gradientStroke2.addColorStop(1, '#39bd3c');

  var gradientStroke3 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke3.addColorStop(0, '#7f00ff');
      gradientStroke3.addColorStop(1, '#e100ff');

      var myChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ["Completed", "Pending", "Process"],
          datasets: [{
            backgroundColor: [
              gradientStroke1,
              gradientStroke2,
              gradientStroke3
            ],

             hoverBackgroundColor: [
              gradientStroke1,
              gradientStroke2,
              gradientStroke3
            ],

            data: [50, 50, 50],
      borderWidth: [0, 0, 0]
          }]
        },
        options: {
          cutoutPercentage: 85,
            legend: {
              position: 'bottom',
              display: true,
            labels: {
                boxWidth:8
              }
            },
			tooltips: {
			  displayColors:false,
			},
        }
      });

	  
  // chart 9

    var ctx = document.getElementById("widget-chart-9").getContext('2d');
   
      var gradientStroke1 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke1.addColorStop(0, '#f54ea2');
      gradientStroke1.addColorStop(1, '#ff7676');

      var gradientStroke2 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke2.addColorStop(0, '#42e695');
      gradientStroke2.addColorStop(1, '#3bb2b8');

      var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [1, 2, 3, 4, 5, 6, 7, 8],
          datasets: [{
            label: 'Clothing',
            data: [40, 30, 60, 35, 60, 25, 50, 40],
            borderColor: gradientStroke1,
            backgroundColor: gradientStroke1,
            hoverBackgroundColor: gradientStroke1,
            pointRadius: 0,
            fill: false,
            borderWidth: 1
          }, {
            label: 'Electronic',
            data: [50, 60, 40, 70, 35, 75, 30, 20],
            borderColor: gradientStroke2,
            backgroundColor: gradientStroke2,
            hoverBackgroundColor: gradientStroke2,
            pointRadius: 0,
            fill: false,
            borderWidth: 1
          }]
        },
		options:{
		  legend: {
			  position: 'bottom',
              display: true,
			  labels: {
                boxWidth:8
              }
            },	
		  scales: {
			  xAxes: [{
				barPercentage: .5
			  }]
		     },
			tooltips: {
			  displayColors:false,
			}
		}
      });




	
// chart 10

  var ctx = document.getElementById("widget-chart-10").getContext('2d');
   
  var gradientStroke1 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke1.addColorStop(0, '#6078ea');  
      gradientStroke1.addColorStop(1, '#17c5ea'); 
   
  var gradientStroke2 = ctx.createLinearGradient(0, 0, 0, 300);
      gradientStroke2.addColorStop(0, '#ff8359');
      gradientStroke2.addColorStop(1, '#ffdf40');

      var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [1, 2, 3, 4, 5, 6, 7, 8,9,10,11,12],
          datasets: [{
            label: 'Laptops',
            data: [65, 59, 80, 81,65, 59, 80, 81,59, 80, 81,65],
            borderColor: gradientStroke1,
            backgroundColor: gradientStroke1,
            hoverBackgroundColor: gradientStroke1,
            pointRadius: 0,
            fill: false,
            borderWidth: 0
          }, {
            label: 'Mobiles',
            data: [28, 48, 40, 19,28, 48, 40, 19,40, 19,28, 48],
            borderColor: gradientStroke2,
            backgroundColor: gradientStroke2,
            hoverBackgroundColor: gradientStroke2,
            pointRadius: 0,
            fill: false,
            borderWidth: 0
          }]
        },
		
		options:{
		  legend: {
			  position: 'bottom',
              display: true,
			  labels: {
				fontColor: '#ddd',
                boxWidth:8
              }
            },	
			tooltips:{
				displayColors:false,
			  },
		  scales: {
			  xAxes: [{
				barPercentage: .4,
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
	  
	 
// chart 11

 var ctx = document.getElementById('widget-chart-11').getContext('2d');
 
			var myChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: ['1', '2', '3', '4', '5', '6', '7'],
					datasets: [{
						label: 'Jeans',
						data: [0, 30, 60, 25, 60, 25, 50],
						backgroundColor: "transparent",
						borderColor: "#fd3550",
						borderWidth: 2
						
					}, {
						label: 'T-Shirts',
						data: [0, 60, 25, 80, 35, 75, 30],
						backgroundColor: "transparent",
						borderColor: "#15ca20",
						borderWidth: 2,

					}]
				},
				 options: {
					legend: {
					  position: 'bottom',
					  display: true,
					  labels: {
						fontColor: '#eee',  
						boxWidth:8
					  }
					},
					tooltips: {
					  displayColors:false,
					},
				  scales: {
					  xAxes: [{
						ticks: {
							beginAtZero:true,
							fontColor: '#eee'
						},
						gridLines: {
						  display: true ,
						  color: "rgba(221, 221, 221, 0.08)"
						},
					  }],
					   yAxes: [{
						ticks: {
							beginAtZero:true,
							fontColor: '#eee'
						},
						gridLines: {
						  display: true ,
						  color: "rgba(221, 221, 221, 0.08)"
						},
					  }]
					 }
				}
			});



	  
		