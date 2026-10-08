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
var current_screen_selection_active = false;
const undo_stack = []
var show_factor_numbers = false;
var import_review_table = null;
var pending_import_screen = null;
var import_chemical_catalog = [];

function parse_screen_grid_clipboard(data){
    if (typeof data !== "string" || data === "") {
        return null;
    }
    const rows = data.replace(/\r/g, "").split("\n");
    if (rows.length && rows[rows.length - 1] === "") {
        rows.pop();
    }
    return rows.map(row => row.split("\t"));
}

function paste_screen_grid_clipboard(data){
    const screen_table = this.table;
    const range = screen_table.getRanges()[0];
    if (!current_screen_selection_active || !range) {
        site_functions.alert_user("Select a destination well before pasting.");
        return;
    }

    let source_grid;
    try {
        source_grid = data.map(row => row.map(value => {
            if (value === "") {
                return null;
            }
            const parsed = JSON.parse(value);
            if (parsed !== null && !Array.isArray(parsed)) {
                throw new Error("Pasted cells must contain copied well conditions.");
            }
            return parsed;
        }));
    } catch (error) {
        site_functions.alert_user("Unable to paste: clipboard cells are not valid copied well conditions.");
        return;
    }
    if (!source_grid.length || !source_grid[0].length) {
        return;
    }

    const source_width = source_grid[0].length;
    if (source_grid.some(row => row.length !== source_width)) {
        site_functions.alert_user("Unable to paste: clipboard cells do not form a rectangular well selection.");
        return;
    }

    const source_wells = source_grid.flat();
    const destination_grid = range.getStructuredCells();
    const destination_wells = destination_grid.flat();
    if (!destination_wells.length) {
        site_functions.alert_user("Select destination wells before pasting.");
        return;
    }

    const apply_values = function(values_to_apply){
        undo_stack.push(screen_table.getData());
        screen_table.blockRedraw();
        try {
            destination_wells.slice(0, values_to_apply.length).forEach(function(cell, index){
                cell.setValue(values_to_apply[index]);
            });
        } finally {
            screen_table.restoreRedraw();
        }
    };

    if (source_wells.length !== destination_wells.length) {
        const wells_to_transfer = Math.min(source_wells.length, destination_wells.length);
        site_functions.confirm_action(
            `The copied selection contains ${source_wells.length} wells, but the destination contains ` +
            `${destination_wells.length}. Transfer the first ${wells_to_transfer} wells in row-major order?`,
            function(){
                apply_values(source_wells.slice(0, wells_to_transfer));
            }
        );
        return;
    }

    apply_values(source_wells);
}

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
    {value: {id: "column", label: "Columns"}, label: "Columns"}, 
    {value: {id: "row", label: "Rows"}, label: "Rows"},
    {value: {id: "quadrant", label: "Quadrant"}, label: "Quadrant"},
    {value: {id: "uniform", label: "Uniform"}, label: "Uniform"},
    {value: {id: "stepwise", label: "Stepwise"}, label: "Stepwise"},
    {value: {id: "uniform_random", label: "Uniform Random"}, label: "Uniform Random"},
    {value: {id: "gaussian_random", label: "Gaussian Random"}, label: "Gaussian Random"},
    {value: {id: "uniform_random_sorted", label: "Uniform Random Sorted"}, label: "Uniform Random Sorted"},
    {value: {id: "gaussian_random_sorted", label: "Gaussian Random Sorted"}, label: "Gaussian Random Sorted"}

];

var location_options = [
    {value: {id: "column", label: "Column"}, label: "Column"}, 
    {value: {id: "row", label: "Row"}, label: "Row"},
    {value: {id: "quadrant", label: "Quadrant"}, label: "Quadrant"}, 
    {value: {id: "page", label: "Page"}, label: "Page"},
    {value: {id: "fixed", label: "Fixed"}, label: "Fixed"}, 
    {value: {id: "random", label: "Random"}, label: "Random"}
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

function chemical_order_options_for_location(location_value){
    // Every location mode can combine with every variable mode. The backend applies
    // the variable ordering relative to the chosen region layout, so we keep the
    // full list available regardless of location choice.
    return chemical_order_options;
}

function normalize_random_location_row(row_data){
    // Random location does not restrict which variable ordering can be used.
    return row_data;
}

function ensure_random_location_chemical_order(row){
    // No special coercion is needed: location and variable can be combined freely.
    return;
}

// UI fix for editing checkbox. Lets the whole cell be the toggle
function cellclick_flip_tick(e, cell){
    cell.setValue(!cell.getValue());
}

function apply_location_cell_style(cell){
    if (!cell || !cell.getRow || !cell.getElement) {
        return;
    }

    const factors = cell.getRow().getData().factors || [];
    const isDisabled = factors.length <= 1;
    const cellEl = $(cell.getElement());

    if (isDisabled) {
        cellEl.css({
            'color': '#888',
            'background-color': '#f3f3f3',
            'font-style': 'italic',
            'cursor': 'not-allowed'
        });
    } else {
        cellEl.css({
            'color': '',
            'background-color': '',
            'font-style': '',
            'cursor': ''
        });
    }
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

    const location_cell = row.getCell("location");
    if (location_cell) {
        apply_location_cell_style(location_cell);
    }
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
            g.location = value_from_id(g.location, location_options)
            normalize_random_location_row(g);
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

                    top_pos = Math.min(e.clientY, window.innerHeight - $('#condition-popup').outerHeight())
                    left_pos = Math.min(e.clientX, window.innerWidth - $('#condition-popup').outerWidth())
                    $('#condition-popup').css('top', top_pos + 'px');
                    $('#condition-popup').css('left', left_pos + 'px');

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
        clipboardPasteParser:parse_screen_grid_clipboard,
        clipboardPasteAction:paste_screen_grid_clipboard,
    });

    if (element_id === "#current-maker-tabulator") {
        current_screen_selection_active = false;
        screen_display_tabulator.on("tableBuilt", function() {
            clear_current_screen_selection();
        });
    }

}

