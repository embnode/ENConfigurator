'use strict';

// define all the global variables that are uses to hold FC state
var CONFIG;

var FC = {
    resetState: function() {
        CONFIG = {
            apiVersion: "0.0.0",
            flightControllerIdentifier: '',
            flightControllerVersion: '',
            version: 0,
        };
    }
};