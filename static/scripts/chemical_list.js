//# sourceURL=chemical_list.js
var chemicals = (function() {

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
    // Get alias subtable and validate it too
    var alias_table = Tabulator.findTable('#alias-subtable-'+row.getData().id)[0];
    var alias_table_rows = alias_table.getRows();
    for (i in alias_table_rows){
        var alias_table_cells = alias_table_rows[i].getCells();
        for (j in alias_table_cells){
            if (alias_table_cells[j].validate() !== true){
                return;
            }
        }
    }

    // Make expected data object
    var chemical = $.extend(true, {}, row.getData());
    // Remove added property for button column
    delete chemical.actions;
    // Remove ids from aliases (these are no longer db ids but rather tabulator ids)
    for (i in chemical.aliases){
        delete chemical.aliases[i].id;
    }

    // Either update a chemical or add a new one. This is checked by looking at the id
    if (chemical.id === null){
        // New chemical being added, remove the null id as a new one will be recieved
        delete chemical.id;
        // Similarly for the chemical ids of the aliases
        for (i in chemical.aliases){
            delete chemical.aliases[i].chemical_id;
        }

        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'POST',
                url: API_URL+'/chemicals/create', 
                data: JSON.stringify(chemical), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success replace row with contents of returned new chemical
                success: function(returned_chemical) {
                    table.updateRow(row, returned_chemical);
                    // Old data can be dropped
                    delete row.getData().old_data
                    // Id needs to be manually updated
                    row.getData().id = returned_chemical.id
                    // Update row count
                    update_chemical_count_loaded(table.getData());
                    // Refresh filters
                    table.refreshFilter();
                    // Finish editing row
                    stop_editing(table);
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        authorise_action(null, to_authorise);
    // Otherwise updating an existing chemical
    } else {
        // First see how many places the chemical is used
        $.ajax({
            type: 'GET',
            url: API_URL+'/chemicals/useOfChemical?chemical_id=' + chemical.id,
            success: function(counter){
                // Function to authorise and make api call
                edit_call = function (){
                    to_authorise = function(auth_token){
                        $.ajax({
                            type: 'PUT',
                            url: API_URL+'/chemicals/update', 
                            data: JSON.stringify(chemical), 
                            headers: {"Authorization": "Bearer " + auth_token},
                            // On success replace with contents of returned chemical (shouldn't be different)
                            success: function(returned_chemical) {
                                table.updateRow(chemical.id, returned_chemical);
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
                                    authorise_action(msg, to_authorise);
                                }
                            },
                            dataType: 'json',
                            contentType: 'application/json'
                        });
                    }
                    authorise_action(null, to_authorise);
                };
                // If the chemical is not used anywhere, perform the edit
                if (counter.well_count == 0 && counter.stock_count == 0){
                    edit_call();
                // Otherwise warn the user about all the places the chemical is used before editing
                } else {
                    confirm_action("The chemical you wish to edit is used in:\n" + 
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
    var chemical_id_to_remove = row.getData().id;

    // First see how many places the chemical is used
    $.ajax({
        type: 'GET',
        url: API_URL+'/chemicals/useOfChemical?chemical_id=' + chemical_id_to_remove,
        success: function(counter){
            // Function to authorise and make api call
            delete_call = function (){
                to_authorise = function(auth_token){
                    $.ajax({
                        type: 'DELETE',
                        url: API_URL+'/chemicals/delete?chemical_id='+chemical_id_to_remove,
                        headers: {"Authorization": "Bearer " + auth_token},
                        // On success remove chemical
                        success: function() {
                            table.deleteRow(row);
                            // Update row count
                            update_chemical_count_loaded(table.getData());
                            // Refresh filters
                            table.refreshFilter();
                        },
                        // On authentication error, request login
                        error: function(xhr, status, error){
                            if (xhr.status == 401) {
                                msg = 'Please log in again';
                                authorise_action(msg, to_authorise);
                            }
                        },
                        dataType: 'json',
                        contentType: 'application/json'
                    });
                }
                authorise_action(null, to_authorise);
            };
            // If the chemical is not used anywhere, perform the delete
            if (counter.well_count == 0 && counter.stock_count == 0){
                confirm_action("This will delete the selected chemical from the database.", delete_call);
            // Otherwise warn the user about all the places the chemical is used and do not allow removal
            } else {
                alert_user("The chemical you wish to delete is used in:\n" + 
                           counter.condition_count + (counter.condition_count==1 ? " condition," : " conditions,") + " " +
                           counter.well_count + (counter.well_count==1 ? " well," : " wells,") + " " +
                           counter.screen_count + (counter.screen_count==1 ? " screen and" : " screens and") + " " +
                           counter.stock_count + (counter.stock_count==1 ? " stock." : " stocks.") + "\n" +
                           "You cannot delete it until it is not in use");
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
    let columns_with_null_filter = ["formula", "density", "solubility", "pka1", "pka2", "pka3", "ions", "monomer", "chemical_abstracts_db_id", "critical_micelle_concentration", "smiles"]
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
function update_chemical_count_loaded(data){
    $('#chemical-row-count').text(data.length + ' Chemicals');
}

// Function for custom footer to show number of chemicals when filter run
function update_chemical_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#filtered-chemical-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#filtered-chemical-row-count').text('');
    }
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Tabulator table
var table = new Tabulator("#chemical-tabulator", {
    ajaxURL: API_URL+"/chemicals/all",
    height: "100%",
    layout: "fitData",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Chemicals",
    initialFilter:[],
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    renderVerticalBuffer: 4800,
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
                    alert_user("You must specify a chemical name.");
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
                            alert_user("A chemical with the same name already exists.\nCannot have multiple chemicals of the same name.");
                            return false;
                        }
                    }
                    return true;
                }
            },
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.name.toLowerCase().includes(term.toLowerCase())){
                    return true;
                } else {
                    for (i in row_data.aliases){
                        if (row_data.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
                            return true;
                        }
                    }
                }
                return false;
            },
            // Display alias count in brackets after name
            formatter: function(cell, formatterParams, onRendered){
                if (is_selected(cell)){
                    return cell.getData().name
                } else {
                    return cell.getData().name + (cell.getData().aliases.length ? ' (aliases: ' + cell.getData().aliases.length + ')' : "");
                }
            }
            
        // Formula
        }, {
            title: "Formula", 
            field: "formula", 
            vertAlign: "middle",
            width: 300,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
            
        // pKa1
        }, {
            title: "pKa1", 
            field: "pka1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 90,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    alert_user("pKas must be either null or between 0 and 14.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // pKa2
        }, {
            title: "pKa2", 
            field: "pka2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 90,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    alert_user("pKas must be either null or between 0 and 14.");
                    return false;
                } else if (cell.getData().pka1 == null){
                    alert_user("pKa1 must not be null if entering pKa2.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
        // pKa3
        }, {
            title: "pKa3", 
            field: "pka3", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 90,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    alert_user("pKas must be either null or between 0 and 14.");
                    return false;
                } else if (cell.getData().pka1 == null || cell.getData().pka2 == null){
                    alert_user("pKa1 and pKa2 must not be null if entering pKa3.");
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
                    alert_user("Density must be greater than 0.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Molecular Weight
        }, {
            title: "Molecular Weight", 
            field: "molecular_weight", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 175,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || typeof value !== "number" || value <= 0){
                    alert_user("You must specify a positive molecular weight.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
        // Solubility
        }, {
            title: "Solubility", 
            field: "solubility", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value <= 0){
                    alert_user("Solubility must be greater than 0.");
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
            title: "Concentration Unit", 
            field: "unit", 
            vertAlign: "middle",
            width: 185,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || value == ""){
                    alert_user("You must specify a unit.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "list",
            editorParams: {values: ALL_UNITS},
            headerFilter: "list",
            headerFilterParams: {values: ALL_UNITS},
            headerFilterPlaceholder: "Filter"
            
        // Ions
        }, {
            title: "Ions", 
            field: "ions", 
            vertAlign: "middle",
            width: 85,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Monomer
        }, {
            title: "Monomer", 
            field: "monomer", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Chemical Abstracts DB ID
        }, {
            title: "Chemical Abstracts DB ID", 
            field: "chemical_abstracts_db_id", 
            vertAlign: "middle",
            width: 230,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Critical Micelle Concentration
        }, {
            title: "Critical Micelle Concentration", 
            field: "critical_micelle_concentration", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 255,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value <= 0){
                    alert_user("Critical Micelle Concentration must be greater than 0.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // SMILES
        }, {
            title: "SMILES", 
            field: "smiles", 
            vertAlign: "middle",
            width: 110,
            headerMenu: column_menu,
            editable: is_selected,
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"

        // Frequent stock column group
        }, {
            title:"Frequently Made Stock",
            headerHozAlign : "center", 
            // FrequentStock Concentration
            columns: [{
                title: "Concentration", 
                field: "frequentstock.concentration", 
                hozAlign: "right", 
                vertAlign: "middle",
                widthGrow: 1,
                width: 105,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    unit_is_null = cell.getData().frequentstock.unit == null || cell.getData().frequentstock.unit == ''
                    conc_is_null = value == null || value == ""
                    if (conc_is_null && unit_is_null){
                        return true;
                    } else if (!conc_is_null && unit_is_null){
                        alert_user("Frequent stock concentration is missing its unit.");
                        return false;
                    } else if (conc_is_null || typeof value !== "number" || value <= 0){
                        alert_user("Frequent stock concentration must be greater than 0.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // FrequentStock Unit
            }, {
                title: "Unit", 
                field: "frequentstock.unit", 
                vertAlign: "middle",
                width: 85,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    conc_is_null = cell.getData().frequentstock.concentration == null || cell.getData().frequentstock.concentration == ''
                    unit_is_null = value == null || value == ""
                    if (unit_is_null && conc_is_null){
                        return true;
                    } else if (!unit_is_null && conc_is_null) {
                        return true; // Pass validation because concentration won't and one needs to to allow changing
                    } else if (unit_is_null){
                        alert_user("Frequent stock unit is required if its concentration is given.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "list",
                editorParams: {values: ALL_UNITS, clearable: true},
                headerFilter: "list",
                headerFilterParams: {values: ALL_UNITS},
                headerFilterPlaceholder: "Filter"

            // Precipitation Concentration
            }, {
                title: "Precipitation Concentration", 
                field: "frequentstock.precipitation_concentration", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 195,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    precip_conc_unit_is_null = cell.getData().frequentstock.precipitation_concentration_unit == null || cell.getData().frequentstock.precipitation_concentration_unit == ''
                    precip_conc_is_null = value == null || value == ""
                    if (precip_conc_is_null && precip_conc_unit_is_null){
                        return true;
                    } else if (!precip_conc_is_null && precip_conc_unit_is_null) {
                        alert_user("Stock precipitation concentration is missing its unit.");
                        return false;
                    } else if (precip_conc_is_null || typeof value !== "number" || value <= 0){
                        alert_user("Stock precipitation concentration must be greater than 0.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // Precipitation Concentration Unit
            }, {
                title: "Precipitation Concentration Unit", 
                field: "frequentstock.precipitation_concentration_unit", 
                vertAlign: "middle",
                width: 270,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    precip_conc_is_null = cell.getData().frequentstock.precipitation_concentration == null || cell.getData().frequentstock.precipitation_concentration == ''
                    precip_conc_unit_is_null = value == null || value == ""
                    if (precip_conc_unit_is_null && precip_conc_is_null){
                        return true;
                    } else if (!precip_conc_unit_is_null && precip_conc_is_null){
                        return true; // Pass validation because concentration won't and one needs to to allow changing
                    } else if (precip_conc_unit_is_null){
                        alert_user("Stock precipitation unit is required if its concentration is given.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "list",
                editorParams: {values: ALL_UNITS, clearable: true},
                headerFilter: "list",
                headerFilterParams: {values: ALL_UNITS},
                headerFilterPlaceholder: "Filter"
            }],

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
            resizable: false, 
            frozen: true
    }],
    initialSort: [
        {column: "name", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'chemical-row-count')).append($('<span>').attr('id', 'filtered-chemical-row-count')).prop('outerHTML'),
    rowFormatter: function(row, e) {
        var chem_id = row.getData().id;
        var subtable = $('<div>').attr('id', 'alias-subtable-'+chem_id).attr('class', 'subtable alias-subtable');
        var subtable_tabulator = new Tabulator(subtable[0], {
            layout: "fitColumns",
            data: row.getData().aliases,
            selectableRows: false,
            rowHeight: 48,
            placeholder: "No Aliases",
            validationMode: 'manual',
            columns: [{
                title: "Alias",
                field: "name",
                vertAlign: "middle",
                editor: "input",
                validator: function(cell, value){
                    if (value == null || value == ""){
                        alert_user("Chemical aliases must have a name specified.");
                        return false;
                    } else {
                        var all_data = row.getTable().getData();
                        var this_alias = cell.getData();
                        for (i in all_data){
                            var chemical = all_data[i];
                            if (chemical.name == value){
                                alert_user("Chemical "+chemical.name+" is named the same as a given alias.\nCannot name alises the same as an existing chemical.");
                                return false;
                            }
                            for (j in chemical.aliases){
                                var alias = chemical.aliases[j];
                                if (alias.id == this_alias.id){
                                    continue;
                                }
                                if (alias.name == value){
                                    alert_user("Chemical "+chemical.name+" has the same alias as one given.\nCannot have multiple aliases of the same name.");
                                    return false;
                                }
                            }
                        }
                        return true;
                    }
                },
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
                        var alias_cell_id = cell.getData().id;
                        row.getData().aliases = row.getData().aliases.filter(function(a){return a.id != alias_cell_id});

                        // TODO causes tabulator warning - how to get rid of it??
                        cell.getTable().replaceData(row.getData().aliases);
                    }
                }, 
                headerSort: false, 
                hozAlign: "center", 
                vertAlign: "middle", 
                resizable: false
            }]
        });

        // Holder of subtable contains add new alias button
        var holder = $('<div>').attr('class', 'holder-for-subtable');
        var add_button = $('<table>').append($('<tbody>').append($('<tr>').append($('<td>').append(
            $('<button>').attr('id', 'add-alias-'+chem_id).attr('class', 'table-cell-button add-button').text('Add Alias').click(function(){
                // Adds data to original row and reloads the subtable. Unique id required and ignored when saving
                row.getData().aliases.push({id: Date.now(), name: null, chemical_id: row.getData().id});
                subtable_tabulator.setData(row.getData().aliases);
            })
        ))));

        // Add subtable to row element
        $(row.getElement()).append(holder.append(add_button).append(subtable));

        // Only display it when the row is selected
        if (row.isSelected()){
            holder.show();
        } else {
            holder.hide();
        }
      },
});

table.on("dataFiltered", update_chemical_count_filtered);
table.on("dataLoaded", update_chemical_count_loaded);

// Adding a new chemical button. Adds a new row to the table with nulls and begins its editing
$('#add-chemical-button').click(function(){
    table.addRow({
        id: null,
        available: 1,
        name: null,
        formula: null,
        pka1: null,
        pka2: null,
        pka3: null,
        density: null,
        molecular_weight: null,
        solubility: null,
        unit: ALL_UNITS[0],
        ions: null,
        monomer: null,
        chemical_abstracts_db_id: null,
        critical_micelle_concentration: null,
        smiles: null,
        frequentstock: {
            concentration: null,
            unit: null,
            precipitation_concentration: null,
            precipitation_concentration_unit: null
        },
        aliases: []
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
$('#reload-chemicals-button').click(function(){
    table.setData();
    table.clearFilter(true);
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();