function clear_current_screen_selection(){
    current_screen_selection_active = false;
    const screen_element = document.querySelector("#current-maker-tabulator");
    if (screen_element) {
        screen_element.classList.add("selection-inactive");
    }
    const screen_table = Tabulator.findTable("#current-maker-tabulator")[0];
    if (screen_table) {
        screen_table.getRanges().forEach(function(range) {
            range.remove();
        });
    }
}

$(document).on("click.screenMakerSelection", function(event) {
    const target = $(event.target);
    if (target.closest("#condition-popup").length === 0) {
        $("#condition-popup").hide();
    }

    if (target.closest("#current-maker-tabulator").length > 0) {
        current_screen_selection_active = true;
        const screen_element = document.querySelector("#current-maker-tabulator");
        if (screen_element) {
            screen_element.classList.remove("selection-inactive");
        }
        return;
    }

    if (target.closest(
        "#current-maker-tabulator, #condition-popup, button, a, input, select, textarea, " +
        "summary, [contenteditable='true'], [role='button'], .tabulator"
    ).length === 0) {
        clear_current_screen_selection();
    }
});

$(document).on("keydown.screenMakerSelection", function(event) {
    if (event.key === "Escape") {
        clear_current_screen_selection();
    }
});

function set_required_regeneration_of_current_screen_from_automatic(){
    // $('#current-maker-tabulator-automatic-update-popup').show();
}

