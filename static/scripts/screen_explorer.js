//# sourceURL=screen_explorer.js
site_functions.CONTENT_PROVIDERS.screen_explorer = (function() {

// Store query that produced screen list if there was one, so wells can be flagged
var LAST_QUERY = null;
var LAST_SELECTED_SCREEN = null;
var CURRENT_SCREEN_DATA = null;
var LAST_SCREEN_DATA = null;

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};
public_functions.screen_query = function (query_object){
    hide_screen();
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.setData(site_functions.API_URL+'/screens/query', query_object, "POST");
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

function round(number, decimal_places = 2) {
    factor = Math.pow(10, decimal_places);
    return Math.round(number * factor) / factor
}

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
    let rows = factor_group.getRows();
    if (rows.length == 0){
        site_functions.alert_user("No factors in the the condition.");
    } else {
        let ff = rows[0].getData();
        let screen_table = Tabulator.findTable('#screen-tabulator')[0];
        let all_screen_data = screen_table.getData();
        let screen = null;
        for (i in all_screen_data){
            if (all_screen_data[i].screen.id == ff.well.screen_id){
                screen = all_screen_data[i].screen;
                break;
            }
        }
        if (screen){
            let well = ff.well;
            site_functions.request_content('recipes', 'screen_well_recipe', {screen: screen, well: well});
        } else {
            site_functions.alert_user("Error finding well screen. Try searching reipce manually.");
        }
    }
}

// Function for when a well is selected
function select_condition(factor_group, target){
    let rows = factor_group.getRows();
    if (rows.length == 0){
        site_functions.alert_user("Empty condition, nothing to add.");
    } else {
        factor_group.getRows().forEach(row => { 
            r = row.getData();
            // Save The screen name so we can use it to group wells
            r.screen_name = LAST_SELECTED_SCREEN
            // we need acess to the deselect button so that even when on selected wells page we can deselect
            r.select_button_dom_element = target
            site_functions.add_selected_well(r)

        });
        target.removeClass('select-button');
        target.text('Deselect');
        target.addClass('delete-button');
    }
}

// Function for when a well is unselected
function remove_condition(factor_group, target){
    let rows = factor_group.getRows();
    if (rows.length == 0){
        site_functions.alert_user("Empty condition, nothing to remove.");
    } else {
        let ff = rows[0].getData();
        site_functions.remove_selected_well(ff);
        target.removeClass('delete-button');
        target.text('Select');
        target.addClass('select-button');
    }
}

// Viewing a screen
function view_screen(cell){
    cell.getTable().deselectRow();
    cell.getRow().select();
    $('#screens-half-div').css('width', '50%');
    $('#screen-info-view-div').show();
    $('#screen-info-view-title').text(cell.getData().screen.name);
    LAST_SELECTED_SCREEN = cell.getData().screen.name
    let well_table = Tabulator.findTable('#screen-wells-view-tabulator')[0];
    well_table.setData(site_functions.API_URL+'/screens/factorQuery?screen_id='+cell.getData().screen.id, LAST_QUERY, "POST")
    .then(() => {set_screen_report_data(well_table)});
}

// get all of the info for the screen report
function set_screen_report_data(table) {
    // save previous screen data
    LAST_SCREEN_DATA = CURRENT_SCREEN_DATA;
    var data = table.getData();
    CURRENT_SCREEN_DATA = {"chemicals": {}};
    well_groups = Object.groupBy(data, (row) => row.well.label);
    CURRENT_SCREEN_DATA["well_groups"] = well_groups;
    CURRENT_SCREEN_DATA["num_wells"] = Object.keys(well_groups).length;
    chemical_groups = Object.groupBy(data, (row) => row.factor.chemical.name);
    CURRENT_SCREEN_DATA["num_chemicals"] = Object.keys(chemical_groups).length;
    CURRENT_SCREEN_DATA["num_conditions"] = data.length;
    CURRENT_SCREEN_DATA["screen_name"] = LAST_SELECTED_SCREEN;
    // for each chemical get its stats
    for (chemical_name in chemical_groups) {
        total_concentration = 0;
        ph_min = Infinity;
        ph_max = -Infinity;
        conc_min = Infinity;
        conc_max = -Infinity;
        for (well of chemical_groups[chemical_name]){
            if (well.factor.ph != null) {
                ph_min = well.factor.ph < ph_min ? well.factor.ph : ph_min;
                ph_max = well.factor.ph > ph_max ? well.factor.ph : ph_min;
            }
            conc_min = well.factor.concentration < conc_min ? well.factor.concentration : conc_min;
            conc_max = well.factor.concentration > conc_max ? well.factor.concentration : conc_max;
        }
        num_chemicals = chemical_groups[chemical_name].length;
        CURRENT_SCREEN_DATA["chemicals"][chemical_name] = ({
            "chemical" : chemical_name,
            "aliases" : chemical_groups[chemical_name][0].factor.chemical.aliases,
            "ph_min": ph_min != Infinity ? ph_min : undefined,
            "ph_max": ph_max != -Infinity ? ph_max : undefined,
            "conc_min": conc_min,
            "conc_max": conc_max,
            "appearances" : num_chemicals
        });
    }
    let screen_tabulator = Tabulator.findTable('#screen-report-tabulator')[0];
    screen_tabulator.setData(Object.values(CURRENT_SCREEN_DATA["chemicals"]));
    $("#screen-report #condition-num").text(round(CURRENT_SCREEN_DATA["num_conditions"]));
    $("#screen-report #chemical-num").text(round(CURRENT_SCREEN_DATA["num_chemicals"]));
    $("#screen-report #avg-conditions-num").text(round(CURRENT_SCREEN_DATA["num_conditions"] / CURRENT_SCREEN_DATA["num_wells"]));
    // if only one screen has been selected then dont show screen comparison
    if (LAST_SCREEN_DATA == null)
        return;
    // num1 is the current scree num2 is the last and num3 stores comparison
    $("#condition-num1").text(round(CURRENT_SCREEN_DATA["num_conditions"]));
    $("#chemical-num1").text(round(CURRENT_SCREEN_DATA["num_chemicals"]));
    $("#condition-num2").text(round(LAST_SCREEN_DATA["num_conditions"]));
    $("#chemical-num2").text(round(LAST_SCREEN_DATA["num_chemicals"]));
    $("#avg-conditions-num1").text(round(CURRENT_SCREEN_DATA["num_conditions"] / CURRENT_SCREEN_DATA["num_wells"]));
    $("#avg-conditions-num2").text(round(LAST_SCREEN_DATA["num_conditions"] / LAST_SCREEN_DATA["num_wells"]));
    $("#screen-name1").text(CURRENT_SCREEN_DATA["screen_name"]);
    $("#screen-name2").text(LAST_SCREEN_DATA["screen_name"]);

    first_chemical_set = new Set(Object.keys(CURRENT_SCREEN_DATA["chemicals"]));
    second_chemical_set = new Set(Object.keys(LAST_SCREEN_DATA["chemicals"]));
    shared_chemical_set = first_chemical_set.intersection(second_chemical_set);
    $("#chemical-num3").text(shared_chemical_set.size);

    // we make wells into strings of their chemical names and then sort them so we can put them in an array and get an intersection
    first_well_array = Object.values(CURRENT_SCREEN_DATA["well_groups"]).map(well => well.map(factor => factor.factor.chemical.name));
    first_well_array.forEach(well => well.sort())
    first_well_array = first_well_array.map(well => well.join());
    second_well_array = Object.values(LAST_SCREEN_DATA["well_groups"]).map(well => well.map(factor => factor.factor.chemical.name));
    second_well_array.forEach(well => well.sort())
    second_well_array = second_well_array.map(well => well.join());

    shared_well_set = new Set(first_well_array).intersection(new Set(second_well_array));
    console.log(shared_well_set);
    $("#condition-num3").text(shared_well_set.size);


    combined_screen_data = {};
    for (chemical_name of shared_chemical_set) {
        combined_screen_data[chemical_name] = {
            "chemical" : chemical_name,
            "aliases" : CURRENT_SCREEN_DATA["chemicals"][chemical_name]["aliases"],
            "ph_min1": CURRENT_SCREEN_DATA["chemicals"][chemical_name]["ph_min"],
            "ph_max1": CURRENT_SCREEN_DATA["chemicals"][chemical_name]["ph_max"],
            "conc_min1": CURRENT_SCREEN_DATA["chemicals"][chemical_name]["conc_min"],
            "conc_max1": CURRENT_SCREEN_DATA["chemicals"][chemical_name]["conc_max"],
            "appearances1": CURRENT_SCREEN_DATA["chemicals"][chemical_name]["appearances"],
            "ph_min2": LAST_SCREEN_DATA["chemicals"][chemical_name]["ph_min"],
            "ph_max2": LAST_SCREEN_DATA["chemicals"][chemical_name]["ph_max"],
            "conc_min2": LAST_SCREEN_DATA["chemicals"][chemical_name]["conc_min"],
            "conc_max2": LAST_SCREEN_DATA["chemicals"][chemical_name]["conc_max"],
            "appearances2": LAST_SCREEN_DATA["chemicals"][chemical_name]["appearances"],
        };
    }
    let compare_tabulator = Tabulator.findTable('#screen-compare-tabulator')[0];
    compare_tabulator.setData(Object.values(combined_screen_data));

}

// Cancelling the viewing of a screen
function hide_screen(){
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.deselectRow();
    $('#screen-info-view-div').hide();
    $('#screens-half-div').css('width', '100%');
    $('#screen-info-view-title').text('');
}

// Go to chemical tab and filter chemicals by the selected on here
function view_chemical(row){
    site_functions.request_content('chemical_list', 'filter_chemical', row.getData().factor.chemical);
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. create table and event handlers)
// ========================================================================== //

$(document).ready(function() {

// Tabulator table
var screen_table = new Tabulator("#screen-tabulator", {
    ajaxURL: site_functions.API_URL+"/screens/query",
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
            width: 400,
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
            resizable: true, 
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
    layout: "fitColumns",
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
            sorter: "number",
            headerSort: false,
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        // Action buttons
        }, {
            title: "", 
            field: "actions", 
            width: 120, 
            // Depeding on whether a row is selected, if some other row is selected or if no row selected display apporpriate button
            formatter: function (cell, formatterParams, onRendered){
                div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
                    $('<tr>').append(
                        $('<td>').append(
                            $('<button>').
                            attr('class', 'view-chem-button table-cell-button').
                            text('Chemical')
                        )
                    )));
                return div.prop('outerHTML');
            }, 
            // When the cell is clicked, check if or which button has been clicked and perform the right action
            cellClick: function(e, cell){
                target = $(e.target);
                if (target.hasClass('view-chem-button')) {
                    view_chemical(cell.getRow());
                }
            }, 
            headerSort: false, 
            hozAlign: "center", 
            vertAlign: "middle", 
            resizable: true, 
            frozen: true
    }],
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

        let selected_condition_button = null;
        let recipe_button = null;
        // If no factors in condition, don't allow selecting it or generating recipe
        if (group.getRows().length == 0){
            recipe_button = $('<button>').
            attr('class', 'recipe-button table-cell-button').
            attr('disabled', 'disabled').
            text('Recipe');
            selected_condition_button = $('<button>').
            attr('class', 'select-button table-cell-button').
            attr('disabled', 'disabled').
            text('Select');
        // Otherwise allow recipe generation and check if already selected
        } else {
            recipe_button = $('<button>').
            attr('class', 'recipe-button table-cell-button').
            text('Recipe');
            select_conditions = site_functions.get_selected_wells();
            // If already selected, allow deselecting it
            let found = false;
            for (i in select_conditions){
                if (select_conditions[i].well.id == group.getRows()[0].getData().well.id){
                    selected_condition_button = $('<button>').
                    attr('class', 'delete-button table-cell-button').
                    text('Deselect');
                    found = true;
                    break;
                }
            }
            // If not already selected, allow selecting it
            if (!found){
                selected_condition_button = $('<button>').
                attr('class', 'select-button table-cell-button').
                text('Select');
            }
        }
        

        let div = $('<table>').attr('class', 'screen-well-header-button-table button-table').append($('<tbody>').append(
            $('<tr>').append(
                $('<td>').append(selected_condition_button)
            ).append(
                $('<td>').append(recipe_button)
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
            select_condition(group, target);
        } else if (target.hasClass('delete-button')) {
            remove_condition(group, target);
        } else if (target.hasClass('recipe-button')) {
            condition_recipe(group);
        }
});

// Refresh button
$('#reload-all-screens-button').click(function(){
    hide_screen();
    screen_table.setData(site_functions.API_URL+'/screens/query', null, "POST");
    LAST_QUERY = null;
    screen_table.hideColumn('well_match_counter');
    screen_table.setSort([{column:"screen.name", dir:"asc"}]);
    screen_table.clearFilter(true);
});

var screen_report = new Tabulator("#screen-report-tabulator",  {
    data: [],
    ajaxContentType: 'json',
    height: "100%",
    layout: "fitColumns",
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
        // Chemical
        {
            title: "Chemical", 
            field: "chemical", 
            vertAlign: "middle",
            headerMenu: column_menu,
            width: 350,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.chemical.toLowerCase().includes(term.toLowerCase())){
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
            // Display only name and alias count from the chemical object in the cell
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getValue() == null){
                    return "";
                } else {
                    return cell.getValue() + (cell.getData().aliases.length ? ' (aliases: ' + cell.getData().aliases.length + ')' : "");
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.localeCompare(b);
            }

        // Concentration
        }, {
            title: "Min Concentration", 
            field: "conc_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 200,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter",
            formatter: function(cell, formatterParams, onRendered){
                return cell.getData().conc_min.toFixed(1);
            },
            
        // Unit
        }, {
            title: "Max Concentration", 
            field: "conc_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 200,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter",
            formatter: function(cell, formatterParams, onRendered){
                return cell.getData().conc_max.toFixed(1);
            },
            
        // Unit
        },  {
            title: "Min pH", 
            field: "ph_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Max pH", 
            field: "ph_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Appearances", 
            field: "appearances", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 150,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }
],
    initialSort: [
        {column: "chemical", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'well-row-count')).append($('<span>').attr('id', 'filtered-well-row-count')).prop('outerHTML')
});

