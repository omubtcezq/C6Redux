//# sourceURL=screen_maker.js
site_functions.CONTENT_PROVIDERS.screen_maker = (function() {

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// ========================================================================== //
// Private functions
// ========================================================================== //

const MAX_FACTOR_GROUPS = 10;

var group_colours = [
    {id: "Blue", label: "", value: "#1f77b4"}, 
    {id: "Orange", label: "", value: "#ff7f0e"},
    {id: "Green", label: "", value: "#2ca02c"},
    {id: "Red", label: "", value: "#d62728"},
    {id: "Purple", label: "", value: "#9467bd"},
    {id: "Brown", label: "", value: "#8c564b"},
    {id: "Pink", label: "", value: "#e377c2"},
    {id: "Gray", label: "", value: "#7f7f7f"},
    {id: "Olive", label: "", value: "#bcbd22"},
    {id: "Cyan", label: "", value: "#17becf"}
];

var chemical_order_options = [
    {value: {id: "random", label: "Random Choice"}, label: "Random Choice"}, 
    {value: {id: "column", label: "By Columns"}, label: "By Columns"}, 
    {value: {id: "row", label: "By Rows"}, label: "By Rows"},
    {value: {id: "quadrant", label: "By Quadrants"}, label: "By Quadrants"}
];

var varied_distribution_options = [
    {value: {id: "gaussian", label: "Trunc. Gaussian"}, label: "Trunc. Gaussian"}, 
    {value: {id: "uniform", label: "Uniform"}, label: "Uniform"}, 
    {value: {id: "stepwise", label: "Stepwise"}, label: "Stepwise"}
];

var varied_grouping_options = [
    {value: {id: "none", label: "No Grouping"}, label: "No Grouping"}, 
    {value: {id: "column", label: "By Columns"}, label: "By Columns"}, 
    {value: {id: "row", label: "By Rows"}, label: "By Rows"},
    {value: {id: "quadrant", label: "By Quadrants"}, label: "By Quadrants"},
    {value: {id: "half", label: "By Halves"}, label: "By Halves"}
];

var factor_vary_options = [
    {value: {id: 'concentration', label: 'Concentration'}, label: 'Concentration'},
    {value: {id: 'ph', label: 'pH'}, label: 'pH'},
    {value: {id: 'none', label: 'None'}, label: 'None'}
];

// Get value from id for the annoying dropdown lists
function value_from_id(id, options){
    for (var i=0; i<options.length; i++){
        if (options[i].value.id == id){
            return options[i].value;
        }
    }
    return null;
}

// UI fix for editing checkbox. Lets the whole cell be the toggle
function cellclick_flip_tick(e, cell){
    cell.setValue(!cell.getValue());
}

function add_factor_to_group(row){
    // Adds data to original row and reloads the subtable. Unique id required and ignored when saving
    row.getData().factors.push({
        id: Date.now(), 
        chemical: {id: null, name: null, aliases: [], unit: null}, 
        concentration: null,
        unit: site_functions.ALL_UNITS[0],
        ph: null,
        vary: factor_vary_options[0].value,
        varied_min: null,
        varied_max: null,
        relative_coverage: 1
    });
    let group_id = row.getData().id;
    let subtable_tabulator = Tabulator.findTable('#maker-group-subtable-'+group_id)[0];
    subtable_tabulator.setData(row.getData().factors);
}

function create_factor_groups_from_selected_wells(){
    var selected_wells = site_functions.get_selected_wells();
    if (selected_wells.length == 0){
        site_functions.alert_user("No wells selected.");
        return;
    }
    var query_str = ''
    for (i=0; i<selected_wells.length; i++){
        if (query_str){
            query_str += '&';
        }
        query_str = query_str+'well_ids='+selected_wells[i].id;
    }
    $.getJSON(site_functions.API_URL+'/screens/automaticScreenMakerFactorGroups?'+query_str, function(data){
        for (var i=0; i<data.length; i++){
            var g = data[i];
            g.id = i;
            g.colour = group_colours[i % group_colours.length].value;
            g.well_coverage = 0;
            // Fix dropdown displays
            g.chemical_order = value_from_id(g.chemical_order, chemical_order_options);
            g.varied_distribution = value_from_id(g.varied_distribution, varied_distribution_options);
            g.varied_grouping = value_from_id(g.varied_grouping, varied_grouping_options);
            for (var j=0; j<g.factors.length; j++){
                var f = g.factors[j];
                f.vary = value_from_id(f.vary, factor_vary_options);
            }
        }
        let factor_group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0];
        factor_group_table.setData(data);
    });
}

function create_screen_display(parent_element_id, element_id, rows, cols){
    // Tabulator columns
    var col_details = []
    for (var c = 0; c < cols; c++){
        col_details.push({
            title: c+1, 
            field: c.toString(),
            formatter: condition_formatter,
            headerSort: false,
            headerHozAlign: "center",
            editable: false,
            resizable: false,
            tooltip: cell_tooltip
        });
    }
    // Tabulator data (fixed, only cell wellconditions will change)
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var all_data = []
    for (var r = 0; r < rows; r++){
        var row_data = {row_id: r, row_letter: letters[r]};
        for (var c = 0; c < cols; c++){
            row_data[c.toString()] = {col_id: c, wellcondition: null};
        }
        all_data.push(row_data);
    }
    // Row height, keeps table roughly the same height as a 96 well table with 48px rows
    var row_height = Math.round((8/rows)*48);

    // The table
    var screen_display_tabulator = new Tabulator(element_id, {
        data: all_data,
        maxHeight: "100%",
        layout:"fitColumns",
        resizableColumnFit: true,
        headerVisible: true,
        columns: col_details,
        rowHeight: row_height,
        validationMode: 'manual',
        rowFormatter: row_formatter,
        rowHeader: {field: 'row_letter', formatter: row_header_formatter, headerSort: false, hozAlign: "center", vertAlign: 'middle', resizable: false},
        selectableRange:1,
        selectableRangeColumns:true,
        selectableRangeRows:true,
        selectableRangeClearCells:true,
        clipboard:true,
        clipboardCopyStyled:false,
        clipboardCopyConfig:{
            rowHeaders:false,
            columnHeaders:false,
        },
        clipboardCopyRowRange:"range",
        clipboardPasteParser:"range",
        clipboardPasteAction:"range"
    });
}

function update_automatic_screen_display(screen_display_table_id, factor_group_table_id, include_selection_conditions_checkbox_id){
    // TODO: Update the screen display table based on the factor groups
    // Also check if initial conditions need to be included
}

function row_formatter(row){
    row.getElement().style.backgroundColor = "#fff";
    row.getElement().style.borderTop = "1px solid #aaa";
}

function row_header_formatter(cell, formatterParams, onRendered){
    $(cell.getElement()).css('font-weight', '700');
    return cell.getValue();
}

function condition_formatter(cell, formatterParams, onRendered){
    return '';
}

function cell_tooltip(e, cell, onRendered){
    if (cell.getData().wellcondition == null){
        return "Empty Well";
    }
}

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
        title: "Dilution", 
        field: "dilution", 
        vertAlign: "middle",
        width: 100,
        resizable: false,
        headerSort: false,
        editor: "number",
        formatter: function(cell, formatterParams, onRendered){
            return cell.getValue() + '%';
        },
        editorEmptyValue: 0
    }]
});

