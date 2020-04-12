'use strict';

TABS.nodes_configuration = {};
var counter = 0;
var tblArr = [];
var nodeForLoad = 0;

TABS.nodes_configuration.initialize = function(callback, scrollPosition) {
    var self = this;

    if (GUI.active_tab != 'nodes_configuration') {
        GUI.active_tab = 'nodes_configuration';
    }

    function load_html() {
        $('#content').load('./tabs/nodes_configuration.html', process_html);
    }

    load_html();

    function process_html() {
        var tableBody = $('#table-body')
        for (var i = 0; i < nodesNumber; i++) {
            var nodId = i;
            var pId = '';
            if (nodes[i].id != nodes[i].pid) {
                for (var j = 0; j < nodesNumber; j++) {
                    if (nodes[i].pid == nodes[j].id) {
                        pId = j;
                        break;
                    }
                }
            }
            tableBody.append(addNode(nodId, pId, nodes[i].name));
            for (var j = 0; j < nodes[i].numberOfVar; j++) {
                var varId = nodId + '.' + j;
                nodes[i].vars[j].tblId = 'tblValue' +
                    '_' + nodId + '_' + j;
                tableBody.append(addVariable(
                    varId, nodId, nodes[i].vars[j].name, nodes[i].vars[j].prop,
                    nodes[i].vars[j].tblId));
            }
        }
        $('#nodeNumberInput').hide();
        $('#inputSetBool').hide();
        $('#buttonSetValue').hide();
        var tree = $('#nodes-tree');

        tree.treetable({ expandable: true });

        $('#nodes-tree').data('treetable').nodes[0].expand();

        tableMutableMark();

        var changeValue = $('.changeVal');
        changeValue.click(function(e) {
            var descrProp = $('#valuePropId');
            var descrType = $('#valueTypeId');
            var descrName = $('#valueNameId');
            // var descrId = $("#valueId");
            var inputNumber = $('#nodeNumberInput');
            var inputBool = $('#inputSetBool');
            var buttonSend = $('#buttonSetValue');
            buttonSend.removeAttr('onclick').off('click'); // remove click function
            for (var i = 0; i < nodesNumber; i++) {
                for (var j = 0; j < nodes[i].numberOfVar; j++) {
                    if (nodes[i].vars[j].tblId == e.target.id) {
                        var type;
                        // descrId.html("id = " + nodes[i].vars[j].id + " number = " +
                        // nodes[i].vars[j].number);
                        setValueInfo.id = nodes[i].vars[j].id;
                        setValueInfo.number = nodes[i].vars[j].number;
                        inputNumber.show();
                        inputBool.hide();
                        buttonSend.show();
                        switch (nodes[i].vars[j].prop & ENPType.MASK) {
                            case ENPType.INT:
                                type = 'integer';
                                break;
                            case ENPType.UINT:
                                type = 'unsigned integer';
                                break;
                            case ENPType.BOOL:
                                type = 'boolean';
                                inputNumber.hide();
                                inputBool.show();
                                inputBool.val(nodes[i].vars[j].value == "false" ? "0" : "1");
                                break;
                            case ENPType.REAL:
                                type = 'float32';
                                break;
                            case ENPType.HEX:
                                type = 'hex32';
                                break;
                            case ENPType.CHAR4:
                                type = 'char4';
                                break;
                            case ENPType.TIME:
                                type = 'time';
                                break;
                            default:
                                type = 'unknown'
                                break;
                        }
                        var prop = '';
                        var varProp = nodes[i].vars[j].prop & ENPProp.MASK;
                        if (varProp == ENPProp.READONLY) {
                            prop += 'read only ';
                            inputNumber.hide();
                            buttonSend.hide();
                        }
                        if (varProp == ENPProp.CONST) {
                            prop += 'const ';
                        }
                        if (varProp == ENPProp.ERROR) {
                            prop += 'error ';
                        }
                        if (varProp == ENPProp.TRACE) {
                            prop += 'trace ';
                        }
                        // Enp properties codes
                        descrName.html(nodes[i].vars[j].name);
                        descrType.html('TYPE: ' + type);
                        descrProp.html('PROP: ' + prop);
                        inputNumber.val(nodes[i].vars[j].value);
                        setValue.node = i;
                        setValue.var = j;
                        buttonSend.click(function() {
                            let i = setValue.node;
                            let j = setValue.var;
                            setValueInfo.type = nodes[i].vars[j].prop & ENPType.MASK;
                            switch (nodes[i].vars[j].prop & ENPType.MASK) {
                                case ENPType.BOOL:
                                    setValueInfo.value = parseInt($('#inputSetBool').val());
                                    break;
                                case ENPType.REAL:
                                    setValueInfo.value = parseFloat($('#nodeNumberInput').val());
                                    break;
                                default:
                                    setValueInfo.value = parseInt($('#nodeNumberInput').val());
                                    break;
                            }
                            sendFlag = 1;
                            console.log(setValueInfo);
                        });
                        break;
                    }
                }
            }
        });

        // for some odd reason chrome 38+ changes scroll according to the touched
        // select element i am guessing this is a bug, since this wasn't happening
        // on 37 code below is a temporary fix, which we will be able to remove in
        // the future (hopefully)
        $('#content').scrollTop((scrollPosition) ? scrollPosition : 0);

        // translate to user-selected language
        i18n.localizePage();

        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function() {
            if (sendFlag) {
                sendFlag = 0;
                setValue();
            } else {
                let _nodes = $('#nodes-tree').data('treetable').nodes;
                for (let i = 0; i < _nodes.length; i++) {
                    if (_nodes[i].id == nodeForLoad) {
                        if (_nodes[i].expanded()) {
                            loadValue(nodeForLoad, function() {
                                nodeForLoad++;
                                tableValueUpdate();
                            });
                            break;
                        } else {
                            nodeForLoad++;
                        }
                    }
                }
                if (nodeForLoad >= nodesNumber) {
                    nodeForLoad = 0;
                }
            }
        }, 100, true);

        GUI.content_ready(callback);
    }
};

