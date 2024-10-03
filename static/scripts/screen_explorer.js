//# sourceURL=screen_explorer.js
var screen_explorer = (function() {

// Store query that produced screen list if there was one, so wells can be flagged
var LAST_QUERY = null;

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};
public_functions.screen_query = function (query_object){
    hide_screen();
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.setData(API_URL+'/screens/query', query_object, "POST");
    LAST_QUERY = query_object;
    screen_table.showColumn('well_match_counter');
    screen_table.setSort([
        {column:"screen.name", dir:"asc"},
        {column:"well_match_counter", dir:"desc"}
    ]);
}

// ========================================================================== //
// Private functions
// ========================================================================== //

// Header menu that allows the toggling of column visibilities for both screen and well tables
var column_menu = function(e, column){
    let columns_with_null_filter = ["screen.format_rows", "screen.format_cols", "screen.comments", "factor.ph"]
    let menu = [];
    let columns = this.getColumns();
    let apply_null_filter_option = true;
    let filters = this.getFilters();
    // If a non-header filter (must be null filter) is found for the column, option should be to remove it
    for (i in filters){
        if (filters[i].field == column.getField()){
            apply_null_filter_option = false;
        }
    }

    // Hide column menu
    menu.push({
        label: "Hide Column",
        action: function(e, column){
            // Hide column that menu was accessed from
            column.hide();
        }
    });

    // If menu is for a column that allows the null filter, display it here in the menu
    if ($.inArray(column.getField(), columns_with_null_filter) != -1){
        menu.push({
            label: apply_null_filter_option ? '"null" Filter' : 'Remove "null" Filter',
            action: function(e, column){
                let table = column.getTable();
                // No current null filter means clear the header filter and set a null filter
                if (apply_null_filter_option){
                    table.setHeaderFilterValue(column.getField(), "");
                    table.addFilter(column.getField(), "in", [null, ""]);
                }
                // Otherwise search and remove the null filter
                for (i in filters){
                    if (filters[i].field == column.getField()){
                        table.removeFilter(filters[i].field, filters[i].type, filters[i].value);
                        return;
                    }
                }
            }
        });
    }

    // Rest of menu
    menu.push({
        separator: true,
    });
    menu.push({
        label: "Show All Columns",
        action: function(e, column){
            // Show all columns
            for(i in columns){
                columns[i].show();
            }
        }
    });
    menu.push({
        label: "Clear All Filters",
        action: function(e, column){
            // Clear table filters
            let table = column.getTable();
            table.clearFilter(true);
        }
    });

    return menu;
};

// Function for custom footer to show number of screens when data loaded
function update_screen_count_loaded(data){
    $('#screen-row-count').text(data.length + ' Screens');
}

// Function for custom footer to show number of screens when filter run
function update_screen_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-screen-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-screen-row-count').text('');
    }
}

// Function for custom footer to show number of factors when data loaded
function update_well_count_loaded(data){
    $('#well-row-count').text(data.length + ' Factors');
}

// Function for custom footer to show number of factors when filter run
function update_well_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-well-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-well-row-count').text('');
    }
}

// Function for when a well recipe button is pressed
function condition_recipe(factor_group){

}

// Function for when a well is selected
function select_condition(factor_group){
    alert_user("In the works! 🏗");
}

// Viewing a screen
function view_screen(cell){
    cell.getTable().deselectRow();
    cell.getRow().select();
    $('#screens-half-div').css('width', '50%');
    $('#screens-half-div').css('padding-right', '10px');
    $('#screen-wells-view-div').show();
    $('#screen-wells-view-title').text(cell.getData().screen.name);
    let well_table = Tabulator.findTable('#screen-wells-view-tabulator')[0];
    well_table.setData(API_URL+'/screens/factorQuery?screen_id='+cell.getData().screen.id, LAST_QUERY, "POST");
}

