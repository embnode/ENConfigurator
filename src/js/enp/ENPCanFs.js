'use strict';

var CANFSCommandType_t = {
    CANFS_UNDEF : 0,
    CANFS_LS : 1,
    CANFS_CD : 2,
    CANFS_MKDIR : 3,
    CANFS_FOPEN : 4,
    CANFS_FLOAD : 5,
    CANFS_FCLOSE : 6,
    CANFS_FLOAD_BEGIN : 7,
    CANFS_DCLOSE : 8,
    CANFS_DNUM : 9,
};

const CANFS_FILE_CHUNK_SIZE = 250;

var cmdBuffer = [];
var canBusy = false;
var itemsToRead = 0;
var fileBuffer = undefined;
var fileIndex = 0;

class CANFSCommand {
    constructor(type)
    {
        if (type === undefined) {
            this.type = CANFSCommandType_t.CANFS_UNDEF;
        } else {
            this.type = type;
        }

        this.length = -1;
        this.payload = undefined;
    }

    /**
     * Sets command payload. Accepts strings and objects of Uint8Array
     * @param {*} payload 
     */
    setPayload(payload)
    {
        if (payload !== undefined && payload.length > 0) {

            if (typeof (payload) === "object") {
                this.payload = payload;
                this.length = payload.length;
            } else if (typeof (payload) === "string") {
                let enc = new TextEncoder();
                // let payloadBuffer = new ArrayBuffer(payload.length);
                let payloadArray = new Uint8Array(enc.encode(payload));
                this.payload = payloadArray;
                this.length = payload.length;
            } else {
                console.log('[CANFS] Invalid payload');
            }
        }
    }
}

class CANFS {
    constructor()
    {
        this.currentDir = undefined;
        this.currentDirIsOpened = false;
        this.currentFile = undefined;
        this.currentFileIsOpened = false;
        this.currentFile = undefined;
        canBusy = false;
        cmdBuffer = new Array();
        cmdBuffer.length = 0;

        setInterval(this.fifoSender, 15);
    }

    static addCommand(command)
    {
        if (command.type !== undefined && command.type !== CANFSCommandType_t.CANFS_UNDEF) {

            if (cmdBuffer == undefined) {
                cmdBuffer = new Array();
            }
            cmdBuffer.push(command);
        } else {
            console.log('[CANFS] Undefined command');
        }
    }

    static bufferConcat(first, second)
    {
        var firstLength = first.length,
            result = new Uint8Array(first.length + second.length);

        result.set(first);
        result.set(second, firstLength);

        return result;
    }

    // sendCommand(cmd)
    // {
    //     if (cmd.type !== undefined && cmd.type !== CANFSCommandType_t.CANFS_UNDEF) {
    //         canBusy = true;
    //         //enp send
    //         let bufferOut = new ArrayBuffer(cmd.length + 2);
    //         let outArray = new Uint8Array(bufferOut);
    //         outArray[0] = cmd.type;
    //         outArray[1] = cmd.length;

    //         if (cmd.length > 0 && typeof (cmd.payload) === "object") {
    //             for (let i = 0; i < cmd.length; i++) {
    //                 outArray[2 + i] = cmd.payload[i];
    //             }
    //             ENP.send_message(id, ENPCodes.ENP_CMD_FILESYSTEM, outArray, false, false);

    //             console.log('[CANFS] Command sent: ' + cmd.type);
    //         } else if (cmd.length == 0) {
    //             console.log('[CANFS] [DEVEL] zero command');
    //         } else {
    //             console.log('[CANFS] Malformed command');
    //         }

    //     } else {
    //         console.log('[CANFS] Undefined command');
    //     }
    // }

