'use strict';

TABS.firmware_flasher = {};

TABS.firmware_flasher.initialize = function(callback) {
    var self = this;

    if (GUI.active_tab != 'firmware_flasher') {
        GUI.active_tab = 'firmware_flasher';
    }

    var intel_hex = false, // standard intel hex in string format
        parsed_hex = false; // parsed raw hex in array format

    $('#content').load("./tabs/firmware_flasher.html", function() {
        // translate to user-selected language
        i18n.localizePage();

        // UI Hooks
        $('a.load_file').click(function() {
            $('.progress').val(0);
            chrome.fileSystem.chooseEntry({ type : 'openFile', accepts : [ { description : 'HEX files', extensions : [ 'hex' ] } ] }, function(fileEntry) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);

                    return;
                }

                chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
                    console.log('Loading file from: ' + path);

                    fileEntry.file(function(file) {
                        var reader = new FileReader();

                        reader.onprogress = function(e) {
                            if (e.total > 2097152) { // 2 MB
                                // dont allow reading files bigger then 2 MB
                                console.log('File limit (2 MB) exceeded, aborting');
                                reader.abort();
                            }
                        };

                        reader.onloadend = function(e) {
                            if (e.total != 0 && e.total == e.loaded) {
                                console.log('File loaded');

                                intel_hex = e.target.result;

                                Intel_hex_parser(intel_hex, function(data) {
                                    parsed_hex = data;

                                    if (parsed_hex) {
                                        $('a.flash_firmware').removeClass('disabled');

                                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFirmwareLocalLoaded', parsed_hex.bytes_total));
                                    } else {
                                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherHexCorrupted'));
                                    }
                                });
                            }
                        };
                        reader.readAsText(file);
                    });
                });
            });
        });

        $('a.flash_firmware').click(function() {
            if (!$(this).hasClass('disabled')) {
                if (!GUI.connect_lock) { // button disabled while flashing is in progress
                    if (parsed_hex != false) {
                        $(this).addClass('disabled');

                        writeFirmware(parsed_hex);
                    } else {
                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFirmwareNotLoaded'));
                    }
                }
            }
        });

        $(document).on('click', 'span.progressLabel a.save_firmware', function() {
            var summary = $('select[name="firmware_version"] option:selected').data('summary');
            chrome.fileSystem.chooseEntry({ type : 'saveFile', suggestedName : summary.file, accepts : [ { description : 'HEX files', extensions : [ 'hex' ] } ] }, function(fileEntry) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    return;
                }

                chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
                    console.log('Saving firmware to: ' + path);

                    // check if file is writable
                    chrome.fileSystem.isWritableEntry(fileEntry, function(isWritable) {
                        if (isWritable) {
                            var blob = new Blob([ intel_hex ], { type : 'text/plain' });

                            fileEntry.createWriter(function(writer) {
                                var truncated = false;

                                writer.onerror = function (e) {
                                    console.error(e);
                                };

                                writer.onwriteend = function() {
                                    if (!truncated) {
                                        // onwriteend will be fired again when truncation is finished
                                        truncated = true;
                                        writer.truncate(blob.size);

                                        return;
                                    }
                                };

                                writer.write(blob); }, function(e) { console.error(e); });
                        } else {
                            console.log('You don\'t have write permissions for this file, sorry.');
                            GUI.log(i18n.getMessage('firmwareFlasherWritePermissions'));
                        }
                    });
                });
            });
        });

        $(document).keypress(function(e) {
            if (e.which == 13) { // enter
                // Trigger regular Flashing sequence
                $('a.flash_firmware').click();
            }
        });

        GUI.content_ready(callback);
    });
};

TABS.firmware_flasher.cleanup = function(callback) {
    //PortHandler.flush_callbacks();

    // unbind "global" events
    $(document).unbind('keypress');
    $(document).off('click', 'span.progressLabel a');

    if (callback)
        callback();
};

