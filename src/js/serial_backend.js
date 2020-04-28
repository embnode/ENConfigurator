'use strict';
var enpHelper;

var connectionTimestamp;

function initializeSerialBackend() {
    GUI.updateManualPortVisibility = function() {
        var selected_port = $('div#port-picker #port option:selected');
        if (selected_port.data().isManual) {
            $('#port-override-option').show();
        } else {
            $('#port-override-option').hide();
        }
        if (selected_port.data().isDFU) {
            $('select#baud').hide();
        } else {
            $('select#baud').show();
        }
    };

    GUI.updateManualPortVisibility();

    $('#port-override').change(function() {
        chrome.storage.local.set({ 'portOverride': $('#port-override').val() });
    });

    chrome.storage.local.get('portOverride', function(data) {
        $('#port-override').val(data.portOverride);
    });

    $('div#port-picker #port').change(function(target) {
        GUI.updateManualPortVisibility();
    });

    $('div.connect_controls a.connect').click(function() {
        if (GUI.connect_lock != true) { // GUI control overrides the user control

            var thisElement = $(this);
            var clicks = thisElement.data('clicks');

            var toggleStatus = function() {
                thisElement.data('clicks', !clicks);
            };

            GUI.configuration_loaded = false;

            var selected_baud = parseInt($('div#port-picker #baud').val());
            var selected_port = $('div#port-picker #port option:selected').data().isManual ? $('#port-override').val() : String($('div#port-picker #port').val());
            if (selected_port === 'DFU') {
                GUI.log(i18n.getMessage('dfu_connect_message'));
            } else if (selected_port != '0') {
                if (!clicks) {
                    console.log('Connecting to: ' + selected_port);
                    GUI.connecting_to = selected_port;

                    // lock port select & baud while we are connecting / connected
                    $('div#port-picker #port, div#port-picker #baud, div#port-picker #delay')
                        .prop('disabled', true);
                    $('div.connect_controls a.connect_state')
                        .text(i18n.getMessage('connecting'));

                    serial.connect(selected_port, { bitrate: selected_baud }, onOpen);

                    toggleStatus();
                } else {
                    if ($('div#flashbutton a.flash_state').hasClass('active') && $('div#flashbutton a.flash').hasClass('active')) {
                        $('div#flashbutton a.flash_state').removeClass('active');
                        $('div#flashbutton a.flash').removeClass('active');
                    }
                    GUI.timeout_kill_all();
                    GUI.interval_kill_all();
                    GUI.tab_switch_cleanup();
                    GUI.tab_switch_in_progress = false;

                    finishClose(toggleStatus);
                }
            }
        }
    });

    // auto-connect
    chrome.storage.local.get('auto_connect', function(result) {
        if (result.auto_connect === 'undefined' || result.auto_connect) {
            // default or enabled by user
            GUI.auto_connect = true;

            $('input.auto_connect').prop('checked', true);
            $('input.auto_connect, span.auto_connect')
                .prop('title', i18n.getMessage('autoConnectEnabled'));

            $('select#baud').val(115200).prop('disabled', true);
        } else {
            // disabled by user
            GUI.auto_connect = false;

            $('input.auto_connect').prop('checked', false);
            $('input.auto_connect, span.auto_connect')
                .prop('title', i18n.getMessage('autoConnectDisabled'));
        }

        // bind UI hook to auto-connect checkbos
        $('input.auto_connect').change(function() {
            GUI.auto_connect = $(this).is(':checked');

            // update title/tooltip
            if (GUI.auto_connect) {
                $('input.auto_connect, span.auto_connect')
                    .prop('title', i18n.getMessage('autoConnectEnabled'));

                $('select#baud').val(115200).prop('disabled', true);
            } else {
                $('input.auto_connect, span.auto_connect')
                    .prop('title', i18n.getMessage('autoConnectDisabled'));

                if (!GUI.connected_to && !GUI.connecting_to)
                    $('select#baud').prop('disabled', false);
            }

            chrome.storage.local.set({ 'auto_connect': GUI.auto_connect });
        });
    });

    PortHandler.initialize();
    PortUsage.initialize();
}

