'use strict';

var nodes = [];
var nodevars = [];
var configLoaderInfo = [];
var nodesNumber;
var nodesMaxIndex = 0;
var currentNodeId = 0;

var currentNode = 0;
var currentValueNumber = 0;
var currentVariable = 0;

var deviceID = 2;
const NUMBER_READ_VALUE = 5;
var setValueInfo = {};
var sendFlag = 0;
var newNodeValue = 0;
var hexFirmware = false;
var chunkNumber = 0;
let verifyChunkNumber = 0;
var NumberOfchunks = 0;
var retSeq = -1;
var stopFirmwareWrite = false;
let eraseState = 0;
let eraseCurrAddr = 0;
let isEraseComplete = true;
const PROGRESS_LENGHT = 100;

function EnpHelper()
{
    var self = this;
}

EnpHelper.prototype.process_data = function(dataHandler) {
    var self = this;

    var data = dataHandler.dataView; // DataView (allowing us to view arrayBuffer
        // as struct/union)
    var code = dataHandler.code;
    if (code === 0) {
        debugger;
    }
    var crcError = dataHandler.crcError;
    if (!crcError) {
        if (!dataHandler.unsupported)
            switch (code) {
            case ENPCodes.ENP_CMD_GETNODENUM:
                nodesNumber = data.readU16();
                break;
            case ENPCodes.ENP_CMD_GETNODEDESCR:
                var nod = {};
                nod.number = data.readU16(); // number of node
                nod.id = data.readU16(); // node id
                nod.pid = data.readU16(); // parent node id
                nod.numberOfVar = data.readU16(); // number of variable
                var buff = new Uint8Array(
                    dataHandler.message_buffer, 0 + 8,
                    dataHandler.message_length_received - 8);
                var enc = new TextDecoder('utf-8');
                nod.name = enc.decode(buff);
                nod.vars = [];
                nodes.push(nod);
                nodesMaxIndex++;
                GUI.log('node: ' + nod.name);
                break;
            case ENPCodes.ENP_CMD_GETVARDESCR:
                var nameOffset = 6;
                var variable = {};
                variable.id = data.readU16(); // node id
                variable.number = data.readU16(); // number of variable
                variable.prop = data.readU16(); // properties of variable
                var enc = new TextDecoder('utf-8');
                var buff = new Uint8Array(
                    dataHandler.message_buffer, 0 + nameOffset,
                    dataHandler.message_length_received - nameOffset);
                variable.name = enc.decode(buff);
                var index = findNodeById(variable.id);
                nodes[index].vars.push(variable);
                GUI.log('variable: ' + variable.name);
                break;
            case ENPCodes.ENP_CMD_GETVARS:
                var gettedVars = {};
                var index = findNodeById(data.readU16()); // node id
                gettedVars.firstVarNum = data.readU16(); // number of first variable
                gettedVars.numOfVars = data.readU16(); // number of variables
                for (let i = 0; i < gettedVars.numOfVars; i++) {
                    let value;
                    let varIndex = gettedVars.firstVarNum + i;
                    switch (nodes[index].vars[varIndex].prop & ENPType.MASK) {
                    case ENPType.INT:
                        value = data.read32();
                        break;
                    case ENPType.UINT:
                        value = data.readU32();
                        break;
                    case ENPType.BOOL:
                        value = data.readU32() > 0 ? 'true' : 'false';
                        break;
                    case ENPType.REAL:
                        value = data.readFloat32();
                        break;
                    case ENPType.HEX:
                        value = '0x' + data.readU32().toString(16);
                        break;
                    case ENPType.CHAR4:
                        // TODO char 4
                        value = data.readU32().toString(16);
                        break;
                    case ENPType.TIME:
                        var milliseconds = data.readU32();
                        var sec_num = milliseconds / 1000;
                        var hours = Math.floor(sec_num / 3600);
                        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
                        var seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));
                        if (hours < 10) {
                            hours = '0' + hours;
                        }
                        if (minutes < 10) {
                            minutes = '0' + minutes;
                        }
                        if (seconds < 10) {
                            seconds = '0' + seconds;
                        }
                        value = hours + ':' + minutes + ':' + seconds;
                        break;
                    default:
                        value = 'unknown'
                        break;
                    }
                    nodes[index].vars[varIndex].value = value;
                }
                newNodeValue = 1;
                break;
            case ENPCodes.ENP_CMD_SETVARS:
                console.log('set variable');
                var settedVars = {};
                settedVars.nodeId = data.readU16(); // node id
                settedVars.firstVarNum = data.readU16(); // number of first variable
                settedVars.numOfVars = data.readU16(); // number of variables
                console.log(settedVars);
                break;
            case ENPCodes.ENP_CMD_WRITE_FIRMWARE:
                retSeq = data.read32();
                firmwareError(retSeq);
                break;
            case ENPCodes.ENP_CMD_ERASE_FIRMWARE:
                eraseState = data.read32();
                if(eraseState == 0) {
                    isEraseComplete = true;
                }
                eraseCurrAddr = data.read32();
                let verfyStartAddr = hexFirmware.data[0].address;
                let verfyEndAddr = hexFirmware.data[hexFirmware.data.length - 1].address;
                let progress = Math.floor(((eraseCurrAddr - verfyStartAddr) * 100) / (verfyEndAddr - verfyStartAddr));
                flasherSetProgress(progress);
                break;
            case ENPCodes.ENP_CMD_VERIFY_FIRMWARE:
                let verifyStartAddr = hexFirmware.data[0].address;
                let verifyEndAddr = hexFirmware.data[hexFirmware.data.length - 1].address;
                let verAddr = data.read32();
                let verBuff = new Uint8Array(data.buffer);
                // looking for a chank
                for(let i = 0; i < hexFirmware.data.length; i++){
                    if(hexFirmware.data[i].address == verAddr){
                        let chankBuff = new Uint8Array(hexFirmware.data[i].data);
                        let progress = Math.floor(((verAddr - verifyStartAddr) * 100) / (verifyEndAddr - verifyStartAddr));
                        flasherSetProgress(progress);
                        if(chankBuff.length == verBuff.length - 4){
                            for(let j = 0; j < chankBuff.length; j++) {
                                if(chankBuff[j] != verBuff[j + 4]){
                                    console.log('verify error. Data on Address:' +  verAddr);
                                    break;
                                }
                            }
                        } else {
                            console.log('verify error. Lenght on Address:' +  hexFirmware.data[verifyChunkNumber - 1].address);
                        }
                        break;
                    }
                }
                break;
            case ENPCodes.ENP_CMD_INIT_FIRMWARE:
                retSeq = data.read32();
                firmwareError(retSeq);
                console.log('Firmware write init');
                break;
            case ENPCodes.ENP_CMD_COMPLETE_FIRMWARE:
                retSeq = data.read32();
                firmwareError(retSeq);
                console.log('Firmware write complete');
                break;
            case ENPCodes.ENP_CMD_FILESYSTEM:
                if (canFs !== undefined) {
                    canFs.processResposnse(data);
                }
                break;
            default:
                if (code & 0x80) {
                    var errorCode = data.readU8();
                    switch (errorCode) {
                    case ENPErrorCodes.ENP_ERROR_NONE:
                        console.log('ENP_ERROR_NONE');
                        break; // no error
                    case ENPErrorCodes.ENP_ERROR_NODENUM:
                        console.log('ENP_ERROR_NODENUM');
                        break;
                    case ENPErrorCodes.ENP_ERROR_NODEID:
                        console.log('ENP_ERROR_NODEID');
                        break;
                    case ENPErrorCodes.ENP_ERROR_VARID:
                        console.log('ENP_ERROR_VARID');
                        break;
                    case ENPErrorCodes.ENP_ERROR_VARVAL:
                        console.log('ENP_ERROR_VARVAL');
                        break;
                    case ENPErrorCodes.ENP_ERROR_COMMAND:
                        stopFirmwareWrite = true;
                        console.log('ENP_ERROR_COMMAND');
                        break;
                    }
                } else {
                    console.log('unknown');
                }
                break;
            }
    }
    // trigger callbacks, cleanup/remove callback after trigger
    for (var i = dataHandler.callbacks.length - 1; i >= 0;
         i--) { // itterating in reverse because we use .splice which modifies
        // array length
        let codeWithError = dataHandler.callbacks[i].code & 0x80;
        if (dataHandler.callbacks[i].code == code || codeWithError == codeWithError) {
            // save callback reference
            var callback = dataHandler.callbacks[i].callback;
            var callbackOnError = dataHandler.callbacks[i].callbackOnError;

            // remove timeout
            clearInterval(dataHandler.callbacks[i].timer);

            // remove object from array
            dataHandler.callbacks.splice(i, 1);
            if (!crcError || callbackOnError) {
                // fire callback
                if (callback)
                    callback({
                        'command' : code,
                        'data' : data,
                        'length' : data.byteLength,
                        'crcError' : crcError
                    });
            }
        }
    }
}