function generate_current_screen_from_automatic(){

    const group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0]

    group_data = group_table.getData();

    for (group of group_data) {
        var index = 0;
        for (factor of group.factors) {
            index += 1;
            
            // Allow location types (quadrant, page) to work with non-exact factor counts.
            // Server will allocate factors across regions when counts differ (e.g., 1-3 factors for quadrant).
            // Keep validation for other required fields below.
            
            if (factor.chemical.id == null) {
                site_functions.alert_user(`${group.name} factor ${index} is missing a chemical`)
                return
            }
            if (factor.relative_coverage == null) {
                site_functions.alert_user(`${group.name} factor ${index} is missing relative coverage`)
                return
            }
            if ((factor.varied_max == null || factor.varied_min == null) && (group.chemical_order.id != "uniform" && factor.vary.id != "none")) {
                site_functions.alert_user(`${group.name} factor ${index} is missing Max or Min`)
                return
            } 
            if ((factor.concentration == null && factor.vary.id != "concentration") || (factor.concentration == null && group.chemical_order.id == "uniform") || (factor.concentration == null && factor.vary.id == "none")) {
                console.log((factor.concentration == null && factor.vary.id != "concentration"), (factor.concentration == null && group.chemical_order.id == "uniform"), (factor.concentration == null && factor.vary.id == "none"))
                site_functions.alert_user(`${group.name} factor ${index} is missing a concentration`)
                return
            }
            if (factor.unit == null) {
                site_functions.alert_user(`${group.name} factor ${index} is missing a unit`)
                return
            }
            if (factor.vary === null) {
                site_functions.alert_user(`${group.name} factor ${index} is missing what to vary`)
                return
            }
        }
            
    }

    var display_table = Tabulator.findTable("#current-maker-tabulator")[0]
    // if (display_table.getData().every((row) => Object.values(row).slice(0, -1).every((cell) => cell === null))) {}
    undo_stack.push(display_table.getData())

    const grid_rows = display_table.getRows().length;
    const grid_cols = display_table.getColumns().length - 1; // -1 because the title for each row is included

    const selected_range = current_screen_selection_active ? display_table.getRanges()[0] : null;
    let range_dimensions = null;
    if (selected_range) {
        // -1 because the title of each row is included
        range_dimensions = {"left": selected_range.getLeftEdge() - 1, "right": selected_range.getRightEdge() - 1, "top": selected_range.getTopEdge(), "bottom": selected_range.getBottomEdge()}
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
                console.log(group)
                group.chemical_order = group.chemical_order.id
                group.location = group.location.id
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
            range_dimensions: selected_range ? range_dimensions : null
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

            const range = current_screen_selection_active
                ? Tabulator.findTable("#current-maker-tabulator")[0].getRanges()[0]
                : null;

            if (range) {
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

function clear_screen() {
    var display_table = Tabulator.findTable("#current-maker-tabulator")[0]
    undo_stack.push(display_table.getData())

    const grid_rows = display_table.getRows().length;
    const grid_cols = display_table.getColumns().length - 1; // -1 because the title for each row is included

    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var all_data = []
    for (var r = 0; r < grid_rows; r++){
        var row_data = {row_letter: letters[r]};
        for (var c = 0; c < grid_cols; c++){
            row_data[c.toString()] = []
        }
        all_data.push(row_data);
    }

    display_table.setData(all_data)

}

function row_formatter(row){
    row.getElement().style.backgroundColor = "#fff";
    row.getElement().style.borderTop = "1px solid #aaa";
}

function row_header_formatter(cell, formatterParams, onRendered){
    $(cell.getElement()).css('font-weight', '700');
    return cell.getValue();
}

function factor_color_for_display(datum, group){
    if (!group || !group.factors || group.factors.length <= 1 || !datum.chemical) {
        return null;
    }

    const chemical_id = datum.chemical.id;
    const factor_index = group.factors.findIndex(function(factor){
        return factor.chemical && factor.chemical.id === chemical_id;
    });

    if (factor_index < 0) {
        return null;
    }

    const base_color = group.colour.replace("#", "");
    const red = parseInt(base_color.substring(0, 2), 16);
    const green = parseInt(base_color.substring(2, 4), 16);
    const blue = parseInt(base_color.substring(4, 6), 16);
    const shade = 0.25 - (0.5 * factor_index / (group.factors.length - 1));
    const adjust = function(channel){
        return Math.round(shade >= 0
            ? channel + ((255 - channel) * shade)
            : channel * (1 + shade));
    };

    return `rgb(${adjust(red)}, ${adjust(green)}, ${adjust(blue)})`;
}

function factor_number_for_display(datum, group){
    if (!group || !group.factors || group.factors.length <= 1 || !datum.chemical) {
        return null;
    }

    const factor_index = group.factors.findIndex(function(factor){
        return factor.chemical && factor.chemical.id === datum.chemical.id;
    });

    return factor_index >= 0 ? factor_index + 1 : null;
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
                factor_bar.style.backgroundColor = "#aaff9b"
            }
            else if (datum.group_name == "C3AdditiveScreen") {
                factor_bar.style.backgroundColor = "#ffb699"
            }
            else if (datum.group_name == "C3EditedWell") {
                factor_bar.style.backgroundColor = "black"
            }
            else {
                group_table = Tabulator.findTable("#automatic-factor-groups-tabulator")[0]
                const group = group_table.getData().find(g => g.name == datum.group_name)
                factor_bar.style.backgroundColor = factor_color_for_display(datum, group) || group["colour"]
                const factor_number = show_factor_numbers
                    ? factor_number_for_display(datum, group)
                    : null
                if (factor_number !== null) {
                    const number_label = document.createElement("span")
                    number_label.className = "factor-number"
                    number_label.textContent = factor_number
                    factor_bar.append(number_label)
                }
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
            title: "Variable", 
            field: "chemical_order", 
            vertAlign: "middle",
            width: 140,
            editor: "list",
            editorParams: {
                valuesLookup: function(cell){
                    return chemical_order_options_for_location(cell.getRow().getData().location);
                }
            },
            headerSort: false,
            formatter: function(cell, formatterParams, onRendered){
                return cell.getValue() ? cell.getValue().label : "";
            },
            cellEdited: function(cell){
                ensure_random_location_chemical_order(cell.getRow());
            }
            
        // Varied Attribute Distribution
        }, {
            title: "Chemical Location", 
            field: "location", 
            vertAlign: "middle",
            width: 140,
            editable: function(cell){
                const factors = cell.getRow().getData().factors || [];
                return factors.length > 1;
            },
            editor: "list",
            editorParams: {values: location_options},
            headerSort: false,
            formatter: function(cell, formatterParams, onRendered){
                apply_location_cell_style(cell);
                return cell.getValue() ? cell.getValue().label : "";
            },
            cellEdited: function(cell){
                ensure_random_location_chemical_order(cell.getRow());
            }
            
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
            layout: "fitData",
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
                resizable: false,
                editable: true,
                validator: function(cell, value){
                    console.log(value)
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
                resizable: false,
                hozAlign: "right", 
                vertAlign: "middle",
                // width: 85,
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
                resizable: false,
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
                resizable: false,
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
                resizable: false,
                hozAlign: "right", 
                vertAlign: "middle",
                // width: 75,
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
                resizable: false,
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
                title: "Start Value", 
                field: "varied_min",
                resizable: false, 
                hozAlign: "right", 
                vertAlign: "middle",
                // width: 80,
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
                title: "End Value", 
                field: "varied_max", 
                resizable: false,
                hozAlign: "right", 
                vertAlign: "middle",
                // width: 80,
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
            resizable: false,
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

                    const location_cell = row.getCell("location");
                    if (location_cell) {
                        apply_location_cell_style(location_cell);
                    }
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: false, 
            frozen: true}]
        });

        // When subtable is change or reset (on adding or removing of factor) request regeneration
        subtable_tabulator.on("dataChanged", function(){
            const location_cell = row.getCell("location");
            if (location_cell) {
                apply_location_cell_style(location_cell);
            }
            set_required_regeneration_of_current_screen_from_automatic();
        });
        subtable_tabulator.on("dataProcessed", function(){
            const location_cell = row.getCell("location");
            if (location_cell) {
                apply_location_cell_style(location_cell);
            }
            set_required_regeneration_of_current_screen_from_automatic();
        });

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
            resize_current_screen_grid(cell.getValue());
            set_required_regeneration_of_current_screen_from_automatic();
        }
    }]
});

