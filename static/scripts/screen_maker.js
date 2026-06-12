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
var last_selected_cell = null

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
    {value: {id: "random", label: "Random"}, label: "Random"}, 
    {value: {id: "column", label: "Columns"}, label: "Columns"}, 
    {value: {id: "row", label: "Rows"}, label: "Rows"},
    {value: {id: "quadrant", label: "Quadrants"}, label: "Quadrants"},
    {value: {id: "uniform", label: "Uniform"}, label: "Uniform"},
    {value: {id: "stepwise", label: "Stepwise"}, label: "Stepwise"}
];

var varied_distribution_options = [
    {value: {id: "gaussian", label: "Trunc. Gaussian"}, label: "Trunc. Gaussian"}, 
    {value: {id: "uniform", label: "Uniform"}, label: "Uniform"}
];

var varied_grouping_options = [
    {value: {id: "none", label: "No Order"}, label: "No Order"}, 
    {value: {id: "series", label: "Series"}, label: "Series"}, 
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
        query_str = query_str+'well_ids='+selected_wells[i].well.id;
    }
    $.getJSON(site_functions.API_URL+'/screens/automaticScreenMakerFactorGroups?'+query_str, function(data){
        for (var i=0; i<data.length; i++){
            var g = data[i];
            g.id = i;
            g.colour = group_colours[i % group_colours.length].value;
            // Fix dropdown displays
            g.chemical_order = value_from_id(g.chemical_order, chemical_order_options);
            g.varied_distribution = value_from_id(g.varied_distribution, varied_distribution_options);
            g.varied_grouping = value_from_id(g.varied_grouping, varied_grouping_options);
            grouped = Object.groupBy(g.factors, (f) => f.chemical.name)
            for (var j=0; j<g.factors.length; j++){
                var f = g.factors[j];
                f.id = i+"_"+j;
                f.vary = value_from_id(f.vary, factor_vary_options);
            }
        }
        let factor_group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0];
        factor_group_table.setData(data);
    });
}

function create_screen_display(parent_element_id, element_id, rows, cols, all_data = null){
    if (all_data == null) {
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
                cssClass: "no-padding",
                cellContext: function(e, cell) {
                    e.preventDefault();
                    last_selected_cell = cell
                    Tabulator.findTable("#condition-popup-tabulator")[0].setData(cell.getValue())

                    top = Math.min(e.clientY, window.innerHeight - $('#condition-popup').outerHeight())
                    left = Math.min(e.clientX, window.innerWidth - $('#condition-popup').outerWidth())
                    $('#condition-popup').css('top', e.clientY + 'px');
                    $('#condition-popup').css('left', left + 'px');

                    $('#condition-popup').show();
                }
            });
        }
        // Tabulator data (fixed, only cell wellconditions will change)
        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        var all_data = []
        for (var r = 0; r < rows; r++){
            var row_data = {row_letter: letters[r]};
            for (var c = 0; c < cols; c++){
                row_data[c.toString()] = null;
            }
            all_data.push(row_data);
        }
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
        selectableRange:0,
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
        clipboardPasteAction:"range",
    });

    $(document).on('click', function(event) {
        if ($(event.target).closest('#condition-popup').length == 0) {
            $("#condition-popup").hide()
        }
        
        if ($(event.target).closest('#current-maker-tabulator').length == 0) {
            // if (Tabulator.findTable("#current-maker-tabulator")[0].getRanges().length != 0) {
            //     const screen_display_tabulator = Tabulator.findTable(element_id)[0]
            //     data = screen_display_tabulator.getData()
            //     screen_display_tabulator.destroy()
            //     new_screen_display_tabulator = new Tabulator(element_id, {
            //     data: data,
            //     maxHeight: "100%",
            //     layout:"fitColumns",
            //     resizableColumnFit: true,
            //     headerVisible: true,
            //     columns: col_details,
            //     rowHeight: row_height,
            //     validationMode: 'manual',
            //     rowFormatter: row_formatter,
            //     rowHeader: {field: 'row_letter', formatter: row_header_formatter, headerSort: false, hozAlign: "center", vertAlign: 'middle', resizable: false},
            //     selectableRange:0,
            //     selectableRangeColumns:true,
            //     selectableRangeRows:true,
            //     selectableRangeClearCells:true,
            //     clipboard:true,
            //     clipboardCopyStyled:false,
            //     clipboardCopyConfig:{
            //         rowHeaders:false,
            //         columnHeaders:false,
            //     },
            //     clipboardCopyRowRange:"range",
            //     clipboardPasteParser:"range",
            //     clipboardPasteAction:"range"
            //     });
            // }
        } else {
            if (Tabulator.findTable("#current-maker-tabulator")[0].getRanges().length == 0) {
                const screen_display_tabulator = Tabulator.findTable(element_id)[0]
                data = screen_display_tabulator.getData()
                screen_display_tabulator.destroy()
                new_screen_display_tabulator = new Tabulator(element_id, {
                    data: data,
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
                    clipboardPasteAction:"range",
                    
            });
        }
    }
});
}

