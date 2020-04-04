'use strict';
var currentValue = 0;
var previousValue = 0;
var minValue = 0;
var maxValue = 500;

class ProgressBar {
    constructor() {

        setInterval(this.timeCalc, 1000);
    }

    timeCalc() {
        let delta = currentValue - previousValue;

        if (maxValue > 40) {
            let sec = ((maxValue - currentValue) / delta) * 60;
            let date = new Date(null);
            date.setSeconds(sec); // specify value for SECONDS here
            // let timeString = date.toISOString().substr(11, 8);
            // $('#progressBar').html(timeString);
        }

        previousValue = currentValue;
    }

    setMinMax(min, max) {
        minValue = min;
        maxValue = max;
    }

    setValue(value) {
        let pbPxWidth = $('#progressBarBody').width();
        let pbValue = convertRange(value, [minValue, maxValue], [0, pbPxWidth]);
        // console.log(value + ':' + pbValue + ' mm' + this.maxValue);
        $('#progressBar').width(pbValue);
        currentValue = value;
    }

    setVisible(visible) {
        if (visible) {
            $('#progressBar').css("visibility", "visible");
        } else {
            $('#progressBar').css("visibility", "hidden");
        }
    }
}

function convertRange(value, r1, r2) {
    return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
}