var condition_popup_tabulator = new Tabulator("#condition-popup-tabulator", {
    layout: "fitData",
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
                if (old_chemical != null && chemical.id != old_chemical.id){
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
            console.log(cell.getValue())
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
        // width: 85,
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
        // width: 65,
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
        // width: 55,
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
    var display_table = Tabulator.findTable("#current-maker-tabulator")[0]
    condition = e.getRow().getData()
    condition["ammt"] = .5
    condition["group_name"] = "C3EditedWell"
    const valid_factors = []
    for (factor of condition_popup_tabulator.getData()) {
        if (factor.chemical == null || factor.unit == null || factor.concentration == null)
            continue
        valid_factors.push(factor)
    }

    if (valid_factors.length > 0) {
        undo_stack.push(display_table.getData())
        last_selected_cell.setValue(valid_factors)
    }
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
        location: location_options[0].value, 
        well_coverage: 100,
        factors: []
    });
});

$("#screen-maker-automatic-randomise-button").click(function(){
   generate_current_screen_from_automatic() 
})

$("#screen-maker-automatic-clear-screen-button").click(function(){
   clear_screen() 
})

$("#screen-maker-automatic-undo-button").click(function(){
    if (undo_stack.length == 0)
        return;
    var display_table = Tabulator.findTable("#current-maker-tabulator")[0];
    display_table.setData(undo_stack.pop());
})

