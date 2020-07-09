'use strict';

var Chart = require('chart.js');
var data = [15, 10000, 1000, 500, 700];
var currentTime = 0;
var sinRad = 0;
var chartLenght = 50;
var ampl = [1, 0.5, 2, 0.7, 1.2];

TABS.charts = {};
TABS.charts.initialize = function (callback) {
    var self = this;
    
    if (GUI.active_tab != 'charts') {
        GUI.active_tab = 'charts';
    }
    
    $('#content').load("./tabs/charts.html", function () {
        // translate to user-selected language
        i18n.localizePage();
        //var data = [12, 15, 28, 30];

        var ctx = document.getElementById('myChart').getContext('2d');
        var lineChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [0],
              datasets: [{ 
                  data: [0],
                  label: "sin 1",
                  borderColor: "#3e95cd",
                  fill: false
                }, { 
                  data: [0],
                  label: "sin 2",
                  borderColor: "#8e5ea2",
                  fill: false
                }, { 
                  data: [0],
                  label: "sin 3",
                  borderColor: "#3cba9f",
                  fill: false
                }, { 
                  data: [0],
                  label: "sin 4",
                  borderColor: "#e8c3b9",
                  fill: false
                }, { 
                  data: [0],
                  label: "sin 5",
                  borderColor: "#c45850",
                  fill: false
                }
              ]
            },
            options: {
              title: {
                display: true,
                text: 'Chart number 1'
              }
            }
        });
        // for(let i = 0; i < 50; i++){
        //     AddDataChart(lineChart, "newData", data);
        // }

        // status data pulled via separate timer with static speed
        GUI.interval_add('ChartUpdate', function() {
            console.log("Interval");
            let i = 0;
            data = data.map(function(val){
                return Math.sin(sinRad + ampl[i]) * ampl[i++];
            });
            sinRad += 0.5;
            AddDataChart(lineChart, currentTime, data);
            console.log(lineChart.data.labels.length);
            if(lineChart.data.labels.length > chartLenght) {
                ShiftChart(lineChart);
            }
            currentTime++;
        }, 200, true);

        GUI.content_ready(callback);
    });

};

TABS.charts.cleanup = function (callback) {
    if (callback) callback();
};

function AddDataChart(chart, label, data) {
    let i = 0;
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset) => {
        dataset.data.push(data[i]);
        i++;
    });
    chart.update();
}
// Remove first element from chart
function ShiftChart(chart) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
        dataset.data.shift();
    });
    chart.update();
}