function finishClose(finishedCallback) {
    var wasConnected = CONFIGURATOR.connectionValid;

    serial.disconnect(onClosed);

    ENP.disconnect_cleanup();
    PortUsage.reset();

    GUI.connected_to = false;
    GUI.allowedTabs = GUI.defaultAllowedTabsWhenDisconnected.slice();
    // Reset various UI elements
    if (semver.gte(CONFIG.apiVersion, '1.20.0'))
        $('span.cpu-load').text('');

    // unlock port select & baud
    $('div#port-picker #port').prop('disabled', false);
    if (!GUI.auto_connect)
        $('div#port-picker #baud').prop('disabled', false);

    // reset connect / disconnect button
    $('div.connect_controls a.connect').removeClass('active');
    $('div.connect_controls a.connect_state').text(i18n.getMessage('connect'));

    // reset active sensor indicators
    // sensor_status(0);

    if (wasConnected) {
        // detach listeners and remove element data
        $('#content').empty();
    }

    $('#tabs .tab_landing a').click();

    finishedCallback();
}

function onOpen(openInfo) {
    if (openInfo) {
        // update connected_to
        GUI.connected_to = GUI.connecting_to;

        // reset connecting_to
        GUI.connecting_to = false;

        GUI.log(i18n.getMessage('serialPortOpened', [openInfo.connectionId]));

        // show loading progress bar
        $('.mainProgress').val(0);
        $('#mainProgressBar').show();

        // save selected port with chrome.storage if the port differs
        chrome.storage.local.get('last_used_port', function(result) {
            if (result.last_used_port) {
                if (result.last_used_port != GUI.connected_to) {
                    // last used port doesn't match the one found in local db, we will
                    // store the new one
                    chrome.storage.local.set({ 'last_used_port': GUI.connected_to });
                }
            } else {
                // variable isn't stored yet, saving
                chrome.storage.local.set({ 'last_used_port': GUI.connected_to });
            }
        });

        serial.onReceive.addListener(read_serial);

        // disconnect after 10 seconds with error if we don't get IDENT data
        GUI.timeout_add('connecting', function() {
            if (!CONFIGURATOR.connectionValid) {
                GUI.log(i18n.getMessage('noConfigurationReceived'));

                $('div.connect_controls a.connect').click(); // disconnect
                $('#mainProgressBar').hide();
            }
        }, 100000);

        FC.resetState();
        ENP.listen(update_packet_error);
        enpHelper = new EnpHelper();
        ENP.listen(enpHelper.process_data.bind(EnpHelper));

        // request configuration data
        var idFieldValue = $('#enpDeviceID').val();
        // save selected device id with chrome.storage if the id differs
        chrome.storage.local.get('last_used_id', function(result) {
            if (result.last_used_id) {
                if (result.last_used_id != idFieldValue) {
                    // store the new one
                    chrome.storage.local.set({ 'last_used_id': idFieldValue });
                }
            } else {
                // variable isn't stored yet, saving
                chrome.storage.local.set({ 'last_used_id': idFieldValue });
            }
        });
        deviceID = parseInt(idFieldValue);
        GUI.log('Load device id: ' + deviceID);
        ENP.send_message(deviceID, ENPCodes.ENP_CMD_GETNODENUM, false, false, function() {
            GUI.log('Number nodes: ' + nodesNumber);
            loadEnpConfig();
        });
    } else {
        console.log('Failed to open serial port');
        GUI.log(i18n.getMessage('serialPortOpenFail'));

        $('div#connectbutton a.connect_state').text(i18n.getMessage('connect'));
        $('div#connectbutton a.connect').removeClass('active');


        // unlock port select & baud
        $('div#port-picker #port, div#port-picker #baud, div#port-picker #delay')
            .prop('disabled', false);

        // reset data
        $('div#connectbutton a.connect').data('clicks', false);
    }
}