function set_required_regeneration_of_current_screen_from_automatic(){
    $('#current-maker-tabulator-automatic-update-popup').show();
}

function generate_current_screen_from_automatic(){

    const group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0]
    group_data = group_table.getData();

    var display_table = Tabulator.findTable("#current-maker-tabulator")[0]
    const grid_rows = display_table.getRows().length;
    const grid_cols = display_table.getColumns().length - 1; // -1 because the title for each row is included

    range_dimensions = null
    if (display_table.getRanges().length != 0) {
        const ranges = display_table.getRanges();
        let range = ranges[0];
        // -1 because the title of each row is included
        range_dimensions = {"left": range.getLeftEdge() - 1, "right": range.getRightEdge() - 1, "top": range.getTopEdge(), "bottom": range.getBottomEdge()} 
    }

    additive_data = Tabulator.findTable("#automatic-additive-tabulator")[0].getData()[0]
    additive_query = {"additive": additive_data.screen, "dilution": additive_data.dilution}

    fetch(site_functions.API_URL+'/screens/conditionGrid', {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            factor_groups: group_data.map(group => {
                group.chemical_order = group.chemical_order.id
                group.varied_distribution = group.varied_distribution.id
                group.varied_grouping = group.varied_grouping.id
                group.factors.map(factor => {
                    factor.vary = factor.vary.id
                    return factor
                })
                group.group_name = group.factor_group
                return group
            }),
            additive_and_dilution: additive_data.screen.id != null ? additive_query : null,
            included_wells_ids: $("#screen-maker-automatic-include-selected-checkbox").is(":checked") ? site_functions.get_selected_wells().map(w => w.well.id) : [],
            // if the size is not based on user selection then its one of the defaults
            size: grid_rows * grid_cols,
            range_dimensions: Tabulator.findTable("#current-maker-tabulator")[0].getRanges().length != 0 ? range_dimensions : null
        })
        }).then(r => {
            return r.json()
        }).then (json => {
            console.log(json)
            var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            var all_data = []
            for (var r = 0; r < grid_rows; r++){
                var row_data = {row_letter: letters[r]};
                for (var c = 0; c < grid_cols; c++){
                    row_data[c.toString()] = []
                }
                all_data.push(row_data);
            }

            for (var r = 0; r < grid_rows; r++){
                var row_data = all_data[r];
                for (var c = 0; c < grid_cols; c++){
                    row_data[c.toString()] = json[r][c].condition
                }
            }

            const range = Tabulator.findTable("#current-maker-tabulator")[0].getRanges()[0];
            console.log(range)

            if (range) {
                const bounds = range.getBounds();

                var startRow = range.getTopEdge();
                var startCol = range.getLeftEdge();
                var endRow = range.getBottomEdge();
                var endCol = range.getRightEdge();
            }

            display_table.setData(all_data).then(() => {
                if (range) {
                    display_table = Tabulator.findTable("#current-maker-tabulator")[0]
                    console.log(startRow)

                    var topLeft = display_table.getRows()[startRow].getCells()[startCol];
                    var bottomRight = display_table.getRows()[endRow].getCells()[endCol];

                    display_table.addRange(topLeft, bottomRight);
                }
            });

            // Hide the popup requesting regeneration if it case it's up
            $('#current-maker-tabulator-automatic-update-popup').hide();
        });
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

    div = document.createElement("div");
    div.className = "condition-cell";

    data = cell.getValue()
    if (data == null) {
        return ""
    }
    for (datum of data) {
        factor_bar = document.createElement("div");
        if (datum == null) {
            group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0]

            factor_bar.style.backgroundColor = "white"
            factor_bar.style.height = "100%"
            factor_bar.className = "factor-bar";
            div.append(factor_bar);
        
        } else {
            if (datum.group_name == "C3IncludedWells") {
                factor_bar.style.backgroundColor = "black"
            }
            else {
                group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0]
                factor_bar.style.backgroundColor = group_table.getData().find(g => g.name == datum.group_name)["colour"]
            }
            
            factor_bar.style.height = datum["ammt"] * 100 + "%"
            factor_bar.className = "factor-bar";
            div.append(factor_bar);
        }
    }

    return div;
}