$("#screen-maker-save-button").click(function(){
    to_authorise = function(auth_token){
        $.ajax({
            type: 'POST',
            url: site_functions.API_URL+'/screens/test', 
            data: JSON.stringify({"name": "NewName",
                "available": 1,
                "owned_by": "meme",
                "wells": []
                
            }), 
            headers: {"Authorization": "Bearer " + auth_token},
            // On success replace row with contents of returned new chemical
            success: function(returned_chemical) {
                site_functions.alert_user("worked")
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

$('#toggle-factor-numbers-button').click(function(){
    show_factor_numbers = !show_factor_numbers;
    $(this).text(show_factor_numbers ? 'Hide Factor Numbers' : 'Show Factor Numbers');
    const display_table = Tabulator.findTable('#current-maker-tabulator')[0];
    if (display_table) {
        display_table.redraw(true);
    }
});

function import_xml_text(xml_text) {
    const xml = new DOMParser().parseFromString(xml_text, "application/xml");
    if (xml.querySelector("parsererror")) {
        throw new Error("The selected file is not valid XML.");
    }

    const imported_wells = [];
    const crystaltrak_wells = Array.from(xml.querySelectorAll("reservoir_design > well"));
    if (crystaltrak_wells.length) {
        crystaltrak_wells.forEach((well, index) => {
            const factors = Array.from(well.querySelectorAll(":scope > item")).map((item) => ({
                name: item.getAttribute("name"),
                concentration: Number(item.getAttribute("conc")),
                unit: item.getAttribute("units"),
                ph: item.getAttribute("ph") === "" ? null : Number(item.getAttribute("ph"))
            }));
            imported_wells.push({label: well.getAttribute("label") || String(index + 1), factors: factors});
        });
        const format = xml.querySelector("reservoir_design > format");
        return {
            name: xml.querySelector("reservoir_design")?.getAttribute("name") || "Imported Screen",
            rows: Number(format?.getAttribute("rows")) || 8,
            cols: Number(format?.getAttribute("cols")) || 12,
            wells: imported_wells
        };
    }

    const ingredient_by_stock = {};
    xml.querySelectorAll("ingredient").forEach((ingredient) => {
        const name = ingredient.querySelector(":scope > name")?.textContent.trim();
        ingredient.querySelectorAll(":scope > stocks > stock").forEach((stock) => {
            const local_id = stock.querySelector(":scope > localID")?.textContent.trim();
            if (local_id && name) {
                ingredient_by_stock[local_id] = {
                    name: name,
                    unit: stock.querySelector(":scope > units")?.textContent.trim() || "M"
                };
            }
        });
    });
    const conditions = Array.from(xml.querySelectorAll("conditions > condition"));
    if (!conditions.length || !Object.keys(ingredient_by_stock).length) {
        throw new Error("The file is not a supported CrystalTrak or RockMaker design.");
    }
    conditions.forEach((condition, index) => {
        const factors = Array.from(condition.querySelectorAll(":scope > conditionIngredient")).map((ingredient) => {
            const stock_id = ingredient.querySelector(":scope > stockLocalID")?.textContent.trim();
            const stock = ingredient_by_stock[stock_id];
            if (!stock) {
                throw new Error("The RockMaker file references an unknown stock.");
            }
            const ph = ingredient.querySelector(":scope > pH")?.textContent.trim();
            return {
                name: stock.name,
                concentration: Number(ingredient.querySelector(":scope > concentration")?.textContent),
                unit: stock.unit,
                ph: ph ? Number(ph) : null
            };
        });
        imported_wells.push({label: String(index + 1), factors: factors});
    });
    const size = imported_wells.length;
    return {
        name: "Imported Screen",
        rows: size === 24 ? 4 : size === 48 ? 6 : 8,
        cols: size === 24 ? 6 : size === 48 ? 8 : 12,
        wells: imported_wells
    };
}

function resolve_imported_chemicals(screen, chemicals) {
    const normalize_name = function(name) {
        return name.trim().toLowerCase().replace(/\s+bcc$/, "");
    };
    const by_name = {};
    chemicals.forEach((chemical) => {
        by_name[normalize_name(chemical.name)] = chemical;
        (chemical.aliases || []).forEach((alias) => {
            by_name[normalize_name(alias.name)] = chemical;
        });
    });
    screen.wells.forEach((well, well_index) => {
        well.factors.forEach((factor, factor_index) => {
            factor.chemical = by_name[normalize_name(factor.name)] || null;
            factor.source_chemical_name = factor.name;
            factor.vary = {id: "none", label: "None"};
            factor.relative_coverage = 1;
            factor.group_name = "C3EditedWell";
            factor.ammt = 1 / Math.max(well.factors.length, 1);
            factor.id = `import-${well_index}-${factor_index}`;
        });
        if (!well.factors.length) {
            well.factors.push({
                id: `import-${well_index}-empty`,
                chemical: null,
                source_chemical_name: "",
                concentration: null,
                unit: null,
                ph: null,
                vary: {id: "none", label: "None"},
                relative_coverage: 1,
                group_name: "C3EditedWell",
                ammt: 1,
                placeholder: true
            });
        }
    });
    return screen.wells.flatMap((well, well_index) =>
        well.factors.map((factor) => ({
            ...factor,
            well_index,
            well_label: well.label,
            placeholder: Boolean(factor.placeholder)
        }))
    );
}

function validate_import_factor(factor) {
    if (factor.placeholder) {
        return [];
    }
    const errors = [];
    if (!factor.chemical || !factor.chemical.id) {
        errors.push("Choose a chemical");
    }
    if (typeof factor.concentration !== "number" || !Number.isFinite(factor.concentration) || factor.concentration <= 0) {
        errors.push("Concentration must be positive");
    }
    if (!site_functions.ALL_UNITS.includes(factor.unit)) {
        errors.push("Choose a valid unit");
    }
    if (factor.ph !== null && factor.ph !== "" &&
        (typeof factor.ph !== "number" || !Number.isFinite(factor.ph) || factor.ph < 0 || factor.ph > 14)) {
        errors.push("pH must be between 0 and 14");
    }
    return errors;
}

function update_import_review_validation() {
    if (!import_review_table) {
        return 0;
    }
    let invalid_count = 0;
    import_review_table.getRows().forEach((row) => {
        const errors = validate_import_factor(row.getData());
        invalid_count += errors.length > 0 ? 1 : 0;
        row.getElement().classList.toggle("import-factor-invalid", errors.length > 0);
        row.getElement().title = errors.join("; ");
    });
    $("#screen-maker-import-review-status").text(
        invalid_count
            ? `${invalid_count} invalid factor row(s). Correct the highlighted rows before submitting.`
            : "All imported factors are valid. Review the wells, then submit to add them to the grid."
    );
    return invalid_count;
}

function make_import_review_table(initial_data) {
    if (import_review_table) {
        return import_review_table;
    }
    import_review_table = new Tabulator("#screen-maker-import-review-table", {
        data: initial_data,
        height: "100%",
        layout: "fitColumns",
        movableColumns: true,
        rowHeight: 48,
        placeholderHeaderFilter: "No Matching Factors",
        placeholder: "No imported wells",
        selectableRows: false,
        index: "id",
        groupBy: "well_label",
        groupStartOpen: true,
        groupHeader: function(value, count, data, group) {
            const well_label = $("<div>")
                .addClass("import-review-well-label")
                .text(value);
            const add_factor_button = $("<button>")
                .attr("type", "button")
                .attr("class", "table-cell-button import-add-factor-button add-button")
                .attr("data-well-index", group.getRows()[0].getData().well_index)
                .text("Add Factor");
            const actions = $("<table>")
                .attr("class", "screen-well-header-button-table button-table import-review-group-actions")
                .append($("<tbody>").append(
                    $("<tr>").append($("<td>").append(add_factor_button))
                ));
            return well_label.prop("outerHTML") + actions.prop("outerHTML");
        },
        columns: [{
            title: "Chemical",
            field: "chemical",
            minWidth: 130,
            widthGrow: 4,
            vertAlign: "middle",
            headerSort: false,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            formatter: function(cell) {
                const factor = cell.getRow().getData();
                const chemical = cell.getValue();
                if (chemical && chemical.id) {
                    return chemical.name + ((chemical.aliases || []).length
                        ? ` (aliases: ${chemical.aliases.length})`
                        : "");
                }
                return factor.source_chemical_name
                    ? `Not found: ${factor.source_chemical_name} — choose a chemical`
                    : "Select a chemical";
            },
            editor: "list",
            editorParams: {
                valuesLookup: function() {
                    return import_chemical_catalog.map((chemical) => ({
                        label: chemical.name + (chemical.aliases.length ? ` (aliases: ${chemical.aliases.length})` : ""),
                        value: chemical
                    }));
                },
                autocomplete: true,
                listOnEmpty: true,
                filterFunc: function(term, label, value) {
                    const query = term.toLowerCase();
                    return value.name.toLowerCase().includes(query) ||
                        (value.aliases || []).some((alias) => alias.name.toLowerCase().includes(query));
                }
            }
        }, {
            title: "Concentration",
            field: "concentration",
            minWidth: 128,
            widthGrow: 2,
            vertAlign: "middle",
            hozAlign: "right",
            sorter: "number",
            headerSort: false,
            headerFilter: "number",
            headerFilterPlaceholder: "Filter",
            editor: "number"
        }, {
            title: "Unit",
            field: "unit",
            minWidth: 70,
            widthGrow: 1,
            vertAlign: "middle",
            headerSort: false,
            headerFilter: "list",
            headerFilterParams: {values: site_functions.ALL_UNITS},
            headerFilterPlaceholder: "Filter",
            editor: "list",
            editorParams: {values: site_functions.ALL_UNITS}
        }, {
            title: "pH",
            field: "ph",
            minWidth: 60,
            widthGrow: 1,
            vertAlign: "middle",
            hozAlign: "right",
            sorter: "number",
            headerSort: false,
            headerFilter: "number",
            headerFilterPlaceholder: "Filter",
            editor: "number"
        }, {
            title: "",
            minWidth: 96,
            headerSort: false,
            hozAlign: "center",
            vertAlign: "middle",
            frozen: true,
            formatter: function() {
                return $("<button>")
                    .attr("type", "button")
                    .attr("class", "table-cell-button import-remove-factor-button delete-button")
                    .text("Remove")
                    .prop("outerHTML");
            },
            cellClick: function(event, cell) {
                if (!$(event.target).hasClass("import-remove-factor-button")) {
                    return;
                }
                const row = cell.getRow();
                const group_rows = import_review_table.getData().filter(
                    factor => factor.well_index === row.getData().well_index
                );
                if (group_rows.length > 1) {
                    row.delete();
                } else {
                    row.update({
                        chemical: null,
                        source_chemical_name: "",
                        concentration: null,
                        unit: null,
                        ph: null,
                        placeholder: true
                    });
                }
                update_import_review_validation();
            }
        }]
    });
    import_review_table.on("cellEdited", function(cell) {
        const factor = cell.getRow().getData();
        if (cell.getField() === "chemical") {
            factor.source_chemical_name = factor.chemical ? factor.chemical.name : factor.source_chemical_name;
            factor.placeholder = false;
        }
        update_import_review_validation();
    });
    import_review_table.on("dataProcessed", update_import_review_validation);
    return import_review_table;
}

function resize_current_screen_grid(size) {
    const dimensions = {
        24: [4, 6],
        48: [6, 8],
        96: [8, 12]
    }[Number(size)];
    if (!dimensions) {
        throw new Error("Imported screens must fit a 24, 48, or 96 well plate.");
    }
    const current_table = Tabulator.findTable("#current-maker-tabulator")[0];
    if (current_table &&
        current_table.getRows().length === dimensions[0] &&
        current_table.getColumns().length - 1 === dimensions[1]) {
        return;
    }
    if (current_table) {
        current_table.destroy();
    }
    create_screen_display(
        "#holder-for-current-maker-tabulator",
        "#current-maker-tabulator",
        dimensions[0],
        dimensions[1]
    );
}

function fill_imported_screen(screen) {
    if (screen.wells.length > 96) {
        throw new Error("This file contains more wells than the screen maker supports.");
    }
    const size = screen.wells.length <= 24 ? 24 : screen.wells.length <= 48 ? 48 : 96;
    const details_table = Tabulator.findTable("#current-maker-details-tabulator")[0];
    if (details_table) {
        const detail_row = details_table.getRows()[0];
        detail_row?.getCell("size")?.setValue(size);
    }
    resize_current_screen_grid(size);
    const display_table = Tabulator.findTable("#current-maker-tabulator")[0];
    if (!display_table) {
        throw new Error("The screen grid is not available.");
    }
    const rows = display_table.getRows().length;
    const cols = display_table.getColumns().length - 1;
    const data = display_table.getData();
    data.forEach((row) => {
        for (let column = 0; column < cols; column++) {
            row[String(column)] = null;
        }
    });
    screen.wells.forEach((well, index) => {
        const row = Math.floor(index / cols);
        const column = index % cols;
        if (row < rows) {
            const factors = well.factors.filter((factor) => !factor.placeholder);
            factors.forEach((factor) => {
                delete factor.source_chemical_name;
                delete factor.well_index;
                delete factor.well_label;
                delete factor.placeholder;
            });
            data[row][String(column)] = factors.length ? factors : null;
        }
    });
    display_table.setData(data);
    if (details_table) {
        const detail_row = details_table.getRows()[0];
        if (detail_row) {
            detail_row.getCell("name")?.setValue(screen.name);
        }
    }
}

function open_import_review(screen, title, instructions, on_chemical_load_failure) {
    $.getJSON(site_functions.API_URL + '/chemicals/names')
        .done(function(chemicals) {
            pending_import_screen = screen;
            import_chemical_catalog = chemicals;
            const rows = resolve_imported_chemicals(screen, chemicals);
            $("#screen-maker-import-review-title").text(title);
            $("#screen-maker-import-review-name").text(screen.name);
            $("#screen-maker-import-review-instructions").text(instructions);
            $('#screen-maker-import-popup').hide();
            $("#screen-maker-import-review").show();
            requestAnimationFrame(function() {
                if (import_review_table) {
                    import_review_table.setData(rows);
                } else {
                    make_import_review_table(rows);
                }
                update_import_review_validation();
            });
        })
        .fail(on_chemical_load_failure);
}

$('#screen-maker-import-button').click(function() {
    $('#screen-maker-import-file').val('');
    $('#screen-maker-import-status').text('');
    $('#screen-maker-import-popup').show();
});

$('#screen-maker-create-well-by-well-button').click(function() {
    const blank_screen = {
        name: 'New Screen',
        rows: 8,
        cols: 12,
        wells: Array.from({length: 96}, function(_, index) {
            const row = String.fromCharCode(65 + Math.floor(index / 12));
            const column = index % 12 + 1;
            return {
                label: row + column,
                factors: []
            };
        })
    };
    open_import_review(
        blank_screen,
        'Create Screen Well by Well',
        'Add factors to each well. Invalid factors are highlighted and must be corrected before submitting.',
        function() {
            site_functions.alert_user('Unable to load chemicals from the server.');
        }
    );
});

$('#screen-maker-import-cancel-button').click(function() {
    $('#screen-maker-import-popup').hide();
});

$('#screen-maker-import-confirm-button').click(function() {
    const file = $('#screen-maker-import-file')[0].files[0];
    if (!file) {
        $('#screen-maker-import-status').text('Choose a file first.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const screen = import_xml_text(event.target.result);
            open_import_review(
                screen,
                'Review Imported Screen',
                'Edit imported factors below. Invalid factors are highlighted and must be corrected before submitting.',
                function() {
                    $('#screen-maker-import-status').text('Unable to load chemicals from the server.');
                }
            );
        } catch (error) {
            $('#screen-maker-import-status').text(error.message);
        }
    };
    reader.onerror = function() {
        $('#screen-maker-import-status').text('Unable to read the selected file.');
    };
    reader.readAsText(file);
});

$(document).on("click", ".import-add-factor-button", function(event) {
    event.stopPropagation();
    if (!import_review_table || !pending_import_screen) {
        return;
    }
    const well_index = Number($(this).attr("data-well-index"));
    const well = pending_import_screen.wells[well_index];
    if (!well) {
        return;
    }
    well.factors.push({
        id: `import-${well_index}-${Date.now()}`,
        well_index,
        well_label: well.label,
        chemical: null,
        source_chemical_name: "",
        concentration: null,
        unit: site_functions.ALL_UNITS[0],
        ph: null,
        vary: {id: "none", label: "None"},
        relative_coverage: 1,
        group_name: "C3EditedWell",
        ammt: 1 / (well.factors.length + 1),
        placeholder: false
    });
    const row_data = well.factors[well.factors.length - 1];
    import_review_table.addRow(row_data, true);
    update_import_review_validation();
});

$("#screen-maker-import-submit-button").click(function() {
    if (!pending_import_screen || !import_review_table) {
        return;
    }
    if (update_import_review_validation()) {
        return;
    }
    const factors_by_well = new Map();
    import_review_table.getData().forEach((factor) => {
        if (factor.placeholder) {
            return;
        }
        if (!factors_by_well.has(factor.well_index)) {
            factors_by_well.set(factor.well_index, []);
        }
        factors_by_well.get(factor.well_index).push(factor);
    });
    pending_import_screen.wells.forEach((well, index) => {
        well.factors = factors_by_well.get(index) || [];
    });
    try {
        fill_imported_screen(pending_import_screen);
        $("#screen-maker-import-review").hide();
        pending_import_screen = null;
    } catch (error) {
        $("#screen-maker-import-review-status").text(error.message);
    }
});

$("#screen-maker-import-review-cancel-button").click(function() {
    $("#screen-maker-import-review").hide();
    pending_import_screen = null;
    if (import_review_table) {
        import_review_table.clearData();
    }
});


// Save current screen to the backend
$('#screen-maker-save-button').click(function(){
    try {
        var details_table = Tabulator.findTable('#current-maker-details-tabulator')[0];
        var details = details_table.getData()[0];
    } catch (e) {
        site_functions.alert_user('Unable to read screen details');
        return;
    }

    var display_table = Tabulator.findTable('#current-maker-tabulator')[0];
    var grid_rows = display_table.getRows().length;
    var grid_cols = display_table.getColumns().length - 1; // title column excluded
    var grid_data = display_table.getData();
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    var wells = [];
    for (var r = 0; r < grid_rows; r++){
        for (var c = 0; c < grid_cols; c++){
            var cell = grid_data[r][c.toString()];
            var position = r * grid_cols + c + 1;
            var label = letters[r] + (c + 1);
            var factors = [];
            if (cell && Array.isArray(cell)){
                for (var i = 0; i < cell.length; i++){
                    var f = cell[i];
                    if (!f || !f.chemical || !f.chemical.id){
                        continue;
                    }
                    factors.push({
                        chemical_id: f.chemical.id,
                        concentration: f.concentration,
                        unit: f.unit,
                        ph: f.ph
                    });
                }
            }
            wells.push({
                position_number: position,
                label: label,
                condition: factors
            });
        }
    }

    var payload = {
        name: details.name,
        owned_by: details.apiuser && details.apiuser.username ? details.apiuser.username : 'unknown',
        format_rows: details.size == 24 ? 4 : (details.size == 48 ? 6 : 8),
        format_cols: details.size == 24 ? 6 : (details.size == 48 ? 8 : 12),
        wells: wells
    };

    var to_authorise = function(auth_token){
        $.ajax({
            type: 'POST',
            url: site_functions.API_URL + '/screens/create',
            data: JSON.stringify(payload),
            headers: {"Authorization": "Bearer " + auth_token},
            success: function(returned_screen){
                site_functions.alert_user('Screen saved: ' + returned_screen.name);
            },
            error: function(xhr){
                if (xhr.status == 401) {
                    site_functions.authorise_action('Please log in again', to_authorise);
                } else {
                    var msg = 'Error saving screen';
                    try { msg += ': ' + xhr.responseText } catch (e) {}
                    site_functions.alert_user(msg);
                }
            },
            dataType: 'json',
            contentType: 'application/json'
        });
    };
    site_functions.authorise_action(null, to_authorise);
});


// Propagate message passing after tables have loaded
Promise.all([]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();