function finishOpen() {
    CONFIGURATOR.connectionValid = true;
    GUI.allowedTabs = GUI.defaultAllowedFCTabsWhenConnected.slice();

    GUI.selectDefaultTabWhenConnected();
    onConnect();
}

function onConnect() {
    if ($('div#flashbutton a.flash_state').hasClass('active') && $('div#flashbutton a.flash').hasClass('active')) {
        $('div#flashbutton a.flash_state').removeClass('active');
        $('div#flashbutton a.flash').removeClass('active');
    }
    GUI.timeout_remove('connecting'); // kill connecting timer
    $('div#connectbutton a.connect_state')
        .text(i18n.getMessage('disconnect'))
        .addClass('active');
    $('div#connectbutton a.connect').addClass('active');

    $('#tabs ul.mode-disconnected').hide();
    $('#tabs ul.mode-connected').show();

    // show only appropriate tabs
    $('#tabs ul.mode-connected li').hide();
    $('#tabs ul.mode-connected li')
        .filter(function(index) {
            var classes = $(this).attr('class').split(/\s+/);
            var found = false;
            $.each(GUI.allowedTabs, function(index, value) {
                var tabName = 'tab_' + value;
                if ($.inArray(tabName, classes) >= 0) {
                    found = true;
                }
            });

            if (CONFIG.boardType == 0) {
                if (classes.indexOf('osd-required') >= 0) {
                    found = false;
                }
            }

            return found;
        })
        .show();

    // var sensor_state = $('#sensor-status');
    // sensor_state.show();

    var port_picker = $('#portsinput');
    port_picker.hide();

    // var dataflash = $('#dataflash_wrapper_global');
    // dataflash.show();
}

function onClosed(result) {
    if (result) { // All went as expected
        GUI.log(i18n.getMessage('serialPortClosedOk'));
    } else { // Something went wrong
        GUI.log(i18n.getMessage('serialPortClosedFail'));
    }

    $('#tabs ul.mode-connected').hide();
    $('#tabs ul.mode-connected-cli').hide();
    $('#tabs ul.mode-disconnected').show();
    $('#mainProgressBar').hide();

    updateStatusBarVersion();
    updateTopBarVersion();

    var sensor_state = $('#sensor-status');
    sensor_state.hide();

    var port_picker = $('#portsinput');
    port_picker.show();

    var dataflash = $('#dataflash_wrapper_global');
    dataflash.hide();

    var battery = $('#quad-status_wrapper');
    battery.hide();

    ENP.clearListeners();

    CONFIGURATOR.connectionValid = false;
    CONFIGURATOR.cliValid = false;
    CONFIGURATOR.cliActive = false;

    clearNodesConfig();
}

function read_serial(info) {
    if (!CONFIGURATOR.cliActive) {
        ENP.read(info);
    } else if (CONFIGURATOR.cliActive) {
        TABS.cli.read(info);
    }
}

function update_dataflash_global() {
    var supportsDataflash = DATAFLASH.totalSize > 0;
    if (supportsDataflash) {
        $('.noflash_global').css({ display: 'none' });

        $('.dataflash-contents_global').css({ display: 'block' });

        $('.dataflash-free_global').css({
            width: (100 - (DATAFLASH.totalSize - DATAFLASH.usedSize) / DATAFLASH.totalSize * 100) + '%',
            display: 'block'
        });
        $('.dataflash-free_global div')
            .text(
                'Dataflash: free ' + formatFilesize(DATAFLASH.totalSize - DATAFLASH.usedSize));
    } else {
        $('.noflash_global').css({ display: 'block' });

        $('.dataflash-contents_global').css({ display: 'none' });
    }
}

