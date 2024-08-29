//# sourceURL=chemical_list.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Remove selection and reformat rows to display edit and delete buttons
function stop_editing(table){
}

// Begin editing row
function row_edit(row){
}

// Save row being edited
function row_save(row){
}

// Cancel editing of row
function row_cancel(row){
}

// Delete row
function row_delete(row){
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
    persistence: {
        sort: false,
        filter: false,
        headerFilter: false,
        group: true,
        page: false,
        columns: true,
    },
    columns: [
        // Available
        {
            title: "Available", 
            field: "available", 
            hozAlign: "center", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 20,
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
            widthGrow: 5,
            minWidth: 350,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null || value == ""){
                    alert_user("You must specify a chemical name.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "input",
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
            
        // Formula
        }, {
            title: "Formula", 
            field: "formula", 
            vertAlign: "middle",
            widthGrow: 4,
            minWidth: 300,
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
            widthGrow: 1,
            minWidth: 75,
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
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // pKa2
        }, {
            title: "pKa2", 
            field: "pka2", 
            hozAlign: "right", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 75,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    alert_user("pKas must be either null or between 0 and 14.");
                    return false;
                } else if (cell.getRow().getValue('pka1') == null){
                    alert_user("pKa1 must not be null if entering pKa2.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
        // pKa3
        }, {
            title: "pKa3", 
            field: "pka3", 
            hozAlign: "right", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 75,
            headerMenu: column_menu,
            editable: is_selected,
            validator: function(cell, value){
                if (value == null){
                    return true;
                } else if (typeof value !== "number" || value < 0 || value > 14){
                    alert_user("pKas must be either null or between 0 and 14.");
                    return false;
                } else if (cell.getRow().getValue('pka1') == null || cell.getRow().getValue('pka2') == null){
                    alert_user("pKa1 and pKa2 must not be null if entering pKa3.");
                    return false;
                } else {
                    return true;
                }
            },
            editor: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
            // Density
        }, {
            title: "Density", 
            field: "density", 
            hozAlign: "right", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 105,
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
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Molecular Weight
        }, {
            title: "Molecular Weight", 
            field: "molecular_weight", 
            hozAlign: "right", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 175,
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
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            
        // Solubility
        }, {
            title: "Solubility", 
            field: "solubility", 
            hozAlign: "right", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 100,
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
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Unit
        }, {
            title: "Concentration Unit", 
            field: "unit", 
            vertAlign: "middle",
            widthGrow: 1,
            minWidth: 85,
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
            widthGrow: 4,
            minWidth: 100,
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
            widthGrow: 4,
            minWidth: 120,
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
            widthGrow: 4,
            minWidth: 230,
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
            widthGrow: 1,
            minWidth: 255,
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
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // SMILES
        }, {
            title: "SMILES", 
            field: "smiles", 
            vertAlign: "middle",
            widthGrow: 4,
            minWidth: 110,
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
                minWidth: 105,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    if (value == null && cell.getRow().getValue('frequentstock.unit') == null && cell.getRow().getValue('frequentstock.precipitation_concentration') == null){
                        return true;
                    } else if (value == null || typeof value !== "number" || value <= 0){
                        alert_user("You must specify a positive concentration when specifying a frequently made stock.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // Precipitation Concentration
            }, {
                title: "Precipitation Concentration", 
                field: "frequentstock.precipitation_concentration", 
                hozAlign: "right", 
                vertAlign: "middle",
                widthGrow: 1,
                minWidth: 105,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    if (value == null){
                        return true;
                    } else if (typeof value !== "number" || value <= 0){
                        alert_user("Precipitation concentration must be greater than 0.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                headerFilter: "number",
                headerFilterPlaceholder: "Filter"

            // FrequentStock Unit
            }, {
                title: "Unit", 
                field: "frequentstock.unit", 
                vertAlign: "middle",
                widthGrow: 1,
                minWidth: 85,
                headerMenu: column_menu,
                editable: is_selected,
                validator: function(cell, value){
                    if (value == null && cell.getRow().getValue('frequentstock.concentration') == null && cell.getRow().getValue('frequentstock.precipitation_concentration') == null){
                        return true;
                    } else if (value == null || value == ""){
                        alert_user("You must specify a unit when specifying a frequently made stock.");
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
            }],

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 170, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate buttons
            formatter: function formatter_buttons(cell, formatterParams, onRendered){
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
            cellClick: function cellclick_action(e, cell){
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
            frozen: true}
    ],
    initialSort: [
        {column: "name", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'chemical-row-count')).append($('<span>').attr('id', 'filtered-chemical-row-count')).prop('outerHTML')
});

table.on("dataFiltered", update_chemical_count_filtered);
table.on("dataLoaded", update_chemical_count_loaded);

// Refresh button
$('#reload-chemicals-button').click(function(){
    table.setData();
    table.clearFilter(true);
});

});
})();