//# sourceURL=stocks.js
site_functions.CONTENT_PROVIDERS.stocks = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};
// Filter table on stock
public_functions.filter_stock = function (stock){
    let table = Tabulator.findTable('#stock-tabulator')[0];
    table.clearFilter(true);
    table.setFilter('id', '=', stock.id);
}
public_functions.filter_chemical = function (chemical){
    let table = Tabulator.findTable('#stock-tabulator')[0];
    table.clearFilter(true);
    table.setFilter(filter_stocks_by_chemical, chemical);
}

// ========================================================================== //
// Private functions
// ========================================================================== //

// Custom filter for chemical
function filter_stocks_by_chemical(data, chemical){
    return data.factor.chemical.id == chemical.id;
}

// Remove selection and reformat rows to display edit and delete buttons
function stop_editing(table){
    table.deselectRow();
    all_rows = table.getRows();
    $.each(all_rows, function(i, r){r.reformat()});
    // Renabled adding new stock after editing
    $('#add-stock-button').removeAttr("disabled");
}

// Begin editing row
function row_edit(row){
    table = row.getTable();
    // Disabled adding new stock while editing
    $('#add-stock-button').attr("disabled", "disabled");
    // Deselect all others and select this row
    table.deselectRow();
    row.select();
    // Reformat rows to hide buttons from non-selected row
    all_rows = table.getRows();
    $.each(all_rows, function(i, r){r.reformat()});
    // Save old values, this allows cancel to return to how it was
    row.getData().old_data = $.extend(true, {}, row.getData());
}

