'use strict';

var Chart = require('chart.js');

TABS.charts = {};
TABS.charts.initialize = function (callback) {
    var self = this;
    
    if (GUI.active_tab != 'charts') {
        GUI.active_tab = 'charts';
    }
    
    $('#content').load("./tabs/charts.html", function () {
        // translate to user-selected language
        i18n.localizePage();

        var ctx = document.getElementById('myChart').getContext('2d');
        // var myLineChart = new Chart(ctx, {
        //     type: 'line',
        //     data: [10, 20],
        //     options: {
        //         scales: {
        //             yAxes: [{
        //                 stacked: true
        //             }]
        //         }
        //     }
        // });
var myChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                }
            }]
        }
    }
});

        GUI.content_ready(callback);
    });

};

TABS.charts.cleanup = function (callback) {
    if (callback) callback();
};