TABS.nodes_configuration.cleanup = function(callback) {
    if (callback) callback();
};

function addNode(id, parentId, nodeName) {
    return '<tr data-tt-id=\"' + id + '\" data-tt-parent-id=\"' + parentId +
        '\"> \
        <td>' +
        nodeName + '</td> \
        <td></td> \
        </tr>';
}

function addVariable(id, parentId, nodeName, attr, divValId) {
    return '<tr data-tt-id=\"' + id + '" data-tt-parent-id=\"' + parentId + '\"> \
        <td>' +
        nodeName + '</td> \
        <td><div class=\"changeVal\" id=\"' +
        divValId + '\">*</div></td> \
        </tr>';
}

function tableValueUpdate() {
    for (var i = 0; i < nodesNumber; i++) {
        for (var j = 0; j < nodes[i].numberOfVar; j++) {
            var tblId = $('#' + nodes[i].vars[j].tblId);
            tblId.html(nodes[i].vars[j].value);
        }
    }
}

function tableMutableMark() {
    for (var i = 0; i < nodesNumber; i++) {
        for (var j = 0; j < nodes[i].numberOfVar; j++) {
            var tblId = $('#' + nodes[i].vars[j].tblId);
            if (!(nodes[i].vars[j].prop & ENPProp.READONLY)) {
                tblId.addClass('mutable');
            }
        }
    }
}

function clearNodesConfig() {
    nodes = [];
    nodevars = [];
    nodesNumber;
    nodesMaxIndex = 0;
    currentNodeId = 0;

    currentNode = 0;
    currentValueNumber = 0;
    currentVariable = 0;
    GUI.timeout_kill_all();
    GUI.interval_kill_all();
}