    processResposnse(data)
    {
        if (typeof (data) === "object") {
            let cmdId = data.read8();
            let cmdLen = data.read8();
            let cmdResponse;

            //debug
            // $('#fsDebug').html($('#fsDebug').html() + 'Command id: ' + cmdId + '<br/>');
            // $('#fsDebug').html($('#fsDebug').html() + 'Command size: ' + cmdLen + '<br/>');

            switch (cmdId) {
            case CANFSCommandType_t.CANFS_CD:
                cmdResponse = data.read8();

                if (cmdResponse) {
                    this.currentDirIsOpened = true;
                    // $('#fsDebug').html($('#fsDebug').html() + 'Directory \'' + this.currentDir + '\' opened<br/>');
                } else {
                    this.currentDir = undefined;
                    this.currentDirIsOpened = false;
                    // $('#fsDebug').html($('#fsDebug').html() + 'Unable to open directory<br/>');
                }
                break;
            case CANFSCommandType_t.CANFS_DCLOSE:
                cmdResponse = data.read8();

                if (cmdResponse) {
                    this.currentDirIsOpened = false;
                    // $('#fsDebug').html($('#fsDebug').html() + 'Directory \'' + this.currentDir + '\' closed<br/>');
                } else {
                    // $('#fsDebug').html($('#fsDebug').html() + 'Unable to close directory<br/>');
                }
                break;
            case CANFSCommandType_t.CANFS_FOPEN:
                cmdResponse = data.read8();

                if (cmdResponse) {
                    this.currentFileIsOpened = true;
                    // $('#fsDebug').html($('#fsDebug').html() + 'File \'' + this.currentFile + '\' opened<br/>');
                } else {
                    this.currentFile = undefined;
                    this.currentFileIsOpened = false;
                    // $('#fsDebug').html($('#fsDebug').html() + 'Unable to open file<br/>');
                }
                break;

            case CANFSCommandType_t.CANFS_FLOAD_BEGIN:
                let fSize = data.read32();
                let unused = data.read32();
                itemsToRead = Math.ceil(fSize / CANFS_FILE_CHUNK_SIZE);
                fileBuffer = new Uint8Array();
                fileIndex = 0;
                progressBar.setMinMax(0, itemsToRead);
                progressBar.setVisible(true);

                loadingShow(true);
                this.readFileChunk();

                break;
            case CANFSCommandType_t.CANFS_FLOAD:
                let uint8 = new Uint8Array(data.buffer, 2, data.buffer.byteLength - 3);
                let dec = new TextDecoder();
                let buffStr = dec.decode(uint8);

                fileBuffer = CANFS.bufferConcat(fileBuffer, uint8);
                // fileIndex += (cmdLen - 2);
                progressBar.setValue(fileIndex);
                fileIndex++;

                if (--itemsToRead <= 0) {

                    loadingShow(false);
                    saveFile();
                    // $('#fsDebug').html($('#fsDebug').html() + "file load done<br/>");
                }

                break;
            case CANFSCommandType_t.CANFS_FCLOSE:
                cmdResponse = data.read8();

                if (cmdResponse) {
                    this.currentFileIsOpened = false;
                    // $('#fsDebug').html($('#fsDebug').html() + 'File \'' + this.currentFile + '\' closed<br/>');
                } else {
                    // $('#fsDebug').html($('#fsDebug').html() + 'Unable to close file<br/>');
                }
                break;
            case CANFSCommandType_t.CANFS_LS:
                if (cmdLen > 1) {
                    let fType = data.read8();
                    let fSize = data.read32();
                    let unused = data.read32();
                    let dec = new TextDecoder();
                    let uint8 = new Uint8Array(data.buffer, 11);
                    let fName = dec.decode(uint8);

                    if (fType !== 0) {
                        fType = "Folder";
                        unused = "--";
                        fSize = "";
                    } else {
                        fType = "File";
                        fSize /= 1024;

                        if (fSize > 1024) {
                            fSize /= 1024;
                            unused = " MB";
                        } else {
                            unused = " KB";
                        }

                        fSize = fSize.toFixed(2);
                    }

                    progressBar.setValue(fileIndex);
                    fileIndex++;
                    if (itemsToRead <= fileIndex) {
                        progressBar.setVisible(false);
                    }

                    $('#uavFSTableBody').html($('#uavFSTableBody').html() + '<tr data-tt-id="' + itemsToRead-- + '"><td>' + fName + '</td><td>' + fType + '</td><td>' + fSize + unused + '</td></tr>');

                } else {
                    cmdResponse = data.read8();
                    // $('#fsDebug').html($('#fsDebug').html() + 'EOD<br/>');
                }
                break;
            case CANFSCommandType_t.CANFS_DNUM:
                itemsToRead = data.read8();
                fileIndex = 0;
                progressBar.setMinMax(0, itemsToRead);
                progressBar.setVisible(true);
                this.readItems();
                // setTimeout(this.readItems, 250);
                break;
            }
        }
        console.log('[CANFS] Response received');
        canBusy = false;
    }

