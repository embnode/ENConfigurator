'use strict';

var enpBuffer = new Uint8Array(300);
var enpBufferIndex = 0;
var ENP = {
    state : 0,
    message_direction : 1,
    code : 0,
    dataView : 0,
    uint8Buffer : 0,
    id : 0,
    lenght : 0,
    message_length_expected : 0,
    message_length_received : 0,
    message_buffer : null,
    message_buffer_uint8_view : null,
    message_checksum : 0,
    crcError : false,
    crcErrorCount : 0,

    callbacks : [],
    packet_error : 0,
    unsupported : 0,

    last_received_timestamp : null,
    listeners : [],

    read : function(readInfo) {
        var data = new Uint8Array(readInfo.data);

        for (var i = 0; i < data.length; i++) {
            switch (this.state) {
            case 0: // sync char 1
                if (data[i] == 0xFA) {
                    this.state++;
                    enpBuffer[enpBufferIndex++] = data[i];
                }
                break;
            case 1: // sync char 2
                if (data[i] == 0xCE) {
                    this.state++;
                    enpBuffer[enpBufferIndex++] = data[i];
                } else { // restart and try again
                    this.state = 0;
                    enpBufferIndex = 0;
                }
                break;
            case 2: // id
                this.id = data[i];
                enpBuffer[enpBufferIndex++] = data[i];
                this.state++;
                break;
            case 3: // id
                this.id = (data[i] << 8) | this.id;
                enpBuffer[enpBufferIndex++] = data[i];
                this.state++;
                break;
            case 4: // lenght
                this.lenght = data[i];
                // setup arraybuffer
                this.message_buffer = new ArrayBuffer(this.lenght - 1); // minus code from lenght
                this.message_buffer_uint8_view = new Uint8Array(this.message_buffer);
                enpBuffer[enpBufferIndex++] = data[i];
                this.state++;
                break;
            case 5: // cmd
                this.code = data[i];
                enpBuffer[enpBufferIndex++] = data[i];
                this.state++;
                break;
            case 6: // payload
                this.message_buffer_uint8_view[this.message_length_received] = data[i];
                this.message_length_received++;
                enpBuffer[enpBufferIndex++] = data[i];
                // minus code from lenght
                if (this.message_length_received >= this.lenght - 1) {
                    this.state++;
                }
                break;
            case 7: // checksum
                enpBuffer[enpBufferIndex++] = data[i];
                this.state++;
                break;
            case 8: // checksum
                // calculate message crc
                enpBuffer[enpBufferIndex++] = data[i];
                var crc = CRC16_Enp(enpBuffer, enpBufferIndex - 2, 0xFFFF);
                this.message_checksum = (data[i] << 8) | data[i-1];
                if (crc == this.message_checksum) {
                    this.dataView = new DataView(
                        this.message_buffer, 0, this.message_length_received);
                    this.notify();
                    this.crcError = false;
                } else {
                    ENP.crcErrorCount++;
                    $('span.crc-error').text(ENP.crcErrorCount);
                    console.log(
                        'CRC failed. calced = ' + this.message_checksum + 'recived = ' + crc);
                }
                // Reset variables
                this.message_length_received = 0;
                this.state = 0;
                enpBufferIndex = 0;
                break;

            default:
                console.log('Unknown state detected: ' + this.state);
            }
        }
        this.last_received_timestamp = Date.now();
    },
    notify : function() {
        var self = this;
        this.listeners.forEach(function(listener) {
            listener(self);
        });
    },
    listen : function(listener) {
        if (this.listeners.indexOf(listener) == -1) {
            this.listeners.push(listener);
        }
    },
    clearListeners : function() {
        this.listeners = [];
    },
    send_message : function(
        id, code, data, callback_sent, callback_msp, callback_onerror) {
        if (code === undefined) {
            debugger;
        }
        var bufferOut, bufView;

        if (!callback_onerror) {
            var callbackOnError = false;
        } else {
            var callbackOnError = true;
        }
        // always reserve 8 bytes for protocol overhead !
        if (data) {
            var size = data.length + 8, checksum = 0;

            bufferOut = new ArrayBuffer(size);
            bufView = new Uint8Array(bufferOut);

            bufView[0] = 0xFA; //
            bufView[1] = 0xCE; //
            bufView[2] = id & 0xFF; //
            bufView[3] = id >>> 8; //
            bufView[4] = data.length + 1; // data length
            bufView[5] = code; // code

            for (var i = 0; i < data.length; i++) {
                bufView[i + 6] = data[i];
            }
            var crc = CRC16_Enp(bufView, data.length + 6, 0xFFFF);
            bufView[6 + data.length] = crc & 0xFF;
            bufView[7 + data.length] = crc >>> 8;
        } else {
            bufferOut = new ArrayBuffer(8);
            bufView = new Uint8Array(bufferOut);

            bufView[0] = 0xFA; //
            bufView[1] = 0xCE; //
            bufView[2] = id & 0xFF; //
            bufView[3] = id >>> 8; // data length
            bufView[4] = 1; // data length
            bufView[5] = code; // code

            var crc = CRC16_Enp(bufView, 6, 0xFFFF);
            bufView[6] = crc & 0xFF;
            bufView[7] = crc >>> 8;
        }

        var obj = {
            'code' : code,
            'requestBuffer' : bufferOut,
            'callback' : (callback_msp) ? callback_msp : false,
            'timer' : false,
            'callbackOnError' : callbackOnError
        };

        var requestExists = false;
        for (var i = 0; i < ENP.callbacks.length; i++) {
            if (ENP.callbacks[i].code == code) {
                // request already exist, we will just attach
                requestExists = true;
                break;
            }
        }

        if (!requestExists) {
            obj.timer = setInterval(function() {
                console.log('ENP data request timed-out: ' + code);

                serial.send(bufferOut, false);
            }, 1000); // we should be able to define timeout in the future
        }

        ENP.callbacks.push(obj);

        // always send messages with data payload (even when there is a message
        // already in the queue)
        if (data || !requestExists) {
            serial.send(bufferOut, function(sendInfo) {
                if (sendInfo.bytesSent == bufferOut.byteLength) {
                    if (callback_sent)
                        callback_sent();
                }
            });
        }

        return true;
    },
    /**
   * resolves: {command: code, data: data, length: message_length}
   */
    promise : function(code, data) {
        var self = this;
        return new Promise(function(resolve) {
            self.send_message(code, data, false, function(data) {
                resolve(data);
            });
        });
    },
    callbacks_cleanup : function() {
        for (var i = 0; i < this.callbacks.length; i++) {
            clearInterval(this.callbacks[i].timer);
        }

        this.callbacks = [];
    },
    disconnect_cleanup : function() {
        this.state = 0; // reset packet state for "clean" initial entry (this is
        // only required if user hot-disconnects)
        this.packet_error = 0; // reset CRC packet error counter for next session

        this.callbacks_cleanup();
    }
};