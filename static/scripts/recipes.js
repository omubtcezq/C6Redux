//# sourceURL=recipes.js
var recipes = (function() {
// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// ========================================================================== //
// Private functions
// ========================================================================== //

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Make screen reference selector a tabulator table with a single entry
var table = new Tabulator('#recipe-screen-well-select-tabulator', {
    data: [{id: 1, screen: {id: null, name: null}, well: {id: null, label: null}}],
    layout: "fitDataStretch",
    editorEmptyValue: null,
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    columns: [{
        title: "Screen", 
        field: "screen", 
        vertAlign: "middle",
        width: 500,
        headerSort: false,
        editor: "list", 
        editorParams: {
            valuesLookup: function(cell){
                // Load users list from api
                return new Promise(function(resolve, reject){
                    $.ajax({
                        url: API_URL+'/screens/names',
                        success: function(data){
                            var options = [];
                            $.each(data, function(i,s){
                                // Value of cell is the screen object (not just the name)
                                options.push({
                                    label: s.name,
                                    value: s,
                                });
                            })
                            resolve(options);
                        },
                        error: function(error){
                            reject(error);
                        },
                    });
                });
            },
            sort: "asc",
            emptyValue: {id: null, name: null},
            placeholderLoading: "Loading Screen List...",
            placeholderEmpty: "No Screens Found",
            autocomplete: true,
            listOnEmpty: true
        },
        // Update the wells list when screen selected
        cellEdited: function(cell){
            cell.getRow().update({well: {id: null, label: null}});
        },
        formatter: function(cell, formatterParams, onRendered){
            if (cell.getValue().id){
                $(cell.getElement()).css('color', '#333');
                return cell.getValue().name;
            } else {
                $(cell.getElement()).css('color', '#999');
                return "Search screens ...";
            }
        }
    }, {
        title: "Well", 
        field: "well", 
        vertAlign: "middle",
        width: 200,
        resizable: false,
        headerSort: false,
        editor: "list", 
        editorParams: {
            valuesLookup: function(cell){
                var screen_id = cell.getData().screen.id;
                if (screen_id){
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: API_URL+'/screens/wellNames?screen_id='+screen_id,
                            success: function(data){
                                var options = [];
                                $.each(data, function(i,w){
                                    // Value of cell is the well object (not just the name)
                                    options.push({
                                        label: w.label,
                                        value: w,
                                    });
                                })
                                resolve(options);
                            },
                            error: function(error){
                                reject(error);
                            },
                        });
                    });
                } else {
                    return [];
                }
            },
            sort: "asc",
            emptyValue: {id: null, name: null},
            placeholderLoading: "Loading Well List...",
            placeholderEmpty: "No Wells Found",
        },
        formatter: function(cell, formatterParams, onRendered){
            if (cell.getData().screen.id == null){
                return "";
            } else if (cell.getValue().id){
                $(cell.getElement()).css('color', '#333');
                return cell.getValue().label;
            } else {
                $(cell.getElement()).css('color', '#999');
                return "Select well ...";
            }
        },
        editable: function (cell) {
            var is_editable = cell.getRow().getData().screen.id != null;
            return is_editable;
        },
        cellEdited: function(cell){
            // TODO
        }
    }]
});



});

// Return public functions object for globally avilable functions
return public_functions;
})();