function
loadEnpConfig() {
    // init config loader
    configLoaderInfo.step = ENPStep.INIT;
    configLoader();
}

function configLoader(){
    switch (configLoaderInfo.step) {
        case ENPStep.INIT:
            configLoaderInfo.currentNode = 0;
            configLoaderInfo.currVar = 0;
            configLoaderInfo.numberOfVariables = 0;
            loadNodeDescription(configLoaderInfo.currentNode, configLoader);
            configLoaderInfo.currVar = 0;
            configLoaderInfo.step = ENPStep.VARIABLE;
            $('.mainProgress').val(0);
            break;
        case ENPStep.DESCRIPTION:
            loadNodeDescription(configLoaderInfo.currentNode, configLoader);
            configLoaderInfo.step = ENPStep.VARIABLE;
            configLoaderInfo.currVar = 0;
            break;
        case ENPStep.VARIABLE:
            let currNode = configLoaderInfo.currentNode;
            if (nodes[currNode].numberOfVar != 0){
                loadVariableDescr(nodes[currNode].id, configLoaderInfo.currVar, configLoader);
            } else {
                configLoaderInfo.currentNode++;
                if(configLoaderInfo.currentNode >= nodesNumber){
                    configLoaderInfo.step = ENPStep.FINISH;
                    configLoader();
                } else {
                    loadNodeDescription(configLoaderInfo.currentNode, configLoader);
                    configLoaderInfo.step = ENPStep.VARIABLE;
                    configLoaderInfo.currVar = 0;
                    break;
                }
            }
            configLoaderInfo.currVar++;
            configLoaderInfo.progress = (configLoaderInfo.currentNode * PROGRESS_LENGHT) / nodesNumber;
            let varProgressLen = (PROGRESS_LENGHT / nodesNumber);
            let varProgress = (configLoaderInfo.currVar * varProgressLen) / nodes[currNode].numberOfVar;
            configLoaderInfo.progress += varProgress;
            $('.mainProgress').val(configLoaderInfo.progress);
            if (configLoaderInfo.currVar >= nodes[currNode].numberOfVar) {
                configLoaderInfo.step = ENPStep.DESCRIPTION;
                configLoaderInfo.currentNode++;
                if(configLoaderInfo.currentNode >= nodesNumber){
                    configLoaderInfo.step = ENPStep.FINISH;
                }
            }
            break;
        case ENPStep.FINISH:
            finishOpen();
            break;
    }
}