// input = string
// result = if hex file is valid, result is an object
//          if hex file wasn't valid (crc check failed on any of the lines), result will be false
function Intel_hex_parser(data, callback)
{
    data = data.split("\n");

    // check if there is an empty line in the end of hex file, if there is, remove it
    if (data[data.length - 1] == "") {
        data.pop();
    }

    var hexfile_valid = true; // if any of the crc checks failed, this variable flips to false
    var crc32 = 0xFFFFFFFF;

    var result = {
        data : [],
        end_of_file : false,
        bytes_total : 0,
        start_linear_address : 0,
        crc : 0
    };

    var extended_linear_address = 0;
    var next_address = 0;

    for (var i = 0; i < data.length && hexfile_valid; i++) {
        // each byte is represnted by two chars
        var byte_count = parseInt(data[i].substr(1, 2), 16);
        var address = parseInt(data[i].substr(3, 4), 16);
        var record_type = parseInt(data[i].substr(7, 2), 16);
        var content = data[i].substr(9, byte_count * 2); // still in string format
        var checksum = parseInt(data[i].substr(9 + byte_count * 2, 2), 16); // (this is a 2's complement value)

        switch (record_type) {
        case 0x00: // data record
            //if (address != next_address || next_address == 0) {
            result.data.push({ 'address' : extended_linear_address + address, 'bytes' : 0, 'data' : [] });
            //}

            // store address for next comparison
            //next_address = address + byte_count;

            // process data
            var crc = byte_count + parseInt(data[i].substr(3, 2), 16) + parseInt(data[i].substr(5, 2), 16) + record_type;
            for (var needle = 0; needle < byte_count * 2; needle += 2) { // * 2 because of 2 hex chars per 1 byte
                var num = parseInt(content.substr(needle, 2), 16); // get one byte in hex and convert it to decimal
                var data_block = result.data.length - 1;

                result.data[data_block].data.push(num);
                result.data[data_block].bytes++;

                crc += num;
                result.bytes_total++;
            }

            // change crc to 2's complement
            crc = (~crc + 1) & 0xFF;

            // verify
            if (crc != checksum) {
                hexfile_valid = false;
            }
            break;
        case 0x01: // end of file record
            result.end_of_file = true;
            break;
        case 0x02: // extended segment address record
            // not implemented
            if (parseInt(content, 16) != 0) { // ignore if segment is 0
                console.log('extended segment address record found - NOT IMPLEMENTED !!!');
            }
            break;
        case 0x03: // start segment address record
            // not implemented
            if (parseInt(content, 16) != 0) { // ignore if segment is 0
                console.log('start segment address record found - NOT IMPLEMENTED !!!');
            }
            break;
        case 0x04: // extended linear address record
            extended_linear_address = (parseInt(content.substr(0, 2), 16) << 24) | parseInt(content.substr(2, 2), 16) << 16;
            break;
        case 0x05: // start linear address record
            result.start_linear_address = parseInt(content, 16)
            break;
        }
    }

    if (result.end_of_file && hexfile_valid) {
        for (let i = 0; i < result.data.length; i++)
        {
            crc32 = CRC32_Enp(result.data[i].data, crc32);
        }
        console.log("Firmware CRC: " + crc32);
        result.crc = crc32;
        callback(result);
    } else {
        callback(false);
    }
}

function flasherSetProgress(value)
{
    $('.progress').val(value);
}

function flasherFirmwareWritten()
{
    $('.progress').val(100);
    $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWritten'));
}

function flasherFirmwareViewError(code)
{
    switch (code) {
    case FWCode.RET_NOT_SUPPURTED:
        console.log("RET_NOT_SUPPURTED")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherNotSupported'));
        break;
    case FWCode.RET_SEQUENCE_ERROR:
        console.log("RET_SEQUENCE_ERROR")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWriteError'));
        break;
    case FWCode.RET_HW_ERROR:
        console.log("RET_HW_ERROR")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWriteError'));
        break;
    case FWCode.RET_INVALID_PROG_BASE:
        console.log("RET_INVALID_PROG_BASE")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherInvalidHex'));
        break;
    case FWCode.RET_UNINITED:
        console.log("RET_UNINITED")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWriteError'));
        break;
    case FWCode.RET_ADDRESS_ERROR:
        console.log("RET_ADDRESS_ERROR")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWriteError'));
        break;
    case FWCode.RET_CRC_ERROR:
        console.log("RET_CRC_ERROR")
        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherWriteError'));
        break;
    }
}
