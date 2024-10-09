//# sourceURL=recipes.js
site_functions.CONTENT_PROVIDERS.recipes = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};
// Select and display recipe given a condition id
public_functions.screen_well_recipe = function (screen_well){
    let screen_well_table = Tabulator.findTable('#recipe-screen-well-select-tabulator')[0];
    let screen = screen_well.screen;
    let well = screen_well.well;
    screen_well_table.setData([{id: 1, screen: {id: screen.id, name: screen.name}, well: {id: well.id, label: well.label, wellcondition_id: well.wellcondition_id}}]);
    $("#recipe-from-screen-well-button").click();
}

// ========================================================================== //
// Private functions
// ========================================================================== //


// Header menu that allows the toggling of column visibilities
var column_menu = function(e, column){
    let columns_with_null_filter = [];
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

// Function for custom footer to show number of stocks when data loaded
function update_recipe_count_loaded(data){
    $('#recipe-row-count').text(data.length + ' Stocks');
}

// Function for custom footer to show number of stocks when filter run
function update_recipe_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-recipe-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-recipe-row-count').text('');
    }
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Make screen reference selector a tabulator table with a single entry
var screen_well_table = new Tabulator('#recipe-screen-well-select-tabulator', {
    data: [{id: 1, screen: {id: null, name: null}, well: {id: null, label: null}}],
    layout: "fitColumns",
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
        width: 100,
        resizable: false,
        headerSort: false,
        editor: "list", 
        editorParams: {
            valuesLookup: function(cell){
                var screen_id = cell.getData().screen.id;
                if (screen_id){
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: site_functions.API_URL+'/screens/wellNames?screen_id='+screen_id,
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

// Recipe table
var recipe_table = new Tabulator("#recipes-tabulator", {
    data: [],
    ajaxResponse:function(url, params, response){
        if (!response.success){
            site_functions.alert_user(response.msg);
            return [];
        }
        let data = [];
        let ind = 1;
        for (i in response.stocks){
            let s = response.stocks[i];
            data.push({id: ind, available: s.stock.available, stock: {id: s.stock.id, name: s.stock.name}, volume: s.volume, well: {id: null, label: null}});
            ind += 1;
        }
        if (response.water > 0){
            data.push({id: ind, available: null, stock: {id: null, name: "Water"}, volume: response.water, well: {id: null, label: null}});
        }
        return data;
    },
    height: "100%",
    layout: "fitColumns",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Stocks",
    placeholder:"No Recipes to Show",
    initialFilter: [],
    selectableRows: false,
    index: "id",
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
        // Available
        {
            title: "Available", 
            field: "available", 
            hozAlign: "center", 
            vertAlign: "middle",
            width: 105,
            headerMenu: column_menu,
            headerFilter:"tickCross", 
            // Header filter only makes sense if it only looks for checkbox (otherwise can't be disabled)
            headerFilterEmptyCheck: function(value){return !value;},
            formatter: "tickCross",
            formatterParams: {allowEmpty: true}

        // Name
        }, {
            title: "Stock Name", 
            field: "stock.name", 
            vertAlign: "middle",
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Volume
        }, {
            title: "Volume (ml)", 
            field: "volume", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 150,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 150, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate buttons
            formatter: function (cell, formatterParams, onRendered){
                if (cell.getData().stock.name != 'Water'){
                    div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                        $('<tr>').append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'view-stock-button table-cell-button').
                                text('View Stock')
                            )
                        )));
                } else {
                    div = $('<div>');
                }
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('view-stock-button')) {
                    site_functions.alert_user("Coming soon! 🛳");
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true}
    ],
    initialSort: [
        {column: "volume", dir: "asc"},
        {column: "available", dir: "desc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'recipe-row-count')).append($('<span>').attr('id', 'filtered-recipe-row-count')).prop('outerHTML')
});

recipe_table.on("dataFiltered", update_recipe_count_filtered);
recipe_table.on("dataLoaded", update_recipe_count_loaded);

// Generate recipes buttons
$("#recipe-from-screen-well-button").click(function(){
    let table_data = screen_well_table.getRow(1).getData();
    if (table_data.well.id != null){
        let id = table_data.well.wellcondition_id;
        recipe_table.setData(site_functions.API_URL+'/screens/conditionRecipe', {condition_id: id});
    } else {
        site_functions.alert_user("No well selected.");
    }
});

$("#recipe-from-custom-condition-button").click(function(){
    site_functions.alert_user("Coming next! 🚀");
});

// Recipe input buttons
$("#screen-recipe-button").click(function(){
    // Buttons
    $("#screen-recipe-button").attr("disabled", "disabled");
    $("#selected-wells-recipe-button").removeAttr("disabled");
    $("#screen-well-recipe-button").removeAttr("disabled");
    $("#custom-condition-recipe-button").removeAttr("disabled");

    // Sections
    $("#recipe-from-screen-input").show();
    $("#recipe-from-selected-wells-input").hide();
    $("#recipe-from-screen-well-input").hide();
    $("#recipe-from-custom-condition-input").hide();
});

$("#selected-wells-recipe-button").click(function(){
    // Buttons
    $("#screen-recipe-button").removeAttr("disabled");
    $("#selected-wells-recipe-button").attr("disabled", "disabled");
    $("#screen-well-recipe-button").removeAttr("disabled");
    $("#custom-condition-recipe-button").removeAttr("disabled");

    // Sections
    $("#recipe-from-screen-input").hide();
    $("#recipe-from-selected-wells-input").show();
    $("#recipe-from-screen-well-input").hide();
    $("#recipe-from-custom-condition-input").hide();
});

$("#screen-well-recipe-button").click(function(){
    // Buttons
    $("#screen-recipe-button").removeAttr("disabled");
    $("#selected-wells-recipe-button").removeAttr("disabled");
    $("#screen-well-recipe-button").attr("disabled", "disabled");
    $("#custom-condition-recipe-button").removeAttr("disabled");

    // Sections
    $("#recipe-from-screen-input").hide();
    $("#recipe-from-selected-wells-input").hide();
    $("#recipe-from-screen-well-input").show();
    $("#recipe-from-custom-condition-input").hide();
});

$("#custom-condition-recipe-button").click(function(){
    // Buttons
    $("#screen-recipe-button").removeAttr("disabled");
    $("#selected-wells-recipe-button").removeAttr("disabled");
    $("#screen-well-recipe-button").removeAttr("disabled");
    $("#custom-condition-recipe-button").attr("disabled", "disabled");

    // Sections
    $("#recipe-from-screen-input").hide();
    $("#recipe-from-selected-wells-input").hide();
    $("#recipe-from-screen-well-input").hide();
    $("#recipe-from-custom-condition-input").show();
});

$("#screen-well-recipe-button").click();

// Propagate message passing after tables have loaded
Promise.all([
    new Promise(function(resolve, reject){
        screen_well_table.on('tableBuilt', resolve);
    }), 
    new Promise(function(resolve, reject){
        recipe_table.on('tableBuilt', resolve);
    })
]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();