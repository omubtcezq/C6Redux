//# sourceURL=screen_editor.js
site_functions.CONTENT_PROVIDERS.screen_editor = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// ========================================================================== //
// Private functions
// ========================================================================== //

var group_colours = [
    {id: 0, name: "tab:blue", colour: "#1f77b4"}, 
    {id: 1, name: "tab:orange", colour: "#ff7f0e"},
    {id: 2, name: "tab:green", colour: "#2ca02c"},
    {id: 3, name: "tab:red", colour: "#d62728"},
    {id: 4, name: "tab:purple", colour: "#9467bd"},
    {id: 5, name: "tab:brown", colour: "#8c564b"},
    {id: 6, name: "tab:pink", colour: "#e377c2"},
    {id: 7, name: "tab:gray", colour: "#7f7f7f"},
    {id: 8, name: "tab:olive", colour: "#bcbd22"},
    {id: 9, name: "tab:cyan", colour: "#17becf"}
]


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
            cell.getRow().update();
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

// Tabulator table
var chemical_group_table = new Tabulator("#automatic-chemical-groups-tabulator", {
    data: [],
    height: "100%",
    layout: "fitColumns",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholder: "No Chemical Groups",
    initialFilter: [],
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    renderVerticalBuffer: 7800,
    // persistence: {
    //     sort: false,
    //     filter: false,
    //     headerFilter: false,
    //     group: true,
    //     page: false,
    //     columns: true,
    // },
    columns: [
        // Well name
        {
            title: "Factor Group", 
            field: "factor_group", 
            vertAlign: "middle",
            width: 125,
            headerSort: true
        
        // Colour
        }, {
            title: "Colour", 
            field: "colour", 
            vertAlign: "middle",
            width: 55,
            headerSort: false,
            formatter: "color"

        // Chemical Order (previously Location)
        }, {
            title: "Chemical Order", 
            field: "chemical_order", 
            vertAlign: "middle",
            width: 140,
            editor: "list",
            editorParams: {values: [{value: {id: "uniform_random", label: "Uniform Random"}, label: "Uniform Random"}, 
                                    {value: {id: "column", label: "Column"}, label: "Column"}, 
                                    {value: {id: "row", label: "Row"}, label: "Row"},
                                    {value: {id: "quadrant", label: "Quadrant"}, label: "Quadrant"}]},
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            }
            
        // Varied Attribute Order (previously Vary By)
        }, {
            title: "Varied Attribute Order", 
            field: "varied_attribute_order", 
            vertAlign: "middle",
            width: 130,
            editor: "list",
            editorParams: {values: [{value: {id: "gaussian_random", label: "Gaussian Random"}, label: "Gaussian Random"}, 
                                    {value: {id: "uniform_random", label: "Uniform Random"}, label: "Uniform Random"}, 
                                    {value: {id: "gaussian_random_sorted", label: "Gaussian Random (Sorted)"}, label: "Gaussian Random (Sorted)"}, 
                                    {value: {id: "uniform_random_sorted", label: "Uniform Random (Sorted)"}, label: "Uniform Random (Sorted)"}, 
                                    {value: {id: "well", label: "Well"}, label: "Well"}, 
                                    {value: {id: "column", label: "Column"}, label: "Column"}, 
                                    {value: {id: "row", label: "Row"}, label: "Row"},
                                    {value: {id: "quadrant", label: "Quadrant"}, label: "Quadrant"},
                                    {value: {id: "half", label: "Half"}, label: "Half"},
                                    {value: {id: "fixed", label: "Fixed"}, label: "Fixed"}]},
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            }

        // Well Coverage
        }, {
            title: "Screen Coverage (%)", 
            field: "screen_coverage", 
            hozAlign: "right", 
            vertAlign: "middle",
            editable: false,
            sorter: "number",
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() + '%';
            },

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 105, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate button
            formatter: function (cell, formatterParams, onRendered){
                div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                    $('<tr>').append(
                        $('<td>').append(
                            $('<button>').
                            attr('class', 'delete-button table-cell-button').
                            text('Remove')
                        )
                    )));
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('delete-button')) {
                    //view_chemical(cell.getRow());
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true
    }],
    initialSort: [
        {column: "factor_group", dir: "asc"}
    ]
});

$('#screen-editor-automatic-add-group-button').click(function(){
    var num_groups = chemical_group_table.getData().length;
    chemical_group_table.addRow({id: num_groups+1, 
                                 factor_group: "New Group", 
                                 colour: group_colours[num_groups % group_colours.length].colour, 
                                 chemical_order: {value: "random", label: "Uniform Random"}, 
                                 varied_attribute_order: {value: "gaussian_random", label: "Gaussian Random"}, 
                                 screen_coverage: 0,
                                 chemicals: []});
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