function loadNodeDescription(node, callback) {
    var bufferOut = new ArrayBuffer(2);
    var uint16Array = new Uint8Array(bufferOut);
    uint16Array[0] = node;
    var data = new Uint8Array(bufferOut);
    ENP.send_message(deviceID, ENPCodes.ENP_CMD_GETNODEDESCR, data, false, callback);
}

function loadVariableDescr(nodeId, currentVariable, callback) {
    var bufferOut = new ArrayBuffer(4);
    var uint16Array = new Uint16Array(bufferOut);
    uint16Array[0] = nodeId;
    uint16Array[1] = currentVariable;
    var uint8Array = new Uint8Array(bufferOut);
    ENP.send_message( deviceID, ENPCodes.ENP_CMD_GETVARDESCR, uint8Array, false, callback);
}

function loadValue(_currentNode, code) {
    if (_currentNode < nodesNumber) {
        var bufferOut = new ArrayBuffer(6);
        var uint16Array = new Uint16Array(bufferOut);
        // node ID
        uint16Array[0] = nodes[_currentNode].id;
        // number first var
        uint16Array[1] = currentValueNumber;
        // number vars
        var numberOfValue = nodes[_currentNode].numberOfVar - currentValueNumber;
        if (numberOfValue > NUMBER_READ_VALUE) {
            numberOfValue = NUMBER_READ_VALUE;
        }
        currentValueNumber += numberOfValue;
        uint16Array[2] = numberOfValue;
        var uint8Array = new Uint8Array(bufferOut);
        ENP.send_message(deviceID, ENPCodes.ENP_CMD_GETVARS, uint8Array, false, false);
        if (currentValueNumber >= nodes[_currentNode].numberOfVar) {
            currentValueNumber = 0;
            code();
        }
    }
}

