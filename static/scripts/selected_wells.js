//# sourceURL=selected_wells.js
(function(){

$(document).ready(function() { 


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

// Function for custom footer to show number of factors when data loaded
function update_well_count_loaded(data){
    $('#selected-wells-subpage #well-row-count').text(data.length + ' Factors');
}

// Function for custom footer to show number of factors when filter run
function update_well_count_filtered(filters, rows){
    if (filters.length > 0){
        $('#selected-wells-subpage #filtered-well-row-count').text(' (' + rows.length + ' Shown)');
    } else {
        $('#selected-wells-subpage #filtered-well-row-count').text('');
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

// Function for when a well is unselected
function remove_condition(factor_group, target){
    let rows = factor_group.getRows();
    let subgroups = factor_group.getSubGroups();
    if (subgroups.length != 0) {
        let ff = subgroups[0].getRows()[0].getData();
        site_functions.remove_selected_well_by_screen(ff);
    } else if (rows.length == 0){
        site_functions.alert_user("Empty condition, nothing to remove.");
    } else {
        let ff = rows[0].getData();
        site_functions.remove_selected_well(ff);
        target.removeClass('delete-button');
        target.text('Select');
        target.addClass('select-button');
    }
}

// Go to chemical tab and filter chemicals by the selected on here
function view_chemical(row){
    site_functions.request_content('chemical_list', 'filter_chemical', row.getData().factor.chemical);
}


// Tabulator table
var well_table = new Tabulator("#wells-tabulator", {
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

        // Screen id
        }, {
            title: "Screen", 
            visible: false,
            field: "screen_name", 
            vertAlign: "middle",
            width: 85,
            headerMenu: column_menu,
            headerSort: false,
            headerFilter: "list",
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
    groupBy: ["screen_name", "well.label"]
    ,
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
        
        // If a group just has rows in it then it is a well and you can make recipes from it
        if (group.getSubGroups().length == 0) {
            recipe_button = $('<button>').
            attr('class', 'recipe-button table-cell-button').
            text('Recipe');
        }
        
        selected_condition_button = $('<button>').
        attr('class', 'delete-button table-cell-button').
        text('Deselect');

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

hit_report_comments = document.getElementById("hit-report-comments");

generate_hit_report = document.getElementById("generate-hit-report");
generate_hit_report.addEventListener("click", (e) => {
    const doc = jsPDF();
    let pdf_y_position = 20;

    if (hit_report_comments.value != "") {
        doc.text("Comments: ", 10, pdf_y_position);
        pdf_y_position += 10;

        comments = doc.splitTextToSize(hit_report_comments.value, 190);
        for (comment_number in comments) {
            doc.text(comments[comment_number], 10, pdf_y_position);
            pdf_y_position += 10;
        }
        pdf_y_position += 5;

    }

    

    // doc.text("Screens: ", 10, pdf_y_position);
    // pdf_y_position += 10;

    selected_wells = site_functions.get_selected_wells();
    grouped_screens = Object.groupBy(selected_wells, ({screen_name}) => {return screen_name});
    

    for (screen_name in grouped_screens) {
        doc.setFontSize(16);
        doc.text("Screen " + screen_name + ": ", 10, pdf_y_position);
        grouped_factors_by_well = Object.groupBy(grouped_screens[screen_name], (screen) => {return screen.well.label});
        pdf_y_position += 10;
        for (well_name in grouped_factors_by_well) {
            factors = grouped_factors_by_well[well_name];
            pdf_y_position += 5;
            doc.setFontSize(14);
            if ((factors.length + 1) * 10 + pdf_y_position > 290) {
                doc.addPage();
                pdf_y_position = 20;
            }
            doc.text("Well " + factors[0].well.label + " contains: ", 10, pdf_y_position);
            pdf_y_position += 10;
            for (factor_number in factors) {
                stat_string = "";
                stat_string += factors[factor_number].factor.concentration + " ";
                stat_string += factors[factor_number].factor.unit + " ";
                stat_string += factors[factor_number].factor.chemical.name + " ";
                doc.text(stat_string, 20, pdf_y_position);
                pdf_y_position += 10;
            }
        }
        pdf_y_position += 10;
    }

    doc.addPage();
    pdf_y_position = 20;
    
    doc.setFontSize(18);
    doc.text("Chemistry range table: ", 10, pdf_y_position);
    pdf_y_position += 10;

    column_1 = 10;
    column_2 = 40;
    column_3 = 70;
    column_4 = 105;
    column_5 = 125;
    column_6 = 180;

    doc.setFontSize(14);
    doc.setFontStyle('bold');
    doc.text("Class", column_1, pdf_y_position);
    doc.text("Avg Conc", column_2, pdf_y_position);
    doc.text("Conc Range", column_3, pdf_y_position);
    doc.text("Units", column_4, pdf_y_position);
    doc.text("Name", column_5, pdf_y_position);
    doc.text("Count", column_6, pdf_y_position);
    pdf_y_position += 10;
    doc.setFontSize(10);

    doc.setFontStyle('normal');
    grouped_factors = Object.groupBy(selected_wells, (ff) => {return ff.factor.chemical.name});
    factor_data = [];
    for (factor_name in grouped_factors) {
        total_concentration = 0;
        max_concentration = 0;
        min_concentration = Infinity;
        for (factor in grouped_factors[factor_name]) {
            ff = grouped_factors[factor_name][factor];
            total_concentration += ff.factor.concentration;
            max_concentration = Math.max(max_concentration, ff.factor.concentration);
            min_concentration = Math.min(min_concentration, ff.factor.concentration);

        }
        count = grouped_factors[factor_name].length;

        factor_data.push({name: factor_name,
            avg: (Math.floor((total_concentration / count) * 10000) / 10000).toString(),
            range: [min_concentration, max_concentration], 
            units: grouped_factors[factor_name][0].factor.unit, 
            count: count.toString()});
    }
    factor_data.sort((a, b) => { 
        if (b.count != a.count)
            return b.count - a.count;
        else
            return b.avg - a.avg
    });

    for (factor of factor_data) {
        doc.text("Class?", column_1, pdf_y_position);
        doc.text(factor.avg, column_2, pdf_y_position);
        doc.text(factor.range[0] != factor.range[1] ? factor.range[0] + " - " + factor.range[1] : "", column_3, pdf_y_position);
        doc.text(factor.units, column_4, pdf_y_position);
        doc.text(factor.name, column_5, pdf_y_position);
        doc.text(factor.count, column_6, pdf_y_position);
        pdf_y_position += 10;
        if (pdf_y_position > 285) {
            doc.addPage();
            pdf_y_position = 20;
        }

    }

    

    doc.save("HitReport.pdf");
})




// Propagate message passing after tables have loaded
Promise.all([
    new Promise(function(resolve, reject){
        well_table.on('tableBuilt', resolve);
    })
]).then(function(){

    well_table.setData(site_functions.get_selected_wells());
    window.addEventListener("SelectedWellChange", e => { well_table.setData(site_functions.get_selected_wells()) });

    site_functions.propagate_message_passing();
});

});

})(); 