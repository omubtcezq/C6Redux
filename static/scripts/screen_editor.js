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
    {id: 0, label: "", name: "Blue", value: "#1f77b4"}, 
    {id: 1, label: "", name: "Orange", value: "#ff7f0e"},
    {id: 2, label: "", name: "Green", value: "#2ca02c"},
    {id: 3, label: "", name: "Red", value: "#d62728"},
    {id: 4, label: "", name: "Purple", value: "#9467bd"},
    {id: 5, label: "", name: "Brown", value: "#8c564b"},
    {id: 6, label: "", name: "Pink", value: "#e377c2"},
    {id: 7, label: "", name: "Gray", value: "#7f7f7f"},
    {id: 8, label: "", name: "Olive", value: "#bcbd22"},
    {id: 9, label: "", name: "Cyan", value: "#17becf"}
];

var chemical_order_options = [
    {value: {id: "random", label: "Random Choice"}, label: "Random Choice"}, 
    {value: {id: "column", label: "By Columns"}, label: "By Columns"}, 
    {value: {id: "row", label: "By Rows"}, label: "By Rows"},
    {value: {id: "quadrant", label: "By Quadrants"}, label: "By Quadrants"}
];

var varied_attribute_distribution_options = [
    {value: {id: "gaussian", label: "Gaussian"}, label: "Gaussian"}, 
    {value: {id: "uniform", label: "Uniform"}, label: "Uniform"}, 
    {value: {id: "gaussian_sorted", label: "Gaussian (Sorted)"}, label: "Gaussian (Sorted)"}, 
    {value: {id: "uniform_sorted", label: "Uniform (Sorted)"}, label: "Uniform (Sorted)"}, 
    {value: {id: "well", label: "Stepwise (Well)"}, label: "Stepwise (Well)"}, 
    {value: {id: "column", label: "Stepwise (Column)"}, label: "Stepwise (Column)"}, 
    {value: {id: "row", label: "Stepwise (Row)"}, label: "Stepwise (Row)"},
    {value: {id: "quadrant", label: "Stepwise (Quadrant)"}, label: "Stepwise (Quadrant)"},
    {value: {id: "half", label: "Stepwise (Half)"}, label: "Stepwise (Half)"}
];

var factor_vary_options = [
    {value: {id: 'concentration', label: 'Concentration'}, label: 'Concentration'},
    {value: {id: 'ph', label: 'pH'}, label: 'pH'},
    {value: {id: 'none', label: 'None'}, label: 'None'}
];

function add_factor_to_group(row){
    // Adds data to original row and reloads the subtable. Unique id required and ignored when saving
    row.getData().factors.push({
        id: Date.now(), 
        chemical: {id: null, name: null, aliases: [], unit: null}, 
        concentration: null,
        unit: site_functions.ALL_UNITS[0],
        ph: null,
        vary: factor_vary_options[0].value,
        mean: null,
        min: null,
        max: null,
        relative_coverage: 1
    });
    let group_id = row.getData().id;
    let subtable_tabulator = Tabulator.findTable('#editor-group-subtable-'+group_id)[0];
    subtable_tabulator.setData(row.getData().factors);
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

// Tabulator table
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
        // Well name
        {
            title: "Factor Group", 
            field: "factor_group", 
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
            
        // Varied Attribute Distribution (previously Vary By)
        }, {
            title: "Varied Attribute Distribution", 
            field: "varied_attribute_distribution", 
            vertAlign: "middle",
            width: 185,
            editor: "list",
            editorParams: {values: varied_attribute_distribution_options},
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            }

        // Well Coverage
        }, {
            title: "Screen Coverage", 
            field: "screen_coverage", 
            width: 150,
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
        {column: "factor_group", dir: "asc"}
    ],
    rowFormatter: function(row, e) {
        var group_id = row.getData().id;
        var subtable = $('<div>').attr('id', 'editor-group-subtable-'+group_id).attr('class', 'subtable editor-group-subtable');
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
            
            // Mean
            }, {
                title: "Mean Varied", 
                field: "mean", 
                hozAlign: "right", 
                vertAlign: "middle",
                width: 85,
                editable: true,
                validator: function(cell, value){
                    // Ignore mean if no protperty is being varied
                    if (cell.getRow().getData().vary.id == 'none'){
                        return true;
                    }

                    // Get row and parent table row data
                    var factor_group_data = row.getData();
                    var factor_data = cell.getRow().getData();

                    // If the varied attribute distribution is not gaussian, then the mean is irrelevant
                    if (factor_group_data.varied_attribute_distribution.id != 'gaussian' && factor_group_data.varied_attribute_distribution.id != 'gaussian_sorted'){
                        return true;
                    }
                    
                    // Errors for mean concentration
                    if (cell.getRow().getData().vary.id == 'concentration'){
                        if (value == null || value == "" || typeof value !== "number" || value <= 0){
                            site_functions.alert_user("Mean concentration must be a positive number.");
                            return false;
                        } else if (factor_data.min >= value || factor_data.max <= value){
                            site_functions.alert_user("Mean concentration must be between minimum and maximum.");
                            return false;
                        } else {
                            return true;
                        }
                    
                    // Errors for mean pH
                    } else if (cell.getRow().getData().vary.id == 'ph'){
                        if (value == null){
                            return true;
                        } else if (typeof value !== "number" || value < 0 || value > 14){
                            site_functions.alert_user("Mean pH value must be between 0 and 14.");
                            return false;
                        } else if (factor_data.min >= value || factor_data.max <= value){
                            site_functions.alert_user("Mean pH must be between minimum and maximum.");
                            return false;
                        }  else {
                            return true;
                        }
                    }
                },
                editor: "number",
                sorter: "number"
            
            // Min
            }, {
                title: "Min Varied", 
                field: "min", 
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
                field: "max", 
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
                    cell.getRow().delete();
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true}]
        });

        // Holder of subtable contains add new alias button
        var holder = $('<div>').attr('class', 'holder-for-subtable');
        holder.css('background', row.getData().colour);
        
        // Add subtable to row element
        $(row.getElement()).append(holder.append(subtable));
        
    }
});

$('#screen-editor-automatic-add-group-button').click(function(){
    var num_groups = factor_group_table.getData().length;
    factor_group_table.addRow({id: Date.now(), 
                                 factor_group: "Group " + (num_groups+1), 
                                 colour: group_colours[num_groups % group_colours.length].value, 
                                 chemical_order: chemical_order_options[0].value, 
                                 varied_attribute_distribution: varied_attribute_distribution_options[0].value, 
                                 screen_coverage: 0,
                                 factors: []});
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