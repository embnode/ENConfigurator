'use strict';

var Analytics = function (trackingId, userId, appName, appVersion, changesetId, os, checkForDebugVersions, optOut, debugMode, buildType) {
    this._trackingId = trackingId;

    this.setOptOut(optOut);

    this._googleAnalytics = googleAnalytics;

    this._googleAnalytics.initialize(this._trackingId, {
        storage: 'none',
        clientId: userId,
        debug: !!debugMode
    });

    // Make it work for the Chrome App:
    this._googleAnalytics.set('forceSSL', true);
    this._googleAnalytics.set('transport', 'xhr');

    // Make it work for NW.js:
    this._googleAnalytics.set('checkProtocolTask', null);

    this._googleAnalytics.set('appName', appName);
    this._googleAnalytics.set('appVersion', debugMode ? appVersion + '-debug' : appVersion);

    this.EVENT_CATEGORIES = {
        APPLICATION: 'Application',
        FIRMWARE: 'Firmware',
    };

    this.DATA = {
        BOARD_TYPE: 'boardType',
        API_VERSION: 'apiVersion',
        FIRMWARE_TYPE: 'firmwareType',
        FIRMWARE_VERSION: 'firmwareVersion',
        FIRMWARE_NAME: 'firmwareName',
        FIRMWARE_CHECKSUM: 'firmwareChecksum',
        FIRMWARE_SOURCE: 'firmwareSource',
        FIRMWARE_CHANNEL: 'firmwareChannel',
        FIRMWARE_ERASE_ALL: 'firmwareEraseAll',
        FIRMWARE_SIZE: 'firmwareSize',
        MCU_ID: 'mcuId',
        LOGGING_STATUS: 'loggingStatus',
        LOG_SIZE: 'logSize',
        TARGET_NAME: 'targetName',
        BOARD_NAME: 'boardName',
        MANUFACTURER_ID: 'manufacturerId',
        MCU_TYPE: 'mcuType',
    };

    this.DIMENSIONS = {
        CONFIGURATOR_OS: 1,
        BOARD_TYPE: 2,
        FIRMWARE_TYPE: 3,
        FIRMWARE_VERSION: 4,
        API_VERSION: 5,
        FIRMWARE_NAME: 6,
        FIRMWARE_SOURCE: 7,
        FIRMWARE_ERASE_ALL: 8,
        CONFIGURATOR_EXPERT_MODE: 9,
        FIRMWARE_CHANNEL: 10,
        LOGGING_STATUS: 11,
        MCU_ID: 12,
        CONFIGURATOR_CHANGESET_ID: 13,
        CONFIGURATOR_USE_DEBUG_VERSIONS: 14,
        TARGET_NAME: 15,
        BOARD_NAME: 16,
        MANUFACTURER_ID: 17,
        MCU_TYPE: 18,
        CONFIGURATOR_BUILD_TYPE: 19,
    };

    this.METRICS = {
        FIRMWARE_SIZE: 1,
        LOG_SIZE: 2,
    };

    this.setDimension(this.DIMENSIONS.CONFIGURATOR_OS, os);
    this.setDimension(this.DIMENSIONS.CONFIGURATOR_CHANGESET_ID, changesetId);
    this.setDimension(this.DIMENSIONS.CONFIGURATOR_USE_DEBUG_VERSIONS, checkForDebugVersions);
    this.setDimension(this.DIMENSIONS.CONFIGURATOR_BUILD_TYPE, buildType);
};

Analytics.prototype.setDimension = function (dimension, value) {
    var dimensionName = 'dimension' + dimension;
    this._googleAnalytics.custom(dimensionName, value);
}

Analytics.prototype.setMetric = function (metric, value) {
    var metricName = 'metric' + metric;
    this._googleAnalytics.custom(metricName, value);
}

Analytics.prototype.sendEvent = function (category, action, options) {
    this._googleAnalytics.event(category, action, options);
}

Analytics.prototype.sendChangeEvents = function (category, changeList) {
    for (var actionName in changeList) {
        if (changeList.hasOwnProperty(actionName)) {
            var actionValue = changeList[actionName];
            if (actionValue !== undefined) {
                this.sendEvent(category, actionName, { eventLabel: actionValue });
            }
        }
    }
}

Analytics.prototype.sendAppView = function (viewName) {
    this._googleAnalytics.screenview(viewName);
}

Analytics.prototype.sendTiming = function (category, timing, value) {
    this._googleAnalytics.timing(category, timing, value);
}

Analytics.prototype.sendException = function (message) {
    this._googleAnalytics.exception(message);
}

Analytics.prototype.setOptOut = function (optOut) {
    window['ga-disable-' + this._trackingId] = !!optOut;
}