    openFile(path)
    {
        if (this.currentFileIsOpened) {
            this.closeFile();
        }

        this.currentFile = path;

        let cmd = new CANFSCommand(CANFSCommandType_t.CANFS_FOPEN);
        cmd.setPayload(path);
        CANFS.addCommand(cmd);
    }

    readFile()
    {
        itemsToRead = -1;
        let cmd0 = new CANFSCommand(CANFSCommandType_t.CANFS_FLOAD_BEGIN);
        cmd0.setPayload("1");
        CANFS.addCommand(cmd0);
    }

    readFileChunk()
    {
        if (itemsToRead !== -1) {
            let cmd1 = new CANFSCommand(CANFSCommandType_t.CANFS_FLOAD);

            for (let i = 0; i < itemsToRead; i++) {
                let buffer = new ArrayBuffer(8);
                let dataView = new DataView(buffer);
                dataView.setInt32(0, i);

                cmd1.payload = buffer;
                cmd1.length = buffer.byteLength;

                CANFS.addCommand(cmd1);
            }
        }
    }

    closeFile()
    {
        // if (this.currentFileIsOpened) {
        $('#fsDebug').html("");
        let cmd = new CANFSCommand(CANFSCommandType_t.CANFS_FCLOSE);
        cmd.setPayload("0");
        CANFS.addCommand(cmd);
        // }
    }

    openDir(path)
    {
        if (this.currentDirIsOpened) {
            this.closeDir();
        }

        this.currentDir = path;

        let cmd = new CANFSCommand(CANFSCommandType_t.CANFS_CD);
        cmd.setPayload(path);
        CANFS.addCommand(cmd);
    }

    closeDir()
    {
        // if (this.currentDirIsOpened) {
        let cmd = new CANFSCommand(CANFSCommandType_t.CANFS_DCLOSE);
        cmd.setPayload("0");
        CANFS.addCommand(cmd);
        // }
    }

    readDir()
    {
        itemsToRead = -1;
        let cmd0 = new CANFSCommand(CANFSCommandType_t.CANFS_DNUM);
        cmd0.setPayload("1");
        CANFS.addCommand(cmd0);
    }

    readItems()
    {
        if (itemsToRead !== -1) {
            let cmd1 = new CANFSCommand(CANFSCommandType_t.CANFS_LS);
            cmd1.setPayload("0");

            for (let i = 0; i < itemsToRead; i++) {
                CANFS.addCommand(cmd1);
            }
        }
    }

    fifoSender()
    {
        if (!canBusy && cmdBuffer !== undefined) {
            if (cmdBuffer.length > 0) {
                let cmdOut = cmdBuffer.shift();
                // this.sendCommand(fifoCmd);
                canBusy = true;
                //enp send
                let bufferOut = new ArrayBuffer(cmdOut.length + 2);
                let outArray = new Uint8Array(bufferOut);
                outArray[0] = cmdOut.type;
                outArray[1] = cmdOut.length;

                if (cmdOut.length > 0 && typeof (cmdOut.payload) === "object") {
                    for (let i = 0; i < cmdOut.length; i++) {
                        outArray[2 + i] = cmdOut.payload[i];
                    }
                    ENP.send_message(id, ENPCodes.ENP_CMD_FILESYSTEM, outArray, false, false);

                    console.log('[CANFS] Command sent: ' + cmdOut.type);
                } else if (cmdOut.length == 0) {
                    console.log('[CANFS] [DEVEL] zero command');
                } else {
                    console.log('[CANFS] Malformed command');
                }
            }
        }
    }
}