function get_name_and_info(f) {
    if (f != null) {
        return `${f.concentration} ${f.unit} ${f.chemical.name}` + (f.ph != null ? ` ${f.ph} pH` : "")
        }
    return "none"
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
                const display_table = Tabulator.findTable("#current-maker-tabulator")[0]                
                const grid_rows = display_table.getRows().length;
                const grid_cols = display_table.getColumns().length - 1; // -1 because the title for each row is included
                // Load users list from api
                return new Promise(function(resolve, reject){
                    $.ajax({
                        url: site_functions.API_URL+'/screens/namesBySize?size=' + grid_rows * grid_cols,
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

// When additive is changed require regeneration
additive_table.on("dataChanged", set_required_regeneration_of_current_screen_from_automatic);

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
            title: "Chemical Arrangement", 
            field: "chemical_order", 
            vertAlign: "middle",
            width: 140,
            editor: "list",
            editorParams: {values: chemical_order_options},
            headerSort: false,
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            }
            
        // Varied Attribute Distribution
        }, {
            title:"Random Arrangement Options",
            headerHozAlign : "center", 
            // Distribution
            columns: [{
                title: "Distribution", 
                field: "varied_distribution", 
                vertAlign: "middle",
                width: 115,
                editor: "list",
                headerSort: false,
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
                headerSort: false,
                editorParams: {values: varied_grouping_options},
                formatter: function(cell, formatterParams, onRendered){
                    return cell.getValue() ? cell.getValue().label : "";
                }
            }]
            
        // Well Coverage
        }, {
            title: "Coverage of Wells", 
            field: "well_coverage", 
            width: 77,
            hozAlign: "right", 
            vertAlign: "middle",
            editable: true,
            editor: "number",
            editorParams:{
                min: 0,
                max: 100,
                step: 1
            },
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

        // When subtable is change or reset (on adding or removing of factor) request regeneration
        subtable_tabulator.on("dataChanged", set_required_regeneration_of_current_screen_from_automatic);
        subtable_tabulator.on("dataProcessed", set_required_regeneration_of_current_screen_from_automatic);

        // Holder of subtable
        var holder = $('<div>').attr('class', 'holder-for-subtable');
        holder.css('background', row.getData().colour);
        
        // Add subtable to row element
        $(row.getElement()).append(holder.append(subtable));
        
    }
});

// When factor group is changed require regeneration
factor_group_table.on("dataChanged", set_required_regeneration_of_current_screen_from_automatic);

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
                set_required_regeneration_of_current_screen_from_automatic()
            } else if (size == 48){
                create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 6, 8);
                set_required_regeneration_of_current_screen_from_automatic()
            } else {
                create_screen_display('#holder-for-current-maker-tabulator', '#current-maker-tabulator', 8, 12);
                set_required_regeneration_of_current_screen_from_automatic()
            }
        }
    }]
});

var condition_popup_tabulator = new Tabulator("#condition-popup-tabulator", {
    layout: "fitColumns",
    rowHeight: 48,
    editorEmptyValue: null,
    placeholder: "No Factors in Well",
    initialFilter: [],
    selectableRows: false,
    index: "id",
    validationMode: 'manual',
    movableRows: true,
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
            if (cell.getValue() == null || cell.getValue().name == null){
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
    },{
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
            last_selected_cell.setValue(condition_popup_tabulator.getData())
        }
    }, 
    headerSort: false, 
    hozAlign: "center", 
    vertAlign: "middle", 
    resizable: false, 
    frozen: true}]
});


condition_popup_tabulator.on("cellEdited", (e) => {
    condition = e.getRow().getData()
    condition["ammt"] = .5
    condition["group_name"] = "C3IncludedWells"
    last_selected_cell.setValue(condition_popup_tabulator.getData())
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
        well_coverage: 0,
        factors: []
    });
});

$("#screen-maker-automatic-randomise-button").click(function(){
   generate_current_screen_from_automatic() 
})

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

$("#condition-popup-add-button").click(function() {
    Tabulator.findTable('#condition-popup-tabulator')[0].addRow({"chemical": null, "concentration": null, "ph": null, "unit": null});
})

// Default start in automatic screen maker
$("#automatic-maker-button").click();

// Generate automatic screen from selected wells button
$('#screen-maker-automatic-generate-button').click(create_factor_groups_from_selected_wells);

// Regenerate screen from automatic factor groups
$('#current-maker-tabulator-automatic-update-popup-button').click(generate_current_screen_from_automatic);

// When toggling the inclusion of selected condition in auotmatic design require regeneration
$('#screen-maker-automatic-include-selected-checkbox').click(set_required_regeneration_of_current_screen_from_automatic);


// Propagate message passing after tables have loaded
Promise.all([]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();