function firmwareVerify(verChunkNumber) {
    if (verifyChunkNumber >= NumberOfchunks) {
        console.log('Verifed');
        flasherFirmwareWritten();
        return;
    }
    let verifyChunk = hexFirmware.data[verChunkNumber];
    var bufferOut = new ArrayBuffer(5);
    var uint8Array = new Uint8Array(bufferOut);
    uint8Array[0] = verifyChunk.address & 0xFF;
    uint8Array[1] = (verifyChunk.address >>> 8) & 0xFF;
    uint8Array[2] = (verifyChunk.address >>> 16) & 0xFF;
    uint8Array[3] = (verifyChunk.address >>> 24) & 0xFF;
    uint8Array[4] = verifyChunk.bytes; // len
    ENP.send_message(
        deviceID, ENPCodes.ENP_CMD_VERIFY_FIRMWARE, uint8Array, false, function(data) {
            verifyChunkNumber++;
            firmwareVerify(verifyChunkNumber);
        });
}

function sendChunk(seq) {
    if (stopFirmwareWrite == true) {
        return;
    }
    if (chunkNumber >= NumberOfchunks) {
        completeWriteFirmware();
        return;
    }
    var chunk = hexFirmware.data[chunkNumber];
    // payload + address
    var msgLen = chunk.bytes + 4 + 1;
    var bufferOut = new ArrayBuffer(msgLen);
    var uint8Array = new Uint8Array(bufferOut);
    uint8Array[0] = chunk.address & 0xFF;
    uint8Array[1] = (chunk.address >>> 8) & 0xFF;
    uint8Array[2] = (chunk.address >>> 16) & 0xFF;
    uint8Array[3] = (chunk.address >>> 24) & 0xFF;
    uint8Array[4] = chunkNumber & 0xFF; // sequencer
    for (let i = 0; i < chunk.bytes; i++) {
        uint8Array[i + 5] = chunk.data[i];
    }
    ENP.send_message(
        deviceID, ENPCodes.ENP_CMD_WRITE_FIRMWARE, uint8Array, false, function(data) {
            if (retSeq == (chunkNumber & 0xFF)) {
                chunkNumber++;
            }
            sendChunk(chunkNumber);
        });
    let progress = Math.floor((chunkNumber * 100) / NumberOfchunks);
    flasherSetProgress(progress);
}

function GetEraseState() {
    var bufferOut = new ArrayBuffer(12);
    var uint8Array = new Uint8Array(bufferOut);

    if (isEraseComplete) {
        console.log('Erased');
        flasherSetProgressText(i18n.getMessage('firmwareFlasherProgramming'))
        let startChunk = hexFirmware.data[0];
        uint8Array[0] = startChunk.address & 0xFF;
        uint8Array[1] = (startChunk.address >>> 8) & 0xFF;
        uint8Array[2] = (startChunk.address >>> 16) & 0xFF;
        uint8Array[3] = (startChunk.address >>> 24) & 0xFF;
        stopFirmwareWrite = false;
        ENP.send_message(
            deviceID, ENPCodes.ENP_CMD_INIT_FIRMWARE, uint8Array, false, function(data) {
                sendChunk(0);
            });
    } else {        
        ENP.send_message(
            deviceID, ENPCodes.ENP_CMD_ERASE_FIRMWARE, uint8Array, false, function(data) {
                GetEraseState();
            });
    }
}