var screen_compare = new Tabulator("#screen-compare-tabulator",  {
    data: [],
    ajaxContentType: 'json',
    height: "100%",
    layout: "fitColumns",
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
        // Chemical
        {
            title: "Chemical", 
            field: "chemical", 
            vertAlign: "middle",
            headerMenu: column_menu,
            width: 350,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            // Header filter also searches names and aliases
            headerFilterFunc: function (term, cell_val, row_data, filter_params){
                if (row_data.chemical.toLowerCase().includes(term.toLowerCase())){
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
            // Display only name and alias count from the chemical object in the cell
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getValue() == null){
                    return "";
                } else {
                    return cell.getValue() + (cell.getData().aliases.length ? ' (aliases: ' + cell.getData().aliases.length + ')' : "");
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.localeCompare(b);
            }

        // Concentration
        }, {
        title:"Screen 1",
        headerHozAlign : "center", 
        columns: [{
            title: "Min pH", 
            field: "ph_min1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Max pH", 
            field: "ph_max1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min Concentration", 
            field: "conc_min1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Max concentration", 
            field: "conc_max1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Appearances", 
            field: "appearances1", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            }]
        }, {
        title:"Screen 2",
        headerHozAlign : "center", 
        columns: [{
            title: "Min pH", 
            field: "ph_min2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Max pH", 
            field: "ph_max2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min Concentration", 
            field: "conc_min2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"

        }, {
            title: "Max concentration", 
            field: "conc_max2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Appearances", 
            field: "appearances2", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
            }]
        },
],
    initialSort: [
        {column: "chemical", dir: "asc"}
    ],
    footerElement: $('<div>').append($('<span>').attr('id', 'well-row-count')).append($('<span>').attr('id', 'filtered-well-row-count')).prop('outerHTML')
});