function startLiveDataRefreshTimer() {
    // live data refresh
    GUI.timeout_add('data_refresh', function() {
        update_live_status();
    }, 100);
}

function update_live_status() {
    var statuswrapper = $('#quad-status_wrapper');

    $('.quad-status-contents').css({ display: 'inline-block' });

    var active = ((Date.now() - ANALOG.last_received_timestamp) < 300);

    for (var i = 0; i < AUX_CONFIG.length; i++) {
        if (AUX_CONFIG[i] == 'ARM') {
            if (bit_check(CONFIG.mode, i))
                $('.armedicon').css({
                    'background-image': 'url(images/icons/cf_icon_armed_active.svg)'
                });
            else
                $('.armedicon').css({
                    'background-image': 'url(images/icons/cf_icon_armed_grey.svg)'
                });
        }
        if (AUX_CONFIG[i] == 'FAILSAFE') {
            if (bit_check(CONFIG.mode, i))
                $('.failsafeicon').css({
                    'background-image': 'url(images/icons/cf_icon_failsafe_active.svg)'
                });
            else
                $('.failsafeicon').css({
                    'background-image': 'url(images/icons/cf_icon_failsafe_grey.svg)'
                });
        }
    }
    if (ANALOG != undefined) {
        var nbCells = Math.floor(ANALOG.voltage / BATTERY_CONFIG.vbatmaxcellvoltage) + 1;
        if (ANALOG.voltage == 0)
            nbCells = 1;

        var min = BATTERY_CONFIG.vbatmincellvoltage * nbCells;
        var max = BATTERY_CONFIG.vbatmaxcellvoltage * nbCells;
        var warn = BATTERY_CONFIG.vbatwarningcellvoltage * nbCells;

        $('.battery-status').css({
            width: ((ANALOG.voltage - min) / (max - min) * 100) + '%',
            display: 'inline-block'
        });

        if (active) {
            $('.linkicon').css({
                'background-image': 'url(images/icons/cf_icon_link_active.svg)'
            });
        } else {
            $('.linkicon').css({
                'background-image': 'url(images/icons/cf_icon_link_grey.svg)'
            });
        }

        if (ANALOG.voltage < warn) {
            $('.battery-status').css('background-color', '#D42133');
        } else {
            $('.battery-status').css('background-color', '#59AA29');
        }

        $('.battery-legend').text(ANALOG.voltage + ' V');
    }

    statuswrapper.show();
    GUI.timeout_remove('data_refresh');
    startLiveDataRefreshTimer();
}

function specificByte(num, pos) {
    return 0x000000FF & (num >> (8 * pos));
}

function bit_check(num, bit) {
    return ((num >> bit) % 2 != 0);
}

function bit_set(num, bit) {
    return num | 1 << bit;
}

function bit_clear(num, bit) {
    return num & ~(1 << bit);
}

function update_dataflash_global() {
    function formatFilesize(bytes) {
        if (bytes < 1024) {
            return bytes + 'B';
        }
        var kilobytes = bytes / 1024;

        if (kilobytes < 1024) {
            return Math.round(kilobytes) + 'kB';
        }

        var megabytes = kilobytes / 1024;

        return megabytes.toFixed(1) + 'MB';
    }

    var supportsDataflash = DATAFLASH.totalSize > 0;

    if (supportsDataflash) {
        $('.noflash_global').css({ display: 'none' });

        $('.dataflash-contents_global').css({ display: 'block' });

        $('.dataflash-free_global').css({
            width: (100 - (DATAFLASH.totalSize - DATAFLASH.usedSize) / DATAFLASH.totalSize * 100) + '%',
            display: 'block'
        });
        $('.dataflash-free_global div')
            .text(
                'Dataflash: free ' + formatFilesize(DATAFLASH.totalSize - DATAFLASH.usedSize));
    } else {
        $('.noflash_global').css({ display: 'block' });

        $('.dataflash-contents_global').css({ display: 'none' });
    }
}