// Save row being edited
function row_save(row){
    var table = row.getTable();

    // Validate current edit
    var cells = row.getCells();
    for (i in cells){
        if (cells[i].validate() !== true){
            return;
        }
    }

    // Make expected data object
    var stock = $.extend(true, {}, row.getData());
    // Factor recreated, id should be null
    stock.factor_id = null;
    // Existing chemical always referenced from factor, save and keep only id
    stock.factor.chemical_id = stock.factor.chemical.id;
    delete stock.factor.chemical;
    // Exsisting apiuser always reference from id, save and keep only id
    stock.apiuser_id = stock.apiuser.id;
    delete stock.apiuser;
    // Remove added property for button column
    delete stock.actions;

    // Either update a stock or add a new one. This is checked by looking at the id
    if (stock.id === null){
        // New stock being added, remove the null id as a new one will be recieved
        delete stock.id;
        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'POST',
                url: site_functions.API_URL+'/stocks/create', 
                data: JSON.stringify(stock), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success replace row with contents of returned new stock
                success: function(returned_stock) {
                    table.updateRow(row, returned_stock);
                    // Old data can be dropped
                    delete row.getData().old_data
                    // Id needs to be manually updated
                    row.getData().id = returned_stock.id
                    // Update row count
                    update_stock_count_loaded(table.getData());
                    // Refresh filters
                    table.refreshFilter();
                    // Finish editing row
                    stop_editing(table);
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        site_functions.authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        site_functions.authorise_action(null, to_authorise);
    // Otherwise updating an existing stock
    } else {
        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'PUT',
                url: site_functions.API_URL+'/stocks/update', 
                data: JSON.stringify(stock), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success replace with contents of returned stock (shouldn't be different)
                success: function(returned_stock) {
                    table.updateRow(stock.id, returned_stock);
                    // Old data can be dropped
                    delete row.getData().old_data
                    // Refresh filters
                    table.refreshFilter();
                    // Finish editing row
                    stop_editing(table);
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        site_functions.authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        site_functions.authorise_action(null, to_authorise);
    }
}

// Cancel editing of row
function row_cancel(row){
    var cells = row.getCells();
    var data = row.getData();
    var table = row.getTable();
    // If id is null, then a newly added row is being edited. Remove it after cancel
    if (data.id === null){
        table.deleteRow(row);
    // If id present, return the values to what they were before editing
    } else {
        row.update(row.getData().old_data);
    }
    // Finish editing
    stop_editing(table);
}

// Delete row
function row_delete(row){
    var table = row.getTable();
    var stock_id_to_remove = row.getData().id;
    // Confirm, authorise and make api call
    site_functions.confirm_action("This will delete the selected stock from the database.", function (){
        to_authorise = function(auth_token){
            $.ajax({
                type: 'DELETE',
                url: site_functions.API_URL+'/stocks/delete?stock_id='+stock_id_to_remove,
                headers: {"Authorization": "Bearer " + auth_token},
                // On success remove stock
                success: function() {
                    table.deleteRow(row);
                    // Update row count
                    update_stock_count_loaded(table.getData());
                    // Refresh filters
                    table.refreshFilter();
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        site_functions.authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        site_functions.authorise_action(null, to_authorise);
    });
}

// Go to chemical tab and filter chemicals by the selected on here
function view_chemical(row){
    site_functions.request_content('chemical_list', 'filter_chemical', row.getData().factor.chemical);
}

// Check if a cell is in the currently selected row
function is_selected(cell){
    return cell.getRow().isSelected()
}

// UI fix for editing checkbox. Lets the whole cell be the toggle
function cellclick_flip_tick(e, cell){
    if (cell.getRow().isSelected()){
        cell.setValue(!cell.getValue());
    }
}

// Header menu that allows the toggling of column visibilities
var column_menu = function(e, column){
    let columns_with_null_filter = ["factor.ph", "viscosity", "volatility", "density"]
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
function update_stock_count_loaded(data){
    $('#stock-row-count').text(data.length + ' Stocks');
}

// Function for custom footer to show number of stocks when filter run
function update_stock_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-stock-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-stock-row-count').text('');
    }
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Tabulator table
var table = new Tabulator("#stock-tabulator", {
    ajaxURL: site_functions.API_URL+"/stocks/all",
    height: "100%",
    layout: "fitData",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Stocks",
    placeholder:"No Stocks",
    initialFilter:[],
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
            // Rather than allowing editing, use the better UI for checkbox editing instead
            cellClick: cellclick_flip_tick,
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
            field: "name", 
            vertAlign: "middle",
            width: 350,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || value == ""){
                    site_functions.alert_user("You must specify a stock name.");
                    return false;
                } else {
                    var all_data = cell.getTable().getData();
                    var this_data = cell.getData();
                    for (i in all_data){
                        var looped_data = all_data[i];
                        if (looped_data.id == this_data.id){
                            continue;
                        }
                        if (looped_data.name == value){
                            site_functions.alert_user("A stock with the same name already exists.\nCannot have multiple stocks of the same name.");
                            return false;
                        } else if (looped_data.factor.chemical.id == this_data.factor.chemical.id && 
                                   looped_data.factor.concentration == this_data.factor.concentration && 
                                   looped_data.factor.unit == this_data.factor.unit && 
                                   looped_data.factor.ph == this_data.factor.ph){
                            site_functions.alert_user("Stock: "+looped_data.name+" has the same concentration, unit and ph.\nCannot have multiple stocks of the same chemical factor.");
                            return false;
                        }
                    }
                    return true;
                }
            },
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Chemical
        }, {
            title: "Chemical", 
            field: "factor.chemical", 
            vertAlign: "middle",
            width: 300,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                // Check that the chemical object is there and that it has an id for a valid chemical
                if (value == null || value == "" || value.id == null || value.id == ""){
                    site_functions.alert_user("You must select a chemical.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "list", 
            editorParams: {
                // Load chemical list from api, formatting to show numbers of aliases
                valuesLookup:function(cell){
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: site_functions.API_URL+'/chemicals/names',
                            success: function(data){
                                var options = [];
                                $.each(data, function(i,c){
                                    // Value of chemical cell is the actional chemical object (not just its name)
                                    options.push({
                                        label: c.name + (c.aliases.length ? ' (aliases: ' + c.aliases.length + ')' : ""),
                                        value: c,
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
                emptyValue: {id: null, name: null, aliases: [], unit: null},
                placeholderLoading: "Loading Chemical List...",
                placeholderEmpty: "No Chemicals Found",
                autocomplete:true,
                // Search through names and aliases
                filterFunc: function(term, label, value, item){
                    if (value.name.toLowerCase().includes(term.toLowerCase())){
                        return true;
                    } else {
                        for (i in value.aliases){
                            if (value.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
                                return true;
                            }
                        }
                    }
                    return false;
                },
                filterDelay:100,
                listOnEmpty:true,
            },
            // Update the units and concentration inputs when chemical is changed
            cellEdited: function(cell){
                    var chemical = cell.getValue();
                    var old_chemical = cell.getOldValue();
                    // Different chemical
                    if (chemical.id != old_chemical.id){
                        var unit_ind = $.inArray(chemical.unit, site_functions.ALL_UNITS);
                        var old_unit_ind = $.inArray(old_chemical.unit, site_functions.ALL_UNITS);
                        // Different units
                        if (unit_ind != old_unit_ind){
                            var row = cell.getRow();
                            var unit_cell = row.getCell('factor.unit');
                            var conc_cell = row.getCell('factor.concentration');
                            // New units found
                            if (unit_ind != -1){
                                unit_cell.setValue(site_functions.ALL_UNITS[unit_ind]);
                            // New units not found
                            } else {
                                unit_cell.setValue(site_functions.ALL_UNITS[0]);
                            }
                            // Reset concentration
                            conc_cell.setValue(null);
                            conc_cell.edit();

                        }
                    }
            },
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
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || value == "" || typeof value !== "number" || value <= 0){
                    site_functions.alert_user("You must specify a positive concentration.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Unit
        }, {
            title: "Unit", 
            field: "factor.unit", 
            vertAlign: "middle",
            width: 85,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || value == ""){
                    site_functions.alert_user("You must specify a unit.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "list",
            editorParams: {values: site_functions.ALL_UNITS},
            headerFilter: "list",
            headerFilterParams: {values: site_functions.ALL_UNITS},
            headerFilterPlaceholder: "Filter"

        // pH
        }, {
            title: "pH", 
            field: "factor.ph", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 75,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    site_functions.alert_user("pH must be between 0 and 14.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Polarity
        }, {
            title: "Polar", 
            field: "polar", 
            hozAlign: "center", 
            vertAlign: "middle",
            width: 90,
            // Rather than allowing editing, use the better UI for checkbox editing instead
            cellClick: cellclick_flip_tick,
            headerMenu: column_menu,
            headerFilter:"tickCross", 
            // Header filter only makes sense if it only looks for checkbox (otherwise can't be disabled)
            headerFilterEmptyCheck: function(value){return !value;},
            formatter: "tickCross",
            // Preserve checkbox booleans as integers as per the database
            mutator: function(value, data){return value ? 1 : 0;}

        // Viscosity
        }, {
            title: "Viscosity", 
            field: "viscosity", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value <= 0){
                    site_functions.alert_user("Viscosity must be greater than 0.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Volatility
        }, {
            title: "Volatility", 
            field: "volatility", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 115,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value <= 0){
                    site_functions.alert_user("Volatility must be greater than 0.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Density
        }, {
            title: "Density", 
            field: "density", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 110,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value <= 0){
                    site_functions.alert_user("Density must be greater than 0.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Creator / Apiuser
        }, {
            title: "Creator", 
            field: "apiuser", 
            vertAlign: "middle",
            width: 110,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                // Check that the chemical object is there and that it has an id for a valid chemical
                if (value == null || value == "" || value.id == null || value.id == ""){
                    site_functions.alert_user("You must specify a creator.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "list", 
            editorParams: {
                valuesLookup: function(cell){
                    // Load users list from api
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: site_functions.API_URL+'/stocks/users',
                            success: function(data){
                                var options = [];
                                $.each(data, function(i,u){
                                    // Value of creator cell is the actional apiuser object (not just the username)
                                    options.push({
                                        label: u.username,
                                        value: u,
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
                emptyValue: {id: null, username: null},
                placeholderLoading: "Loading User List...",
                placeholderEmpty: "No Users Found",
                autocomplete: true,
                // Filter through username
                filterFunc: function(term, label, value, item){
                    return value.username.toLowerCase().includes(term.toLowerCase());
                },
                filterDelay:100,
                listOnEmpty:true,
            },
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches only usernames
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                return row_data.apiuser.username.toLowerCase().includes(term.toLowerCase());
            },
            // Format cell to display only the username from the apisuer object
            formatter: function(cell, formatterParams, onRendered){return cell.getValue().username;},
            // Sorter should sort by username name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.username.localeCompare(b.username);
            }

        // Hazards
        }, {
            title: "Hazards", 
            field: "hazards", 
            vertAlign: "middle",
            width: 110,
            headerMenu: column_menu,
            editable: is_selected,
            editor:"list", 
            editorParams:{
                valuesLookup:function(cell){
                    return new Promise(function(resolve, reject){
                        // Load users list from api
                        $.ajax({
                            url: site_functions.API_URL+'/stocks/hazards',
                            success: function(data){
                                var options = [];
                                $.each(data, function(i,h){
                                    // Value of hazard list item is the actional hazard object (not just its name)
                                    options.push({
                                        label: h.name,
                                        value: h,
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
                clearable:true,
                sort:"asc",
                emptyValue: [],
                placeholderLoading: "Loading Hazard List...", 
                placeholderEmpty: "No Hazards Found",
                multiselect:true,
            },
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter searches through the hazard names
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                for (i in row_data.hazards){
                    if (row_data.hazards[i].name.toLowerCase().includes(term.toLowerCase())){
                        return true;
                    }
                }
                return false;
            },
            // Format cell to display only the hazard names
            formatter: function(cell, formatterParams, onRendered){
                return $.map(cell.getValue(), function(h){return h.name;}).join(',')
            },
            // No sorter should appear
            headerSort: false

        // Comments
        }, {
            title: "Comments", 
            field: "comments", 
            vertAlign: "middle",
            width: 350,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 330, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate buttons
            formatter: function (cell, formatterParams, onRendered){
                if (cell.getRow().isSelected()){
                    div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                        $('<tr>').append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'view-chem-button table-cell-button').
                                attr('disabled', 'disabled').
                                text('Chemical')
                            )
                        ).append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'save-button table-cell-button').
                                text('Save')
                            )
                        ).append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'cancel-button table-cell-button').
                                text('Cancel')
                            )
                    )))
                } else if (cell.getTable().getSelectedRows().length == 0) {
                    div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                        $('<tr>').append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'view-chem-button table-cell-button').
                                text('Chemical')
                            )
                        ).append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'edit-button table-cell-button').
                                text('Edit')
                            )
                        ).append(
                            $('<td>').append(
                                $('<button>').
                                attr('class', 'delete-button table-cell-button').
                                text('Delete')
                            )
                    )))
                } else {
                    div = $('<div>');
                }
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('edit-button')) {
                    row_edit(cell.getRow());
                } else if (target.hasClass('delete-button')){
                    row_delete(cell.getRow());
                } else if (target.hasClass('save-button')){
                    row_save(cell.getRow());
                } else if (target.hasClass('cancel-button')){
                    row_cancel(cell.getRow());
                } else if (target.hasClass('view-chem-button')){
                    view_chemical(cell.getRow());
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: true, 
            frozen: true}
    ],
    initialSort: [
        {column: "name", dir: "asc"},
        {column: "available", dir: "desc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'stock-row-count')).append($('<span>').attr('id', 'filtered-stock-row-count')).prop('outerHTML')
});

table.on("dataFiltered", update_stock_count_filtered);
table.on("dataLoaded", update_stock_count_loaded);

// Adding a new stock button. Adds a new row to the table with nulls and begins its editing
$('#add-stock-button').click(function(){
    table.addRow({
        id: null,
        available: 1,
        name: null,
        factor: {
            chemical_id: null,
            chemical: {
                id: null,
                name: null,
                aliases: [],
                unit: null
            },
            concentration: null,
            unit: site_functions.ALL_UNITS[0],
            ph: null
        },
        polar: 0,
        viscosity: null,
        volatility: null,
        density: null,
        apiuser_id: null,
        apiuser: {
            id: null,
            username: null
        },
        hazards: [],
        comments: null
    }, true).then(function(row){
        // Reshow all columns when adding new stock
        let columns = table.getColumns()
        for(i in columns){
            columns[i].show();
        }
        table.scrollToRow(row, "top", true);
        row_edit(row);
    });
});

// Refresh button
$('#reload-stocks-button').click(function(){
    table.setData();
    table.clearFilter(true);
});

// Propagate message passing after tables have loaded
Promise.all([
    new Promise(function(resolve, reject){
        table.on('tableBuilt', resolve);
    })
]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();