// Cancelling the viewing of a screen
function hide_screen(){
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.deselectRow();
    $('#screen-wells-view-div').hide();
    $('#screens-half-div').css('width', '100%');
    $('#screens-half-div').css('padding-right', '0');
    $('#screen-wells-view-title').text('');
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Tabulator table
var screen_table = new Tabulator("#screen-tabulator", {
    ajaxURL: API_URL+"/screens/query",
    ajaxParams: function(){
        return null;
    },
    ajaxConfig: "POST",
    ajaxContentType: 'json',
    height: "100%",
    layout: "fitData",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Screens",
    placeholder:"No Screens",
    initialFilter:[],
    selectableRows: false,
    index: "screen.id",
    validationMode: 'manual',
    // persistence: {
    //     sort: false,
    //     filter: false,
    //     headerFilter: false,
    //     group: true,
    //     page: false,
    //     columns: true,
    // },
    columns: [
        // Wells matching query
        {
            title: "Wells Matching Query", 
            field: "well_match_counter", 
            hozAlign: "right",
            vertAlign: "middle",
            width: 205,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter",
            visible: false

        // Available
        }, {
            title: "Available", 
            field: "screen.available", 
            hozAlign: "center", 
            vertAlign: "middle",
            width: 105,
            headerMenu: column_menu,
            headerFilter:"tickCross", 
            // Header filter only makes sense if it only looks for checkbox (otherwise can't be disabled)
            headerFilterEmptyCheck: function(value){return !value;},
            formatter: "tickCross",
            // Preserve checkbox booleans as integers as per the database
            mutator: function(value, data){return value ? 1 : 0;}

        // Name
        }, {
            title: "Name", 
            field: "screen.name", 
            vertAlign: "middle",
            width: 350,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
            
        // Owner
        }, {
            title: "Owner", 
            field: "screen.owned_by", 
            vertAlign: "middle",
            width: 175,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Creation date
        }, {
            title: "Creation Date", 
            field: "screen.creation_date", 
            vertAlign: "middle",
            width: 175,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Comments
        }, {
            title: "Comments", 
            field: "screen.comments", 
            vertAlign: "middle",
            width: 485,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Format
        }, {
            title:"Format",
            headerHozAlign : "center", 
            // Format name
            columns: [{
                title: "Name", 
                field: "screen.format_name", 
                vertAlign: "middle",
                width: 115,
                headerMenu: column_menu,
                headerFilter: "input",
                headerFilterPlaceholder: "Filter"

            // Format rows
            }, {
                title: "Rows", 
                field: "screen.format_rows", 
                hozAlign: "right",
                vertAlign: "middle",
                width: 95,
                headerMenu: column_menu,
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // Format cols
            }, {
                title: "Columns", 
                field: "screen.format_cols", 
                hozAlign: "right",
                vertAlign: "middle",
                width: 125,
                headerMenu: column_menu,
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"
            }],

        // Frequent block
        }, {
            title:"Frequently Made Block",
            headerHozAlign : "center", 
            // Reservoir volume
            columns: [{
                title: "Reservoir Volume", 
                field: "screen.frequentblock.reservoir_volume", 
                hozAlign: "right",
                vertAlign: "middle",
                width: 175,
                headerMenu: column_menu,
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // Solution volume
            }, {
                title: "Solution Volume", 
                field: "screen.frequentblock.solution_volume", 
                hozAlign: "right",
                vertAlign: "middle",
                width: 170,
                headerMenu: column_menu,
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"
            }],

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 90, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate button
            formatter: function (cell, formatterParams, onRendered){
                div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                    $('<tr>').append(
                        $('<td>').append(
                            $('<button>').
                            attr('class', 'view-button table-cell-button').
                            text('View')
                        )
                    )));
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('view-button')) {
                    view_screen(cell);
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true
    }],
    initialSort: [
        {column: "screen.name", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'screen-row-count')).append($('<span>').attr('id', 'filtered-screen-row-count')).prop('outerHTML'),
});

screen_table.on("dataFiltered", update_screen_count_filtered);
screen_table.on("dataLoaded", update_screen_count_loaded);