// Factor group tabulator table
var factor_group_table = new Tabulator("#automatic-factor-groups-tabulator", {
    data: [],
    height: "100%",
    layout: "fitColumns",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholder: "No Factor Groups",
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
        // Name
        {
            title: "Factor Group", 
            field: "name", 
            vertAlign: "middle",
            headerSort: true,
            editor: "input"
        
        // Colour
        }, {
            title: "Colour", 
            field: "colour", 
            vertAlign: "middle",
            width: 55,
            headerSort: false,
            formatter: "color",
            editor: "list",
            editorParams: {
                values: group_colours,
                itemFormatter:function(label, value, item, element){
                    return '<div style="background-color: ' + value + '; height: 1em;"> </div>';
                },
            },
            cellEdited: function(cell){
                $(cell.getRow().getElement()).find('.holder-for-subtable').css('background', cell.getValue());
            }

        // Chemical Order (previously Location)
        }, {
            title: "Chemical Order", 
            field: "chemical_order", 
            vertAlign: "middle",
            width: 140,
            editor: "list",
            editorParams: {values: chemical_order_options},
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            }
            
        // Varied Attribute Distribution
        }, {
            title:"Varied Attribute",
            headerHozAlign : "center", 
            // Distribution
            columns: [{
                title: "Distribution", 
                field: "varied_distribution", 
                vertAlign: "middle",
                width: 115,
                editor: "list",
                editorParams: {values: varied_distribution_options},
                formatter: function(cell, formatterParams, onRendered){
                    return cell.getValue() ? cell.getValue().label : "";
                }

            // Order
            }, {
                title: "Grouping", 
                field: "varied_grouping", 
                vertAlign: "middle",
                width: 100,
                editor: "list",
                editorParams: {values: varied_grouping_options},
                formatter: function(cell, formatterParams, onRendered){
                    return cell.getValue() ? cell.getValue().label : "";
                }

            // Sorted
            }, {
                title: "Sorted", 
                field: "varied_sorted", 
                hozAlign: "center", 
                vertAlign: "middle",
                width: 76,
                // Rather than allowing editing, use the better UI for checkbox editing instead
                cellClick: cellclick_flip_tick,
                formatter: "tickCross",
                editable: false
            }]
            
        // Well Coverage
        }, {
            title: "Coverage of wells", 
            field: "well_coverage", 
            width: 77,
            hozAlign: "right", 
            vertAlign: "middle",
            editable: false,
            sorter: "number",
            formatter: function(cell, formatterParams, onRendered){
                $(cell.getElement()).css('color', '#999');
                return cell.getValue() + '%';
            },

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 250, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate button
            formatter: function (cell, formatterParams, onRendered){
                div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                    $('<tr>').append(
                        $('<td>').append(
                            $('<button>').
                            attr('class', 'add-button table-cell-button').
                            text('Add Factor')
                    ).append(
                        $('<td>').append(
                            $('<button>').
                            attr('class', 'delete-button table-cell-button').
                            text('Remove')
                        )
                    )
                    )));
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('delete-button')) {
                    cell.getRow().delete();
                }  else if (target.hasClass('add-button')){
                    add_factor_to_group(cell.getRow());
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
    rowFormatter: function(row, e) {
        var group_id = row.getData().id;
        var subtable = $('<div>').attr('id', 'maker-group-subtable-'+group_id).attr('class', 'subtable maker-group-subtable');

        // var other_subtable_ids = [];
        // for (var i=0; i<MAX_FACTOR_GROUPS; i++){
        //     if (i != group_id){
        //         other_subtable_ids.push("#maker-group-subtable-"+i);
        //     }
        // }
        // console.log("table ", group_id);
        // console.log(other_subtable_ids);

        // Factor in factrog group tabulator subtable
        var subtable_tabulator = new Tabulator(subtable[0], {
            //height: "100%",
            layout: "fitColumns",
            rowHeight: 48,
            data: row.getData().factors,
            editorEmptyValue: null,
            placeholder: "No Factors in Group",
            initialFilter: [],
            selectableRows: false,
            index: "id",
            validationMode: 'manual',
            movableRows: true,
            // moveableRowsConnectedTables: other_subtable_ids,
            // movableRowsReceiver: "add",
            // movableRowsSender: "delete",
            // rowHeader:{headerSort:false, resizable: false, minWidth:30, width:30, rowHandle:true, formatter:"handle"},

            // persistence: {
            //     sort: false,
            //     filter: false,
            //     headerFilter: false,
            //     group: true,
            //     page: false,
            //     columns: true,
            // },
            columns: [
            // Chemical
            {
                title: "Chemical", 
                field: "chemical", 
                vertAlign: "middle",
                editable: true,
                validator: function(cell, value){
                    // Check that the chemical object is there and that it has an id for a valid chemical
                    if (value == null || value == "" || value.id == null || value.id == ""){
                        site_functions.alert_user("Must select a chemical.");
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
                                var unit_cell = row.getCell('unit');
                                var conc_cell = row.getCell('concentration');
                                // New units found
                                if (unit_ind != -1){
                                    unit_cell.setValue(site_functions.ALL_UNITS[unit_ind]);
                                // New units not found
                                } else {
                                    unit_cell.setValue(site_functions.ALL_UNITS[0]);
                                }
                                // Reset concentration
                                conc_cell.setValue(null);
        
                            }
                        }
                },
                // Display only name and alias count from the chemical object in the cell
                formatter: function(cell, formatterParams, onRendered){
                    if (cell.getValue().name == null){
                        $(cell.getElement()).css('color', '#999');
                        return "Search chemicals ...";
                    } else {
                        $(cell.getElement()).css('color', '#333');
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
                field: "concentration", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 85,
                editable: true,
                validator: function(cell, value){
                    if (value == null || value == "" || typeof value !== "number" || value <= 0){
                        site_functions.alert_user("All concentrations must be positive numbers.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number"

            // Unit
            }, {
                title: "Unit", 
                field: "unit", 
                vertAlign: "middle",
                width: 65,
                editable: true,
                validator: function(cell, value){
                    if (value == null || value == ""){
                        site_functions.alert_user("All units must be specified.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "list",
                editorParams: {values: site_functions.ALL_UNITS}
            
            // pH
            }, {
                title: "pH", 
                field: "ph", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 55,
                editable: true,
                validator: function(cell, value){
                    if (value == null){
                        return true;
                    } else if (typeof value !== "number" || value < 0 || value > 14){
                        site_functions.alert_user("All pH values must be between 0 and 14.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "number",
                sorter: "number"

            // Relative Covarege
            }, {
                title: "Relative Coverage", 
                field: "relative_coverage", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 75,
                editable: true,
                editor: "number",
                editorParams:{
                    min: 0,
                    max: 100,
                    step: 1
                },
                sorter: "number"

            // Vary
            }, {
                title: "Vary", 
                field: "vary", 
                vertAlign: "middle",
                width: 100,
                editable: true,
                validator: function(cell, value){
                    if (value == null || value == ""){
                        site_functions.alert_user("Must Choose option for varying factor property.");
                        return false;
                    } else {
                        return true;
                    }
                },
                editor: "list",
                editorParams: {values: factor_vary_options},
                formatter: function(cell, formatterParams, onRendered){
                    return cell.getValue() ? cell.getValue().label : "";
                }

            // Min
            }, {
                title: "Min Varied", 
                field: "varied_min", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 80,
                editable: true,
                validator: function(cell, value){
                    // Ignore min if no protperty is being varied
                    if (cell.getRow().getData().vary.id == 'none'){
                        return true;
                    }

                    // Get row data
                    var factor_data = cell.getRow().getData();
                    
                    // Errors for min concentration
                    if (cell.getRow().getData().vary.id == 'concentration'){
                        if (value == null || value == "" || typeof value !== "number" || value <= 0){
                            site_functions.alert_user("Minimum concentration must be a positive number.");
                            return false;
                        } else if (factor_data.max <= value){
                            site_functions.alert_user("Minimum concentration must be smaller than maximum.");
                            return false;
                        } else {
                            return true;
                        }
                    
                    // Errors for min pH
                    } else if (cell.getRow().getData().vary.id == 'ph'){
                        if (value == null){
                            return true;
                        } else if (typeof value !== "number" || value < 0 || value > 14){
                            site_functions.alert_user("Minimum pH value must be between 0 and 14.");
                            return false;
                        } else if (factor_data.max <= value){
                            site_functions.alert_user("Minimum pH must be smaller than maximum.");
                            return false;
                        }  else {
                            return true;
                        }
                    }
                },
                editor: "number",
                sorter: "number"

            // Max
            }, {
                title: "Max Varied", 
                field: "varied_max", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 80,
                editable: true,
                validator: function(cell, value){
                    // Ignore max if no protperty is being varied
                    if (cell.getRow().getData().vary.id == 'none'){
                        return true;
                    }

                    // Get row data
                    var factor_data = cell.getRow().getData();
                    
                    // Errors for min concentration
                    if (cell.getRow().getData().vary.id == 'concentration'){
                        if (value == null || value == "" || typeof value !== "number" || value <= 0){
                            site_functions.alert_user("Maximum concentration must be a positive number.");
                            return false;
                        } else if (factor_data.min >= value){
                            site_functions.alert_user("Maximum concentration must be larger than minimum.");
                            return false;
                        } else {
                            return true;
                        }
                    
                    // Errors for min pH
                    } else if (cell.getRow().getData().vary.id == 'ph'){
                        if (value == null){
                            return true;
                        } else if (typeof value !== "number" || value < 0 || value > 14){
                            site_functions.alert_user("Maximum pH value must be between 0 and 14.");
                            return false;
                        } else if (factor_data.min >= value){
                            site_functions.alert_user("Maximum pH must be larger than minimum.");
                            return false;
                        }  else {
                            return true;
                        }
                    }
                },
                editor: "number",
                sorter: "number"
            
            // Action buttons
            }, {
            title: "", 
            field: "actions", 
            width: 100, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate buttons
            formatter: function (cell, formatterParams, onRendered){
                div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                    $('<tr>').append(
                        $('<td>').append(
                            $('<button>').
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
                    // Remove factor from group table
                    row.getData().factors = row.getData().factors.filter(function(f){
                        return f.id != cell.getRow().getData().id;
                    });
                    // Remove factor from display table
                    cell.getTable().setData(row.getData().factors);
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true}]
        });

        // Holder of subtable
        var holder = $('<div>').attr('class', 'holder-for-subtable');
        holder.css('background', row.getData().colour);
        
        // Add subtable to row element
        $(row.getElement()).append(holder.append(subtable));
        
    }
});

// Current design tabulator table
create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 8, 12);

// Current design details tabulator table (on edit changes the current design table created above)
var current_maker_details_table = new Tabulator('#current-maker-details-tabulator', {
    data: [{id: 1, apiuser: {id: null, username: null}, size: 96, name: 'New Screen ' + new Date(Date.now()).toLocaleString().split(',')[0]}],
    layout: "fitColumns",
    rowHeight: 48,
    editorEmptyValue: null,
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    // Name
    columns: [{
        title: "Name", 
        field: "name", 
        vertAlign: "middle",
        headerSort: false,
        editor: "input",
        editable: true

    // Creator
    }, {
        title: "Creator", 
        field: "apiuser", 
        vertAlign: "middle",
        width: 135,
        editable: true,
        validator: function(cell, value){
            // Check that the chemical object is there and that it has an id for a valid chemical
            if (value == null || value == "" || value.id == null || value.id == ""){
                site_functions.alert_user("You must specify a creator.");
                return false;
            } else {
                return true;
            }
        },
        headerSort: false,
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
        // Format cell to display only the username from the apisuer object
        formatter: function(cell, formatterParams, onRendered){
            if (cell.getValue().id){
                $(cell.getElement()).css('color', '#333');
                return cell.getValue().username;
            } else {
                $(cell.getElement()).css('color', '#999');
                return "Select a user ...";
            }
            
        }
    
    // Size
    }, {
        title: "Size", 
        field: "size", 
        vertAlign: "middle",
        width: 80,
        editable: true,
        validator: function(cell, value){
            if (value == null || value == ""){
                site_functions.alert_user("Must Choose option for new screen size.");
                return false;
            } else {
                return true;
            }
        },
        headerSort: false,
        editor: "list",
        editorParams: {values: [24, 48, 96]},
        editorEmptyValue: 96,
        cellEdited:function(cell){
            // Destroy old table
            Tabulator.findTable("#current-maker-tabulator")[0].destroy();
            // Make new one depending on size
            var size = cell.getValue();
            if (size == 24){
                create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 4, 6);
            } else if (size == 48){
                create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 6, 8);
            } else {
                create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 8, 12);
            }
        }
    }]
});

// Buttons
$('#screen-maker-automatic-add-group-button').click(function(){
    // Limit number of factor groups (ideally to allow for movable rows between them)
    var num_groups = factor_group_table.getData().length;
    if (num_groups >= MAX_FACTOR_GROUPS){
        site_functions.alert_user("The maximum number of factor groups ("+MAX_FACTOR_GROUPS+") has been reached.");
        return;
    }
    // Find the next available id
    for (var next_id = 0; next_id < MAX_FACTOR_GROUPS; next_id++){
        var found = false;
        for (var g = 0; g < num_groups; g++){
            if (factor_group_table.getData()[g].id == next_id){
                found = true;
                break;
            }
        }
        if (!found){
            break;
        }
    }
    // Create new group
    factor_group_table.addRow({
        id: next_id, 
        name: "Group " + (next_id+1), 
        colour: group_colours[next_id % group_colours.length].value, 
        chemical_order: chemical_order_options[0].value, 
        varied_distribution: varied_distribution_options[0].value, 
        varied_grouping: varied_grouping_options[0].value,
        sorted: false,
        well_coverage: 0,
        factors: []
    });
});

$("#automatic-maker-button").click(function(){
    // Buttons
    $("#manual-maker-button").removeAttr("disabled");
    $("#automatic-maker-button").attr("disabled", "disabled");

    // Sections
    $("#manual-maker-div").hide();
    $("#automatic-maker-div").show();
});

$("#manual-maker-button").click(function(){
    // Buttons
    $("#automatic-maker-button").removeAttr("disabled");
    $("#manual-maker-button").attr("disabled", "disabled");

    // Sections
    $("#automatic-maker-div").hide();
    $("#manual-maker-div").show();
});

// Default start in automatic screen maker
$("#automatic-maker-button").click();

// Generate automatic screen from selected wells button
$('#screen-maker-automatic-generate-button').click(create_factor_groups_from_selected_wells);


// Propagate message passing after tables have loaded
Promise.all([]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();