'use strict';

TABS.filesystem = {};

var canFs = new CANFS();
var currentPath = "0:/";
var progressBar = new ProgressBar();

TABS.filesystem.initialize = function(callback, scrollPosition) {
    var self = this;

    if (GUI.active_tab != 'filesystem') {
        GUI.active_tab = 'filesystem';
    }

    function load_html()
    {
        $('#content').load('./tabs/filesystem.html', process_html);
    }

    load_html();

    function process_html()
    {
        // table setup
        $('#uavFSTable').treetable({ expandable : true });

        $('#uavFSTable tbody').on('mousedown', 'tr', function() {
            $('.selected').not(this).removeClass('selected');
            $(this).toggleClass('selected');
        });

        $('#uavFSTable tbody').on('dblclick', 'tr', function() {
            let a = $(this)[0].childNodes;
            if (a.length == 3) {
                let fName = a[0].innerText;
                let fType = a[1].innerText;

                //folder
                if (fType === "Folder") {
                    loadDirectory(currentPath + fName);
                } else {
                    loadFile(currentPath + fName)
                }
            }
        });

        loadingShow(false);
        canFs.currentDirIsOpened = false;
        canFs.currentFileIsOpened = false;
        canFs.closeDir();
        canFs.closeFile();
        progressBar.setVisible(false);
        loadDirectory("0:/");

        // scroll to top
        $('#content').scrollTop((scrollPosition) ? scrollPosition : 0);

        // translate to user-selected language
        i18n.localizePage();

        GUI.content_ready(callback);
    }
};

function loadingShow(show)
{
    if (show) {
        $('#load .data-loading').css("position", "absolute");
        $('#load .data-loading').css("z-index", "1000");
        $('#load .data-loading').css("visibility", "visible");
        $('#load .data-loading').css("width", "100%");
        $('#load .data-loading').css("height", "100%");
        $('#load .data-loading').css("background-color", "white");
    } else {
        $('#load .data-loading').css("z-index", "-1");
        $('#load .data-loading').css("visibility", "hidden");
    }
}

function fsDirUp()
{
    if (currentPath !== "0:/") {
        let pathElements = currentPath.split('/');
        let pathElementsCount = pathElements.length;

        if (pathElementsCount >= 3) {
            pathElements.pop();
            pathElements.pop();

            let newPath = pathElements.join('/');
            if (pathElements.length == 1) {
                newPath += '/';
            }
            loadDirectory(newPath);
        }
    }
}

function saveFile()
{
    canFs.closeFile();
    progressBar.setVisible(false);
    chrome.fileSystem.chooseEntry({ type : 'saveFile', suggestedName : canFs.currentFile, accepts : [ { description : 'All files', extensions : [ '*' ] } ] }, function(fileEntry) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            return;
        }

        chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
            console.log('Saving firmware to: ' + path);

            // check if file is writable
            chrome.fileSystem.isWritableEntry(fileEntry, function(isWritable) {
                if (isWritable) {
                    var blob = new Blob([ fileBuffer ], { type : 'text/plain' });

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
}

function loadFile(path)
{
    canFs.closeFile();
    canFs.openFile(path);
    canFs.readFile();
}

function loadDirectory(path)
{

    $('#uavFSTableBody').html("");

    canFs.closeDir();
    canFs.openDir(path);
    canFs.readDir();

    currentPath = path;
    if (currentPath !== "0:/") {
        currentPath = currentPath + '/';
    }

    $('#fsNavigation').html('<b> Current path: </b>' + currentPath);
}

TABS.filesystem.cleanup = function(callback) {
    if (callback)
        callback();
};