// disable all menu buttons and hide all displayed divs
function reset_info() {
    $('#view-wells-button').prop("disabled", "");
    $('#compare-screens-button').prop("disabled", "");
    $('#screen-subsets-button').prop("disabled", "");
    $('#screen-make-recipe-button').prop("disabled", "");
    $('#screen-report-button').prop("disabled", "");

    $('#screen-wells-view-tabulator').hide();
    $('#screen-report').hide();
    $('#compare-screens').hide();
}

$('#view-wells-button').click(function() {
    reset_info();
    $('#view-wells-button').prop("disabled", "disabled");
    $('#screen-wells-view-tabulator').show();
});

$('#compare-screens-button').click(function() {
    reset_info();
    $('#compare-screens-button').prop("disabled", "disabled");
    $('#compare-screens').show();
});

$('#screen-subsets-button').click(function() {
    site_functions.alert_user("TODO! 👨‍💻");
});

$('#screen-make-recipe-button').click(function() {
    site_functions.alert_user("Soon to be implemented! 🚴‍♂️");
});

$('#screen-report-button').click(function() {
    reset_info();
    $('#screen-report-button').prop("disabled", "disabled");
    $('#screen-report').show();
    
});

$('#hide-screen-view-button').click(function() {
    hide_screen();
});

// Propagate message passing after tables have loaded
Promise.all([
    new Promise(function(resolve, reject){
        screen_table.on('tableBuilt', resolve);
    }), 
    new Promise(function(resolve, reject){
        well_table.on('tableBuilt', resolve);
    })
]).then(function(){
    site_functions.propagate_message_passing();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();