// Tabulator table
var well_table = new Tabulator("#screen-wells-view-tabulator", {
    data: [],
    ajaxContentType: 'json',
    height: "100%",
    layout: "fitDataStretch",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Wells",
    placeholder:"No Wells",
    initialFilter:[],
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
            title: "Well", 
            field: "well.label", 
            vertAlign: "middle",
            width: 85,
            headerSort: false,
            headerMenu: column_menu,
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return aRow.getData().well.position_number - bRow.getData().well.position_number;
            },
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            visible: false
        
        // Meets query
        }, {
            title: "Matches query", 
            field: "query_match", 
            hozAlign: "center", 
            vertAlign: "middle",
            width: 105,
            headerSort: false,
            headerMenu: column_menu,
            headerFilter:"tickCross", 
            // Header filter only makes sense if it only looks for checkbox (otherwise can't be disabled)
            headerFilterEmptyCheck: function(value){return !value;},
            formatter: "tickCross",
            visible: false

        // Chemical
        }, {
            title: "Chemical", 
            field: "factor.chemical", 
            vertAlign: "middle",
            width: 300,
            headerMenu: column_menu,
            headerSort: false,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.factor.chemical.name.toLowerCase().includes(term.toLowerCase())){
                    return true;
                } else {
                    for (i in row_data.factor.chemical.aliases){
                        if (row_data.factor.chemical.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
                            return true;
                        }
                    }
                }
                return false;
            },
            // Display only name and alias count from the chemical object in the cell
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getValue().name == null){
                    return "";
                } else {
                    return cell.getValue().name + (cell.getValue().aliases.length ? ' (aliases: ' + cell.getValue().aliases.length + ')' : "");
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.name.localeCompare(b.name);
            }

        // Concentration
        }, {
            title: "Concentration", 
            field: "factor.concentration", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 105,
            headerMenu: column_menu,
            sorter: "number",
            headerSort: false,
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
        // Unit
        }, {
            title: "Unit", 
            field: "factor.unit", 
            vertAlign: "middle",
            width: 85,
            headerMenu: column_menu,
            headerSort: false,
            headerFilter: "list",
            headerFilterParams: {values: ALL_UNITS},
            headerFilterPlaceholder: "Filter"

        // pH
        }, {
            title: "pH", 
            field: "factor.ph", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 75,
            headerMenu: column_menu,
            sorter: "number",
            headerSort: false,
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }
    ],
    initialSort: [
        {column: "factor.chemical", dir: "asc"},
        {column: "well.label", dir: "asc"},
        {column: "query_match", dir: "desc"}
    ],
    groupBy: function(data){
        return data.well.label;
    },
    groupStartOpen:function(value, count, data, group){
        if (data.length >= 1 && data[0].query_match === false){
            return false;
        } else {
            return true;
        }
    },
    groupHeader:function(value, count, data, group){
        let label = $('<div>').css('display', 'inline-block');
        if (data.length >= 1 && data[0].query_match === true){
            label.text(value + " [Matches query]");
            label.attr('class', 'well-matching-query');
        } else if (data.length >= 1 && data[0].query_match === false) {
            label.text(value + " [Does not match query]");
            label.attr('class', 'well-not-matching-query');
        } else {
            label.text(value);
        }

        let div = $('<table>').attr('class', 'screen-well-header-button-table button-table').append($('<tbody>').append(
            $('<tr>').append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'select-button table-cell-button').
                    text('Select')
                )
            ).append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'recipe-button table-cell-button').
                    text('Recipe')
                )
            )));
        return label.prop('outerHTML') + div.prop('outerHTML');
    },
    footerElement: $('<div>').append($('<span>').attr('id', 'well-row-count')).append($('<span>').attr('id', 'filtered-well-row-count')).prop('outerHTML')
});

// Event handlers that don't go in the table definition above
well_table.on("dataFiltered", update_well_count_filtered);
well_table.on("dataLoaded", update_well_count_loaded);
well_table.on("groupClick", function (e, group){
    target = $(e.target);
        if (target.hasClass('select-button')) {
            select_condition(group);
        }
        if (target.hasClass('recipe-button')) {
            condition_recipe(group);
        }
});

// Refresh button
$('#reload-all-screens-button').click(function(){
    hide_screen();
    screen_table.setData(API_URL+'/screens/query', null, "POST");
    LAST_QUERY = null;
    screen_table.hideColumn('well_match_counter');
    screen_table.setSort([{column:"screen.name", dir:"asc"}]);
    screen_table.clearFilter(true);
});

$('#compare-screens-button').click(function() {
    alert_user("Getting there! 🔎");
});

$('#screen-subsets-button').click(function() {
    alert_user("TODO! 👨‍💻");
});

$('#screen-recipe-button').click(function() {
    alert_user("Soon to be implemented! 🚴‍♂️");
});

$('#screen-report-button').click(function() {
    alert_user("Not yet there! 💁‍♂️");
});

$('#hide-screen-view-button').click(function() {
    hide_screen();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();