'use strict';

var Chart = require('chart.js');
var data = [15, 10000, 1000, 500, 700];
var currentTime = 0;
var sinRad = 0;
var chartLenght = 50;
var ampl = [1, 0.5, 2, 0.7, 1.2];
var chartList = [];
let currentVar = 0;
const CHART_REFRESH_MS = 200;

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
        var lineChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [],
              datasets: []
            },
            options: {
              title: {
                display: true,
                text: 'Chart number 1'
              }
            }
        });
        
        // add new charts from list
        chartList.forEach((chart) => {
          let newChar = {
            data: [],
            label: chart.name,
            borderColor: getRandomColor(),
            fill: false
          }
          lineChart.data.datasets.push(newChar);
        });

        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function() {
            if(chartList.length > 0) {
              let cv = currentVar;
              loadChartValue(chartList[cv].nodeId, chartList[cv].varNumber, function() {
                let i = chartList[cv].i;
                let j = chartList[cv].j;
                data[cv] = nodes[i].vars[j].value;
                currentVar++;
                if(currentVar >= chartList.length){
                  currentVar = 0;
                }
              });
            }
        }, 100, true);

        // status data pulled via separate timer with static speed
        GUI.interval_add('ChartUpdate', function() {
            // Test data. It would be nice to leave for the testes
            // let i = 0;
            // data = data.map(function(val){
            //     return Math.sin(sinRad + ampl[i]) * ampl[i++];
            // });
            // sinRad += 0.5;
            AddDataChart(lineChart, currentTime * CHART_REFRESH_MS / 1000, data);
            if(lineChart.data.labels.length > chartLenght) {
              ShiftChart(lineChart);
            }
            currentTime++;
            lineChart.update()
        }, CHART_REFRESH_MS, true);

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
}
// Remove first element from chart
function ShiftChart(chart) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
        dataset.data.shift();
    });
}

function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
