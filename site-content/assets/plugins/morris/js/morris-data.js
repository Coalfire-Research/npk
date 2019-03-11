
$(function () {
    "use strict";
    
Morris.Area({
        element: 'morris-chart-1',
        data: [{
                    period: '2010',
                    iphone: 10,
                    ipad: 20
                }, {
                    period: '2011',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2012',
                    iphone: 50,
                    ipad: 40
                }, {
                    period: '2013',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2014',
                    iphone: 50,
                    ipad: 40
                }, {
                    period: '2015',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2016',
                    iphone: 90,
                    ipad: 75
                }


                ],
        xkey: 'period',
        ykeys: ['iphone', 'ipad'],
        labels: ['iPhone', 'iPad'],
        pointSize: 3,
        fillOpacity: 0,
        pointStrokeColors:['#008cff', '#15ca20'],
        behaveLikeLine: true,
        gridLineColor: '#e0e0e0',
        lineWidth: 3,
        hideHover: 'auto',
        lineColors: ['#008cff', '#15ca20'],
        resize: true
        
    });
	
 // Morris donut chart
        
    Morris.Donut({
        element: 'morris-chart-2',
        data: [{
            label: "Download Sales",
            value: 15,

        }, {
            label: "In Store Sales",
            value: 30
        }, {
            label: "Mail Order Sales",
            value: 20
        }],
        resize: true,
        colors:['#008cff', '#15ca20', '#fd3550']
    });

// Morris bar chart
    Morris.Bar({
        element: 'morris-chart-3',
        data: [{
            y: '2006',
            a: 100,
            b: 90,
            c: 60
        }, {
            y: '2007',
            a: 75,
            b: 65,
            c: 40
        }, {
            y: '2008',
            a: 50,
            b: 40,
            c: 30
        }, {
            y: '2009',
            a: 75,
            b: 65,
            c: 40
        }, {
            y: '2010',
            a: 50,
            b: 40,
            c: 30
        }, {
            y: '2011',
            a: 75,
            b: 65,
            c: 40
        }, {
            y: '2012',
            a: 100,
            b: 90,
            c: 40
        }],
        xkey: 'y',
        ykeys: ['a', 'b', 'c'],
        labels: ['A', 'B', 'C'],
        barColors:['#008cff', '#15ca20', '#75808a'],
        hideHover: 'auto',
        gridLineColor: '#eef0f2',
        resize: true
    });
    
// Extra chart
 Morris.Area({
        element: 'morris-chart-4',
        data: [{
                    period: '2010',
                    iphone: 10,
                    ipad: 20
                }, {
                    period: '2011',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2012',
                    iphone: 50,
                    ipad: 40
                }, {
                    period: '2013',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2014',
                    iphone: 50,
                    ipad: 40
                }, {
                    period: '2015',
                    iphone: 75,
                    ipad: 65
                }, {
                    period: '2016',
                    iphone: 90,
                    ipad: 75
                }


                ],
                lineColors: ['#008cff', '#15ca20'],
                xkey: 'period',
                ykeys: ['iphone', 'ipad'],
                labels: ['Site A', 'Site B'],
                pointSize: 0,
                lineWidth: 0,
                resize:true,
                fillOpacity: 0.7,
                behaveLikeLine: true,
                gridLineColor: '#e0e0e0',
                hideHover: 'auto'
        
    });
	
	
	
	
 });    