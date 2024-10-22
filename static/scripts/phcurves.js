//# sourceURL=phcurves.js
site_functions.CONTENT_PROVIDERS.phcurves = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// ========================================================================== //
// Private functions
// ========================================================================== //

// Remove selection and reformat rows to display edit and delete buttons
function stop_editing(table){
    table.deselectRow();
    all_rows = table.getRows();
    $.each(all_rows, function(i, r){r.reformat()});
    // Renabled adding new chemical after editing
    $('#add-chemical-button').removeAttr("disabled");
}

// Begin editing row
function row_edit(row){
    table = row.getTable();
    // Disabled adding new chemical while editing
    $('#add-chemical-button').attr("disabled", "disabled");
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

    // Validate current edit, stop at first fail (will trigger notification)
    var cells = row.getCells();
    for (i in cells){
        if (cells[i].validate() !== true){
            return;
        }
    }
    // Get ph point subtable and validate it too
    var phpoint_table = Tabulator.findTable('#phpoint-subtable-'+row.getData().id)[0];
    var phpoint_table_rows = phpoint_table.getRows();
    for (i in phpoint_table_rows){
        var phpoint_table_cells = phpoint_table_rows[i].getCells();
        for (j in phpoint_table_cells){
            if (phpoint_table_cells[j].validate() !== true){
                return;
            }
        }
    }

    // Make expected data object
    var phcurve = $.extend(true, {}, row.getData());
    // Existing chemical always referenced from curve, save and keep only id
    phcurve.chemical_id = phcurve.chemical.id;
    delete phcurve.chemical;
    // Existing low end chemical always referenced from curve, save and keep only id
    phcurve.low_chemical_id = phcurve.low_chemical.id;
    delete phcurve.low_chemical;
    // Existing high chemical always referenced from curve, save and keep only id
    phcurve.high_chemical_id = phcurve.high_chemical.id;
    delete phcurve.high_chemical;
    // Remove added property for button column
    delete phcurve.actions;
    // Remove ids from points (these are no longer db ids but rather tabulator ids)
    for (i in phcurve.points){
        delete phcurve.points[i].id;
    }

    // Either update a phcurve or add a new one. This is checked by looking at the id
    if (phcurve.id === null){
        // New phcurve being added, remove the null id as a new one will be recieved
        delete phcurve.id;
        // Similarly for the chemical ids of the aliases
        for (i in phcurve.points){
            delete phcurve.points[i].chemical_id;
        }

        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'POST',
                url: site_functions.API_URL+'/chemicals/phcurve_create', 
                data: JSON.stringify(phcurve), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success replace row with contents of returned new phcurve
                success: function(returned_phcurve) {
                    table.updateRow(row, returned_phcurve);
                    // Old data can be dropped
                    delete row.getData().old_data
                    // Id needs to be manually updated
                    row.getData().id = returned_phcurve.id
                    // Update row count
                    update_phcurve_count_loaded(table.getData());
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
    // Otherwise updating an existing phcurve
    } else {
        // First see how many places the phcurve's chemical is used
        $.ajax({
            type: 'GET',
            url: site_functions.API_URL+'/chemicals/useOfChemical?chemical_id=' + phcurve.chemical_id,
            success: function(counter){
                // Function to authorise and make api call
                edit_call = function (){
                    to_authorise = function(auth_token){
                        $.ajax({
                            type: 'PUT',
                            url: site_functions.API_URL+'/chemicals/phcurve_update', 
                            data: JSON.stringify(phcurve), 
                            headers: {"Authorization": "Bearer " + auth_token},
                            // On success replace with contents of returned phcurve (shouldn't be different)
                            success: function(returned_phcurve) {
                                table.updateRow(phcurve.id, returned_phcurve);
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
                };
                // If the phcurve's chemical is not used anywhere, perform the edit
                if (counter.well_count == 0 && counter.stock_count == 0){
                    edit_call();
                // Otherwise warn the user about all the places the chemical is used before editing
                } else {
                    site_functions.confirm_action("The chemical whose pH curve you wish to edit is used in:\n" + 
                                   counter.condition_count + (counter.condition_count==1 ? " condition," : " conditions,") + " " +
                                   counter.well_count + (counter.well_count==1 ? " well," : " wells,") + " " +
                                   counter.screen_count + (counter.screen_count==1 ? " screen and" : " screens and") + " " +
                                   counter.stock_count + (counter.stock_count==1 ? " stock." : " stocks.") + "\n" +
                                   "Are you sure you wish to edit it?", edit_call);
                }
            }
        });
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
    var phcurve_to_remove = row.getData();

    // First see how many places the chemical is used
    $.ajax({
        type: 'GET',
        url: site_functions.API_URL+'/chemicals/useOfChemical?chemical_id=' + phcurve_to_remove.chemical_id,
        success: function(counter){
            // Function to authorise and make api call
            delete_call = function (){
                to_authorise = function(auth_token){
                    $.ajax({
                        type: 'DELETE',
                        url: site_functions.API_URL+'/chemicals/phcurve_delete?phcurve_id='+phcurve_to_remove.id,
                        headers: {"Authorization": "Bearer " + auth_token},
                        // On success remove phcurve
                        success: function() {
                            table.deleteRow(row);
                            // Update row count
                            update_phcurve_count_loaded(table.getData());
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
            };
            // If the phcurve's chemical is not used anywhere, perform the delete
            if (counter.well_count == 0 && counter.stock_count == 0){
                site_functions.confirm_action("This will delete the selected pH curve from the database.", delete_call);
            // Otherwise warn the user about all the places the chemical is used before deleting
            } else {
                site_functions.confirm_action("The chemical whose pH curve you wish to delete is used in:\n" +
                                counter.condition_count + (counter.condition_count==1 ? " condition," : " conditions,") + " " +
                                counter.well_count + (counter.well_count==1 ? " well," : " wells,") + " " +
                                counter.screen_count + (counter.screen_count==1 ? " screen and" : " screens and") + " " +
                                counter.stock_count + (counter.stock_count==1 ? " stock." : " stocks.") + "\n" +
                                "Are you sure you wish to delete it?", delete_call);
            }
        }
    });
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
    let columns_with_null_filter = []
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

// Function for custom footer to show number of chemicals when data loaded
function update_phcurve_count_loaded(data){
    $('#phcurve-row-count').text(data.length + ' pH Curves');
}

// Function for custom footer to show number of chemicals when filter run
function update_phcurve_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-phcurve-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-phcurve-row-count').text('');
    }
}

// Formatter for visualised ph curve
var phpoints_formatter = function(cell, formatterParams, onRendered){
    var phcurve = cell.getData();
    var graph_span = $("<span>").attr('id', 'graph-' + phcurve.id);
    var curve = cell.getValue();
    var peity_options = {height: 38, width: 190};

    // If not HH curve, plot the points
    if (phcurve.hh == 0){
        graph_span.text($.map(curve, function(value, index){return value.result_ph}).join(','));
    // If HH curve, plot arbitrary HH curve (since there is no axis labels) and colour it differently
    } else {
        graph_span.text($.map([2.5,7.5,12.5,17.5,22.5,27.5,32.5,37.5,42.5,47.5,52.5,57.5,62.5,67.5,72.5,77.5,82.5,87.5,92.5,97.5], function(value, index){return 2 + Math.log10(value/(100-value))}).join(','));
        peity_options.fill = '#CEFDC6';
        peity_options.stroke = '#66F94D';
    }

    // Instantiate piety chart after the cell element rendered
    onRendered(function(){
        $('#graph-' + phcurve.id).peity("line", peity_options);
    });

    // Return span that is overridden by graph
    return graph_span.prop('outerHTML');
};

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Tabulator table
var table = new Tabulator("#phcurve-tabulator", {
    ajaxURL: site_functions.API_URL+"/chemicals/phcurve_all",
    height: "100%",
    layout: "fitColumns",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Curves",
    placeholder:"No Curves",
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
        // Graph
        {
            title: "Graph", 
            field: "points", 
            width: 200,
            formatter: phpoints_formatter,
            headerSort: false

        // Chemical
        }, {
            title: "Chemical", 
            field: "chemical", 
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
                    var all_data = cell.getTable().getData();
                    var this_data = cell.getData();
                    for (i in all_data){
                        var looped_data = all_data[i];
                        if (looped_data.id == this_data.id){
                            continue;
                        }
                        if (looped_data.chemical.id == value.id && 
                            Math.abs(looped_data.low_range - this_data.low_range) <= site_functions.PH_MIN_DIFF && 
                            Math.abs(looped_data.high_range - this_data.high_range) <= site_functions.PH_MIN_DIFF){

                            site_functions.alert_user("A pH curve for the selected chemical and endpoints already exists.\nCannot have multiple curves for the same chemical with the same (within "+ site_functions.PH_MIN_DIFF +" units) low and high endpoints.");
                            return false;
                        }
                    }
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
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.chemical.name.toLowerCase().includes(term.toLowerCase())){
                    return true;
                } else {
                    for (i in row_data.chemical.aliases){
                        if (row_data.chemical.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
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
        
        // Low range
        }, {
            title: "Low pH Endpoint", 
            field: "low_range", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 170,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                // Check pH is valid
                if (value == null || typeof value !== "number" || value < 0 || value > 14){
                    site_functions.alert_user("Low pH must be between 0 and 14.");
                    return false;
                // Check that non-HH curve has minimum point starting at (near) the pH
                } else if (cell.getData().hh == 0) {
                    var lowest_point = Math.min(...$.map(cell.getData().points, function(value, index){return value.result_ph}));
                    if (Math.abs(cell.getData().low_range - lowest_point) > site_functions.PH_MIN_DIFF){
                        site_functions.alert_user("Low pH must be close to lowest pH point in curve.");
                        return false;
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        
        // Low chemical
        }, {
            title: "Low pH Chemical", 
            field: "low_chemical", 
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
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.low_chemical.name.toLowerCase().includes(term.toLowerCase())){
                    return true;
                } else {
                    for (i in row_data.low_chemical.aliases){
                        if (row_data.low_chemical.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
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
        
        // High range
        }, {
            title: "High pH Endpoint", 
            field: "high_range", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 180,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                // CHeck pH is valid
                if (value == null || typeof value !== "number" || value < 0 || value > 14){
                    site_functions.alert_user("High pH must be between 0 and 14.");
                    return false;
                // Check high pH is higher than low pH
                } else if (cell.getData().low_range >= value) {
                    site_functions.alert_user("High pH must be higher than low pH.");
                    return false;
                // Check that non-HH curve has maximum point ending at (near) the pH
                } else if (cell.getData().hh == 0) {
                    var highest_point = Math.max(...$.map(cell.getData().points, function(value, index){return value.result_ph}));
                    if (Math.abs(cell.getData().high_range - highest_point) > site_functions.PH_MIN_DIFF){
                        site_functions.alert_user("High pH must be close to highest pH point in curve.");
                        return false;
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // High chemical
        }, {
            title: "High pH Chemical", 
            field: "high_chemical", 
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
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.high_chemical.name.toLowerCase().includes(term.toLowerCase())){
                    return true;
                } else {
                    for (i in row_data.high_chemical.aliases){
                        if (row_data.high_chemical.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
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
        
        // HH
        }, {
            title: "Henderson-Hasselbalch Curve", 
            field: "hh", 
            hozAlign: "center", 
            vertAlign: "middle",
            width: 260,
            // Rather than allowing editing, use the better UI for checkbox editing instead
            cellClick: function(e, cell){
                cellclick_flip_tick(e, cell);
                cell.getRow().reformat();
            },
            headerMenu: column_menu,
            headerFilter:"tickCross", 
            // Header filter only makes sense if it only looks for checkbox (otherwise can't be disabled)
            headerFilterEmptyCheck: function(value){return !value;},
            validator: function(cell, value){
                // Check that the chemical object is there and that it has an id for a valid chemical
                if (value == 0 && cell.getData().points.length == 0){
                    site_functions.alert_user("The pH curve must contain points if it is not a Hendersen Hasslebalch curve.");
                    return false;
                } else {
                    return true;
                }
            },
            formatter: "tickCross",
            // Preserve checkbox booleans as integers as per the database
            mutator: function(value, data){return value ? 1 : 0;}

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 170, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate buttons
            formatter: function (cell, formatterParams, onRendered){
                if (cell.getRow().isSelected()){
                    div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                        $('<tr>').append(
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
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: true, 
            frozen: true
    }],
    initialSort: [
        {column: "chemical", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'phcurve-row-count')).append($('<span>').attr('id', 'filtered-phcurve-row-count')).prop('outerHTML'),
    rowFormatter: function(row, e) {
        var phcurve_id = row.getData().id;
        var subtable = $('<div>').attr('id', 'phpoint-subtable-'+phcurve_id).attr('class', 'subtable phpoint-subtable');
        var subtable_tabulator = new Tabulator(subtable[0], {
            layout: "fitColumns",
            data: row.getData().points,
            selectableRows: false,
            rowHeight: 48,
            placeholder: "No Points",
            validationMode: 'manual',
            columns: [{
                title: "High Chemical Percentage",
                field: "high_chemical_percentage",
                hozAlign: "right", 
                vertAlign: "middle",
                validator: function(cell, value){
                    if (value == null || value == "" || typeof value !== "number" || value < 0 || value > 100){
                        site_functions.alert_user("Percentages in points of curve must be between 0 and 100.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number",
                sorterParams: {alignEmptyValues: "bottom"},
                headerSort: false,
                cellEdited: function(cell){
                    cell.getTable().setSort("high_chemical_percentage", "asc");
                }
            
            // High range
            }, {
                title: "Resulting pH", 
                field: "result_ph", 
                hozAlign: "right", 
                vertAlign: "middle",
                validator: function(cell, value){
                    if (value == null || typeof value !== "number" || value < 0 || value > 14){
                        site_functions.alert_user("pH points of curve must be between 0 and 14.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number",
                headerSort: false,
                cellEdited: function(cell){
                    $('#graph-' + cell.getData().id).change();
                    row.reformat();
                }

            }, {
                title: "", 
                field: "actions", 
                width: 100, 
                // Display button to remove each alias
                formatter: function (cell, formatterParams, onRendered){
                    div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                        $('<tr>').append(
                            $('<td>').append(
                                $('<button>').
                                attr('id', 'delete-alias-'+cell.getData().id).
                                attr('class', 'delete-button table-cell-button').
                                text('Remove')
                            )
                        )
                    ));
                    return div.prop('outerHTML');
                }, 
                // When the cell is clicked, check if the button itself was clicked and remove data
                cellClick: function(e, cell){
                    target = $(e.target);
                    if (target.hasClass('delete-button')){
                        var phpoint_cell_id = cell.getData().id;
                        row.getData().points = row.getData().points.filter(function(a){return a.id != phpoint_cell_id});

                        // TODO causes tabulator warning - how to get rid of it??
                        cell.getTable().replaceData(row.getData().points);
                    }
                }, 
                headerSort: false, 
                hozAlign: "center", 
                vertAlign: "middle", 
                resizable: false
            }],
            initialSort: [
                {column: "high_chemical_percentage", dir: "asc"}
            ],
        });

        // Holder of subtable contains add new ph point button
        var holder = $('<div>').attr('class', 'holder-for-subtable');
        var add_button = $('<table>').append($('<tbody>').append($('<tr>').append($('<td>').append(
            $('<button>').attr('id', 'add-phpoint-'+phcurve_id).attr('class', 'table-cell-button add-button').text('Add Point').click(function(){
                // Adds data to original row and reloads the subtable. Unique id required and ignored when saving
                row.getData().points.push({id: Date.now(), high_chemical_percentage: null, result_ph: null, phcurve_id: row.getData().id});
                subtable_tabulator.setData(row.getData().points);
            })
        ))));

        // Add subtable to row element
        $(row.getElement()).append(holder.append(add_button).append(subtable));

        // Only display it when the row is selected
        if (row.isSelected() && row.getData().hh == 0){
            holder.show();
        } else {
            holder.hide();
        }
      },
});

table.on("dataFiltered", update_phcurve_count_filtered);
table.on("dataLoaded", update_phcurve_count_loaded);

// Adding a new chemical button. Adds a new row to the table with nulls and begins its editing
$('#add-phcurve-button').click(function(){
    table.addRow({
        id: null,
        chemical_id: null,
        chemical: {
            id: null,
            name: null,
            aliases: [],
            unit: null
        },
        low_range: null,
        low_chemical_id: null,
        low_chemical: {
            id: null,
            name: null,
            aliases: [],
            unit: null
        },
        high_range: null,
        high_chemical_id: null,
        high_chemical: {
            id: null,
            name: null,
            aliases: [],
            unit: null
        },
        hh: 0,
        points: []
    }, true).then(function(row){
        // Reshow all columns when adding new chemical
        let columns = table.getColumns()
        for(i in columns){
            columns[i].show();
        }
        table.scrollToRow(row, "top", true);
        row_edit(row);
    });
});

// Refresh button
$('#reload-phcurves-button').click(function(){
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