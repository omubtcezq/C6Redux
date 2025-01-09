//# sourceURL=screen_editor.js
site_functions.CONTENT_PROVIDERS.screen_editor = (function() {

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

// Additive and percentage is a tabulator screen selector with a single entry
var additive_table = new Tabulator('#automatic-additive-tabulator', {
    data: [{id: 1, screen: {id: null, name: null}, dilution: 0}],
    layout: "fitColumns",
    rowHeight: 48,
    editorEmptyValue: null,
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    columns: [{
        title: "Screen", 
        field: "screen", 
        vertAlign: "middle",
        headerSort: false,
        editor: "list", 
        editorParams: {
            valuesLookup: function(cell){
                // Load users list from api
                return new Promise(function(resolve, reject){
                    $.ajax({
                        url: site_functions.API_URL+'/screens/names',
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
            cell.getRow().reformat();
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
        title: "Dilution (%)", 
        field: "dilution", 
        vertAlign: "middle",
        width: 100,
        resizable: false,
        headerSort: false,
        editor: "number",
        formatter: function(cell, formatterParams, onRendered){
            if (cell.getData().screen.id == null){
                $(cell.getElement()).css('color', '#999');
                return cell.getValue() + '%';
            } else {
                $(cell.getElement()).css('color', '#333');
                return cell.getValue() + '%';
            }
        },
        editable: function (cell) {
            var is_editable = cell.getRow().getData().screen.id != null;
            return is_editable;
        }
    }]
});

$("#automatic-editor-button").click(function(){
    // Buttons
    $("#manual-editor-button").removeAttr("disabled");
    $("#automatic-editor-button").attr("disabled", "disabled");

    // Sections
    $("#manual-editor-div").hide();
    $("#automatic-editor-div").show();
});

$("#manual-editor-button").click(function(){
    // Buttons
    $("#automatic-editor-button").removeAttr("disabled");
    $("#manual-editor-button").attr("disabled", "disabled");

    // Sections
    $("#automatic-editor-div").hide();
    $("#manual-editor-div").show();
});

$("#automatic-editor-button").click();


// Propagate message passing after tables have loaded
Promise.all([]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();