function writeFirmware(parsed_hex) {
    hexFirmware = parsed_hex;
    let totalLength = hexFirmware.bytes_total;
    chunkNumber = 0;
    NumberOfchunks = hexFirmware.data.length;
    let startChunk = hexFirmware.data[0];
    let stopChunk = hexFirmware.data[hexFirmware.data.length - 1];
    
    eraseCurrAddr = startChunk.address;
    let command = 1;
    var bufferOut = new ArrayBuffer(12);
    var uint8Array = new Uint8Array(bufferOut);
    uint8Array[0] = command & 0xFF;
    uint8Array[1] = (command >>> 8) & 0xFF;
    uint8Array[2] = (command >>> 16) & 0xFF;
    uint8Array[3] = (command >>> 24) & 0xFF;
    
    uint8Array[4] = startChunk.address & 0xFF;
    uint8Array[5] = (startChunk.address >>> 8) & 0xFF;
    uint8Array[6] = (startChunk.address >>> 16) & 0xFF;
    uint8Array[7] = (startChunk.address >>> 24) & 0xFF;
    
    let stopAddress = stopChunk.address + stopChunk.data.length;
    uint8Array[8] = stopAddress & 0xFF;
    uint8Array[9] = (stopAddress >>> 8) & 0xFF;
    uint8Array[10] = (stopAddress >>> 16) & 0xFF;
    uint8Array[11] = (stopAddress >>> 24) & 0xFF;
    isEraseComplete = false;
    flasherSetProgressText(i18n.getMessage('firmwareFlasherErasing'))
    ENP.send_message(
        deviceID, ENPCodes.ENP_CMD_ERASE_FIRMWARE, uint8Array, false, function(data) {
            GetEraseState();
        });
    }

function completeWriteFirmware() {
    var bufferOut = new ArrayBuffer(1);
    var uint8Array = new Uint8Array(bufferOut);
    ENP.send_message(
        deviceID, ENPCodes.ENP_CMD_COMPLETE_FIRMWARE, uint8Array, false, function(){
            verifyChunkNumber = 0;
            firmwareVerify(verifyChunkNumber);
        });
    flasherSetProgressText(i18n.getMessage('firmwareFlasherVerify'))  
}

function setValue() {
    var bufferOut = new ArrayBuffer(10);
    var uint16Array = new Uint16Array(bufferOut);
    // node ID
    uint16Array[0] = setValueInfo.id;
    // number first var
    uint16Array[1] = setValueInfo.number;
    // number vars
    uint16Array[2] = 1;
    // value
    if (setValueInfo.type == ENPType.REAL) {
        var farr = new Float32Array(1);
        farr[0] = setValueInfo.value;
        var barr = new Uint16Array(farr.buffer);
        uint16Array[3] = barr[0];
        uint16Array[4] = barr[1];
    } else {
        uint16Array[3] = setValueInfo.value & 0xFFFF;
        uint16Array[4] = setValueInfo.value >> 16;
    }
    var uint8Array = new Uint8Array(bufferOut);
    ENP.send_message(deviceID, ENPCodes.ENP_CMD_SETVARS, uint8Array, false, false);
    console.log('sendValue');
}

// return index by node id
function findNodeById(id) {
    for (var i = 0; i < nodesNumber; i++) {
        if (nodes[i].id == id) {
            return i;
        }
    }
    return undefined;
}

function firmwareError(code) {
    if (code < 0) {
        // stop writing firmware
        stopFirmwareWrite = true;
        flasherFirmwareViewError(code);
    }
}