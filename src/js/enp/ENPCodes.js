'use strict';

var ENPCodes = {
    ENP_CMD_GETNODENUM : 0x01,
    ENP_CMD_GETNODEDESCR : 0x02,
    ENP_CMD_GETVARDESCR : 0x03,
    ENP_CMD_GETERRORNODES : 0x04,
    ENP_CMD_GETVARS : 0x10,
    ENP_CMD_SETVARS : 0x11,
    ENP_CMD_SETSTREAM : 0x12,
    ENP_CMD_ACKSTREAM : 0x13,
    ENP_CMD_GETPACK0 : 0x20,
    ENP_CMD_GETPACK1 : 0x21,
    ENP_CMD_GETPACK2 : 0x22,
    ENP_CMD_GETPACK3 : 0x23,
    ENP_CMD_GETPACK4 : 0x24,
    ENP_CMD_GETPACK5 : 0x25,
    ENP_CMD_GETPACK6 : 0x26,
    ENP_CMD_GETPACK7 : 0x27,
    ENP_CMD_SETPACK0 : 0x28,
    ENP_CMD_SETPACK1 : 0x29,
    ENP_CMD_SETPACK2 : 0x2A,
    ENP_CMD_SETPACK3 : 0x2B,
    ENP_CMD_SETPACK4 : 0x2C,
    ENP_CMD_SETPACK5 : 0x2D,
    ENP_CMD_SETPACK6 : 0x2E,
    ENP_CMD_SETPACK7 : 0x2F,
    ENP_CMD_EMULATION : 0x30,
    ENP_CMD_NAVSOL : 0x40,
    ENP_CMD_USER : 0x41,
    ENP_CMD_WRITE_FIRMWARE : 0x42,
    ENP_CMD_INIT_FIRMWARE : 0x43,
    ENP_CMD_COMPLETE_FIRMWARE : 0x44,
    ENP_CMD_FILESYSTEM : 0x50,
    ENP_PACKNUM : 8,
    ENP_PACKVARNUM : 50,
};

var ENPStep = {
    INIT : 0,
    DESCRIPTION : 1,
    VARIABLE : 2,
    FINISH : 3,
}

// Error codes
var ENPErrorCodes = {
    ENP_ERROR_NONE : 0, // no error
    ENP_ERROR_NODENUM : 1, // error node number
    ENP_ERROR_NODEID : 2, // error node id
    ENP_ERROR_VARID : 3, // error variable id
    ENP_ERROR_VARVAL : 4, // error value
    ENP_ERROR_COMMAND : 5, // unknown command
};

// Enp properties codes
var ENPType = {
    INT : 0x0001, // integer 32
    UINT : 0x0002, // unsigned integer 32
    BOOL : 0x0003, // boolean
    REAL : 0x0004, // float 32
    HEX : 0x0005, // hex number
    CHAR4 : 0x0006, // 4 char
    TIME : 0x0007, // time
    MASK : 0x000F, // type mask
};

// Enp properties codes
var ENPProp = {
    READONLY : 0x0010, // readonly
    CONST : 0x0020, // const (save in internal flash)
    ERROR : 0x0040, // error
    TRACE : 0x0080, // trace
    MASK : 0x00F0, // prop mask
};

// Firmware ret codes
var FWCode = {
    RET_OK : 0,
    RET_NOT_SUPPURTED : -1,
    RET_SEQUENCE_ERROR : -2,
    RET_HW_ERROR : -3,
    RET_INVALID_PROG_BASE : -4,
    RET_UNINITED : -5,
    RET_ADDRESS_ERROR : -6,
    RET_CRC_ERROR : -7,
};
