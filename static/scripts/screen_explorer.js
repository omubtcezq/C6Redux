//# sourceURL=screen_explorer.js
site_functions.CONTENT_PROVIDERS.screen_explorer = (function() {

// Store query that produced screen list if there was one, so wells can be flagged
var LAST_QUERY = null;
var CURRENT_SELECTED_SCREEN = null;
var LAST_SELECTED_SCREEN = null;
var controller = new AbortController();
var signal = controller.signal;

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

function csv_cell(value){
    let text = value == null ? "" : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
}

function stock_description(stock){
    let factor = stock.factor || {};
    let chemical = factor.chemical || {};
    return {
        name: stock.name || "",
        concentration: factor.concentration == null ? "" : factor.concentration,
        unit: factor.unit || "",
        ph: factor.ph == null ? "" : factor.ph,
        display_name: stock.name || chemical.name || ""
    };
}

function recipe_stocks_for_well(recipe, scale){
    scale = scale || 1;
    let recipe_stocks = (recipe.stocks || []).map(stock_volume => ({
        stock: stock_description(stock_volume.stock),
        volume: stock_volume.volume * scale
    }));
    if (recipe.water > 0){
        recipe_stocks.push({
            stock: {name: "Water", concentration: "", unit: "", ph: "", display_name: "Water"},
            volume: recipe.water * scale
        });
    }
    return recipe_stocks;
}

function download_recipe_csv(recipes_by_condition, wells, format, screen_name, filename_format, scale){
    let csv_rows = [];
    if (format === "stock"){
        csv_rows.push(["Stock Name", "Stock Concentration", "Stock pH", "Dispensed Volume (mL)", "Well", "Status"]);
        for (let well of wells){
            let recipe = recipes_by_condition[well.wellcondition_id];
            if (!recipe.success){
                csv_rows.push(["", "", "", "", well.label, recipe.msg || "Recipe unavailable"]);
                continue;
            }
            for (let recipe_stock of recipe_stocks_for_well(recipe, scale)){
                csv_rows.push([
                    recipe_stock.stock.display_name,
                    recipe_stock.stock.concentration === "" ? "" : recipe_stock.stock.concentration + " " + recipe_stock.stock.unit,
                    recipe_stock.stock.ph,
                    recipe_stock.volume,
                    well.label,
                    "Ready"
                ]);
            }
        }
    } else {
        csv_rows.push(["Well", "Dispensed Volume (mL)", "Stock Name", "Stock Concentration", "Stock pH", "Status"]);
        for (let well of wells){
            let recipe = recipes_by_condition[well.wellcondition_id];
            if (!recipe.success){
                csv_rows.push([well.label, "", "", "", "", recipe.msg || "Recipe unavailable"]);
                continue;
            }
            for (let recipe_stock of recipe_stocks_for_well(recipe, scale)){
                csv_rows.push([
                    well.label,
                    recipe_stock.volume,
                    recipe_stock.stock.display_name,
                    recipe_stock.stock.concentration === "" ? "" : recipe_stock.stock.concentration + " " + recipe_stock.stock.unit,
                    recipe_stock.stock.ph,
                    "Ready"
                ]);
            }

            function download_recipe_by_stock(recipes_by_condition, wells, screen_name, scale){
                let rows = [["Stock Name", "Stock Concentration", "Stock pH", "Well", "Dispensed Volume (mL)", "Status"]];
                let stocks = {};
                wells.forEach(well => {
                    let recipe = recipes_by_condition[well.wellcondition_id];
                    if (!recipe || !recipe.success){
                        rows.push(["", "", "", well.label, "", recipe && recipe.msg || "Recipe unavailable"]);
                        return;
                    }
                    recipe_stocks_for_well(recipe, scale).forEach(recipe_stock => {
                        let key = recipe_stock.stock.display_name + "\u0000" + recipe_stock.stock.concentration + "\u0000" + recipe_stock.stock.unit + "\u0000" + recipe_stock.stock.ph;
                        if (!stocks[key]){
                            stocks[key] = {stock: recipe_stock.stock, wells: []};
                        }
                        stocks[key].wells.push({label: well.label, volume: recipe_stock.volume});
                    });
                });
                Object.keys(stocks).forEach(key => {
                    let entry = stocks[key];
                    entry.wells.forEach(well => rows.push([
                        entry.stock.display_name,
                        entry.stock.concentration === "" ? "" : entry.stock.concentration + " " + entry.stock.unit,
                        entry.stock.ph,
                        well.label,
                        well.volume,
                        "Ready"
                    ]));
                });
                let blob = new Blob(["\ufeff" + rows.map(row => row.map(csv_cell).join(",")).join("\r\n")], {type: "text/csv;charset=utf-8;"});
                let link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = (screen_name || "screen").replace(/[^\w.-]+/g, "_") + "_recipe_by_stock.csv";
                document.body.appendChild(link);
                link.click();
                URL.revokeObjectURL(link.href);
                link.remove();
            }
        }
    }

    let csv = csv_rows.map(row => row.map(csv_cell).join(",")).join("\r\n");
    let blob = new Blob(["\ufeff" + csv], {type: "text/csv;charset=utf-8;"});
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    let safe_screen_name = (screen_name || "screen").replace(/[^\w.-]+/g, "_");
    link.download = safe_screen_name + "_recipe_" + (filename_format || (format === "stock" ? "by_stock" : "by_well")) + ".csv";
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
}

function export_factor_rows(wells){
    let rows = [];
    for (let well of wells){
        for (let factor of ((well.wellcondition && well.wellcondition.factors) || [])){
            rows.push({
                well: well.label,
                name: (factor.chemical && factor.chemical.name) || "",
                concentration: factor.concentration,
                unit: factor.unit || "",
                ph: factor.ph == null ? "" : factor.ph
            });
        }
    }
    return rows;
}

function xml_escape(value){
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render_screen_export(wells, recipes_by_condition, format, screen_name, screen, scale){
    if (format === "recipe-factor"){
        download_recipe_csv(recipes_by_condition, wells, "stock", screen_name, "by_factor", scale);
        return;
    }
    if (format === "recipe-stock"){
        download_recipe_by_stock(recipes_by_condition, wells, screen_name, scale);
        return;
    }
    let factors = export_factor_rows(wells);
    let csv_rows = [];
    let content = "";
    let extension = "txt";
    if (format === "csv-row"){
        csv_rows = [["Well", "pH", "Buffer", "Concentration", "Unit", "Chemical"]];
        factors.forEach(row => csv_rows.push([row.well, row.ph, "", row.concentration, row.unit, row.name]));
        content = csv_rows.map(row => row.map(csv_cell).join(",")).join("\r\n");
        extension = "csv";
    } else if (format === "csv-cell"){
        let by_well = {};
        factors.forEach(row => {
            if (!by_well[row.well]){
                by_well[row.well] = [];
            }
            by_well[row.well].push(row);
        });
        let rows = screen.format_rows || Math.max(...wells.map(well => well.label.charCodeAt(0) - 64));
        let columns = screen.format_cols || Math.max(...wells.map(well => Number(well.label.match(/\d+/)[0])));
        csv_rows = [[""].concat(Array.from({length: columns}, (_, index) => index + 1))];
        for (let row = 0; row < rows; row++){
            let row_label = String.fromCharCode(65 + row);
            let csv_row = [row_label];
            for (let column = 1; column <= columns; column++){
                let well = row_label + column;
                csv_row.push((by_well[well] || []).map(item =>
                    `${item.concentration} ${item.unit} ${item.name}${item.ph === "" ? "" : " pH " + item.ph}`
                ).join("\n"));
            }
            csv_rows.push(csv_row);
        }
        content = csv_rows.map(row => row.map(csv_cell).join(",")).join("\r\n");
        extension = "csv";
    } else if (format === "text"){
        content = `Screen name: ${screen_name}\r\n\r\n` + wells.map(well => {
            let entries = factors.filter(row => row.well === well.label)
                .map(row => `${row.concentration} ${row.unit} ${row.name}${row.ph === "" ? "" : ", pH=" + row.ph}`);
            return `${well.label} ${entries.join("; ")};`;
        }).join("\r\n");
    } else if (format === "xml" || format === "recipe"){
        let root = format === "recipe" ? "recipe" : "crystaltrak";
        content = `<?xml version="1.0" encoding="UTF-8"?>\r\n<${root} screen="${xml_escape(screen_name)}">\r\n`;
        wells.forEach(well => {
            content += `  <well label="${xml_escape(well.label)}">\r\n`;
            factors.filter(row => row.well === well.label).forEach(row => {
                content += `    <item name="${xml_escape(row.name)}" concentration="${xml_escape(row.concentration)}" unit="${xml_escape(row.unit)}" ph="${xml_escape(row.ph)}"/>\r\n`;
            });
            content += "  </well>\r\n";
        });
        content += `</${root}>\r\n`;
        extension = "xml";
    } else if (format === "mmcif"){
        content = "loop_\r\n_exptl_crystal_grow_comp.screen_name\r\n_exptl_crystal_grow_comp.well_id\r\n_exptl_crystal_grow_comp.sol_id\r\n_exptl_crystal_grow_comp.name\r\n_exptl_crystal_grow_comp.conc\r\n_exptl_crystal_grow_comp.unit\r\n_exptl_crystal_grow_comp.ph\r\n";
        factors.forEach((row, index) => {
            content += `'${screen_name}' ${row.well} 2 '${row.name}' ${row.concentration} ${row.unit} ${row.ph === "" ? "." : row.ph}\r\n`;
        });
        extension = "cif";
    } else if (format === "dragonfly"){
        let columns = Math.max(...wells.map(well => Number(well.label.match(/\d+/)[0])));
        let rows = Math.max(...wells.map(well => well.label.charCodeAt(0) - 64));
        let recipe_stocks = {};
        wells.forEach(well => {
            let recipe = recipes_by_condition[well.wellcondition_id];
            if (recipe && recipe.success){
                recipe_stocks_for_well(recipe, scale).forEach(recipe_stock => {
                    let stock_name = recipe_stock.stock.display_name;
                    if (!recipe_stocks[stock_name]){
                        recipe_stocks[stock_name] = {};
                    }
                    recipe_stocks[stock_name][well.label] = recipe_stock.volume;
                });
            }
        });
        content = "version ,'1.1\n";
        Object.keys(recipe_stocks).forEach(stock_name => {
            content += `"${stock_name}"\n`;
            for (let row = 0; row < rows; row++){
                let values = [];
                for (let column = 1; column <= columns; column++){
                    let label = String.fromCharCode(65 + row) + column;
                    values.push(Number(recipe_stocks[stock_name][label] || 0).toFixed(6));
                }
                content += values.join(",") + "\n";
            }
        });
        extension = "csv";
    }
    let blob = new Blob([content], {type: extension === "csv" ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;"});
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    let safe_screen_name = (screen_name || "screen").replace(/[^\w.-]+/g, "_");
    let format_name = {
        "csv-row": "design_factors",
        "csv-cell": "design_cells",
        "text": "design_txt",
        "xml": "design_rigaku_xml",
        "mmcif": "design_mmcif",
        "recipe-factor": "recipe_by_factor",
        "recipe-stock": "recipe_by_stock",
        "dragonfly": "recipe_dragonfly"
    }[format] || format;
    link.download = safe_screen_name + "_recipe_" + format_name + "." + extension;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
}

function choose_recipe_csv_format(screen){
    $("#recipe-format-popup").css("display", "block");
    $("#site-popup-container").show();
    $("#recipe-format-select").off("change").on("change", function(){
        $("#recipe-scale-controls").toggle(this.value === "recipe-factor" ||
            this.value === "recipe-stock" || this.value === "dragonfly");
    }).trigger("change");
    $("#recipe-format-print-button").off("click").click(function(){
        $("#recipe-format-cancel-button").click();
        let scale = Number($("#recipe-scale-input").val());
        if (!Number.isFinite(scale) || scale <= 0){
            site_functions.alert_user("Recipe scale must be greater than zero.");
            return;
        }
        download_screen_csv(screen, $("#recipe-format-select").val(), scale);
    });
}

function open_screen_recipe_report(screen){
    $.get(site_functions.API_URL + "/screens/wells", {screen_id: screen.id})
        .done(function(wells){
            let requests = {};
            wells.forEach(well => {
                if (!requests[well.wellcondition_id]){
                    requests[well.wellcondition_id] = $.get(
                        site_functions.API_URL + "/screens/conditionRecipe",
                        {condition_id: well.wellcondition_id}
                    );
                }
            });
            Promise.all(Object.keys(requests).map(id => requests[id])).then(function(recipes){
                let by_condition = {};
                Object.keys(requests).forEach((id, index) => by_condition[id] = recipes[index]);
                let report_window = window.open("", "_blank");
                if (!report_window){
                    site_functions.alert_user("Please allow popups to open the screen recipe.");
                    return;
                }
                let rows = wells.map(well => {
                    let factors = (well.wellcondition && well.wellcondition.factors) || [];
                    let condition = factors.map(factor =>
                        xml_escape(`${factor.concentration} ${factor.unit} ${(factor.chemical || {}).name || ""}${factor.ph == null ? "" : ", pH=" + factor.ph}`)
                    ).join("<br>");
                    let recipe = by_condition[well.wellcondition_id];
                    let instructions = recipe && recipe.success
                        ? recipe_stocks_for_well(recipe, 1).map(item =>
                            `${(item.volume * 1000).toFixed(1)} ul of: ${xml_escape(item.stock.display_name)}`
                        ).join("<br>")
                        : xml_escape(recipe && recipe.msg || "Recipe unavailable");
                    return `<tr><td>${xml_escape(well.label)} (${well.position_number})</td><td>${condition}</td><td>${instructions}</td></tr>`;
                }).join("");
                report_window.document.write(`<!doctype html><html><head><title>${xml_escape(screen.name)} - Screen Recipe</title>
<style>body{font-family:Arial,sans-serif;margin:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #222;padding:7px;vertical-align:top}th{background:#eee}.actions{margin-bottom:14px}@media print{.actions{display:none}}</style>
</head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>${xml_escape(screen.name)} - Screen Recipe</h1><p><b>Owner:</b> ${xml_escape(screen.owned_by || "")}</p>
<table><thead><tr><th>Well</th><th>Condition</th><th>Recipe (1 mL final volume)</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
                report_window.document.close();
                report_window.focus();
            }).catch(function(){
                site_functions.alert_user("Unable to generate the screen recipe.");
            });
        })
        .fail(function(){
            site_functions.alert_user("Unable to load the screen wells.");
        });
}

function download_screen_csv(screen, format, scale){
    $.get(site_functions.API_URL + "/screens/wells", {screen_id: screen.id})
        .done(function(wells){
            let recipe_requests = {};
            for (let well of wells){
                if (!recipe_requests[well.wellcondition_id]){
                    recipe_requests[well.wellcondition_id] = $.get(
                        site_functions.API_URL + "/screens/conditionRecipe",
                        {condition_id: well.wellcondition_id}
                    );
                }

                function open_screen_recipe_report(screen){
                    $.get(site_functions.API_URL + "/screens/wells", {screen_id: screen.id})
                        .done(function(wells){
                            let recipe_requests = {};
                            for (let well of wells){
                                if (!recipe_requests[well.wellcondition_id]){
                                    recipe_requests[well.wellcondition_id] = $.get(
                                        site_functions.API_URL + "/screens/conditionRecipe",
                                        {condition_id: well.wellcondition_id}
                                    );
                                }
                            }
                            Promise.all(Object.keys(recipe_requests).map(condition_id => recipe_requests[condition_id]))
                                .then(function(recipes){
                                    let recipes_by_condition = {};
                                    Object.keys(recipe_requests).forEach((condition_id, index) => {
                                        recipes_by_condition[condition_id] = recipes[index];
                                    });
                                    render_screen_recipe_report(screen, wells, recipes_by_condition);
                                })
                                .catch(function(){
                                    site_functions.alert_user("Unable to generate the screen recipe.");
                                });
                        })
                        .fail(function(){
                            site_functions.alert_user("Unable to load the screen wells.");
                        });
                }

                function render_screen_recipe_report(screen, wells, recipes_by_condition){
                    const report_window = window.open("", "_blank");
                    if (!report_window){
                        site_functions.alert_user("Please allow popups to open the screen recipe.");
                        return;
                    }

                    let condition_count = wells.length;
                    let chemicals = {};
                    let total_factors = 0;
                    let rows = "";
                    for (let well of wells){
                        let factors = (well.wellcondition && well.wellcondition.factors) || [];
                        total_factors += factors.length;
                        factors.forEach(factor => {
                            if (factor.chemical_id != null){
                                chemicals[factor.chemical_id] = true;
                            }
                        });
                        let recipe = recipes_by_condition[well.wellcondition_id];
                        let condition_text = factors.map(factor => {
                            let chemical_name = factor.chemical && factor.chemical.name || "";
                            let ph = factor.ph == null ? "" : `, pH=${factor.ph}`;
                            return xml_escape(`${factor.concentration} ${factor.unit} ${chemical_name}${ph}`);
                        }).join("<br>");
                        let recipe_text = "";
                        if (recipe && recipe.success){
                            recipe_text += `&gt; ${xml_escape(well.label)}<br>`;
                            recipe_stocks_for_well(recipe, 1).forEach(recipe_stock => {
                                let stock = recipe_stock.stock;
                                let concentration = stock.concentration === "" ? "" : ` (${stock.concentration} ${stock.unit})`;
                                recipe_text += `${(recipe_stock.volume * 1000).toFixed(1)} ul of: ${xml_escape(stock.display_name)}${xml_escape(concentration)}<br>`;
                            });
                        } else {
                            recipe_text = `<span class="error">${xml_escape(recipe && recipe.msg || "Recipe unavailable")}</span>`;
                        }
                        let well_ph = factors.find(factor => factor.ph != null);
                        rows += `<tr>
                            <td>${xml_escape(well.label)} (${well.position_number})</td>
                            <td>${condition_text}</td>
                            <td>${well_ph ? xml_escape(well_ph.ph) : ""}</td>
                            <td>${recipe_text}</td>
                        </tr>`;
                    }

                    let average_factors = condition_count ? (total_factors / condition_count).toFixed(1) : "0.0";
                    report_window.document.write(`<!doctype html>
                <html>
                <head>
                <title>${xml_escape(screen.name)} - Screen Recipe</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 22px; color: #111; }
                  h1 { font-size: 20px; margin: 0 0 12px; }
                  .actions { margin-bottom: 14px; }
                  button { font-size: 15px; padding: 5px 12px; }
                  .metadata { border-collapse: collapse; width: 82%; margin-bottom: 22px; }
                  .metadata td { border: 1px solid #bbb; padding: 4px 10px; }
                  .metadata td:first-child { width: 190px; font-weight: bold; }
                  .recipe { border-collapse: collapse; width: 100%; }
                  .recipe th, .recipe td { border: 1px solid #222; padding: 7px 10px; vertical-align: top; }
                  .recipe th { text-align: left; background: #eee; }
                  .recipe td:nth-child(1) { width: 9%; }
                  .recipe td:nth-child(2) { width: 35%; color: #426db3; }
                  .recipe td:nth-child(3) { width: 7%; }
                  .recipe td:nth-child(4) { width: 49%; }
                  .error { color: #b00000; }
                  @media print {
                    .actions { display: none; }
                    body { margin: 10mm; }
                  }
                </style>
                </head>
                <body>
                <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
                <h1>${xml_escape(screen.name)} - Screen Recipe</h1>
                <table class="metadata">
                  <tr><td>Screen name</td><td>${xml_escape(screen.name)}</td></tr>
                  <tr><td>Owner</td><td>${xml_escape(screen.owned_by || "")}</td></tr>
                  <tr><td>Well count</td><td>${condition_count}</td></tr>
                  <tr><td>Number of distinct chemicals</td><td>${Object.keys(chemicals).length}</td></tr>
                  <tr><td>Average factors per condition</td><td>${average_factors}</td></tr>
                </table>
                <table class="recipe">
                  <thead><tr><th>Well</th><th>Concentration, Units Chemical, pH</th><th>pH</th><th>Recipe (1 mL final volume)</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                </body>
                </html>`);
                    report_window.document.close();
                    report_window.focus();
                }
            }
            Promise.all(Object.keys(recipe_requests).map(condition_id => recipe_requests[condition_id]))
                .then(function(recipes){
                    let recipes_by_condition = {};
                    Object.keys(recipe_requests).forEach((condition_id, index) => {
                        recipes_by_condition[condition_id] = recipes[index];
                    });
                    render_screen_export(wells, recipes_by_condition, format, screen.name, screen, scale);
                })
                .catch(function(){
                    site_functions.alert_user("Unable to generate the recipe CSV.");
                });
        })
        .fail(function(){
            site_functions.alert_user("Unable to load the screen wells.");
        });
}

function open_screen_recipe_report(screen){
    $.get(site_functions.API_URL + "/screens/wells", {screen_id: screen.id})
        .done(function(wells){
            let requests = {};
            wells.forEach(well => {
                if (!requests[well.wellcondition_id]){
                    requests[well.wellcondition_id] = $.get(
                        site_functions.API_URL + "/screens/conditionRecipe",
                        {condition_id: well.wellcondition_id}
                    );
                }
            });
            Promise.all(Object.keys(requests).map(id => requests[id])).then(function(recipes){
                let by_condition = {};
                Object.keys(requests).forEach((id, index) => by_condition[id] = recipes[index]);
                const report_window = window.open("", "_blank");
                if (!report_window){
                    site_functions.alert_user("Please allow popups to open the screen recipe.");
                    return;
                }
                let body = wells.map(well => {
                    let factors = (well.wellcondition && well.wellcondition.factors) || [];
                    let recipe = by_condition[well.wellcondition_id];
                    let condition = factors.map(factor =>
                        xml_escape(`${factor.concentration} ${factor.unit} ${(factor.chemical || {}).name || ""}${factor.ph == null ? "" : ", pH=" + factor.ph}`)
                    ).join("<br>");
                    let instructions = recipe && recipe.success
                        ? recipe_stocks_for_well(recipe, 1).map(item =>
                            `${(item.volume * 1000).toFixed(1)} ul of: ${xml_escape(item.stock.display_name)}`
                        ).join("<br>")
                        : xml_escape(recipe && recipe.msg || "Recipe unavailable");
                    return `<tr><td>${xml_escape(well.label)} (${well.position_number})</td><td>${condition}</td><td>${instructions}</td></tr>`;
                }).join("");
                report_window.document.write(`<!doctype html><html><head><title>${xml_escape(screen.name)} - Screen Recipe</title>
<style>body{font-family:Arial,sans-serif;margin:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #222;padding:7px;vertical-align:top}th{background:#eee}.actions{margin-bottom:14px}@media print{.actions{display:none}}</style>
</head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>${xml_escape(screen.name)} - Screen Recipe</h1>
<p><b>Owner:</b> ${xml_escape(screen.owned_by || "")}</p>
<table><thead><tr><th>Well</th><th>Condition</th><th>Recipe (1 mL final volume)</th></tr></thead><tbody>${body}</tbody></table>
</body></html>`);
                report_window.document.close();
                report_window.focus();
            }).catch(function(){
                site_functions.alert_user("Unable to generate the screen recipe.");
            });
        })
        .fail(function(){
            site_functions.alert_user("Unable to load the screen wells.");
        });
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
            r.screen_name = CURRENT_SELECTED_SCREEN.name
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
// view_wells = true: doesn't stay on whatever option is currently selected and instead goes back to view wells
function view_screen(cell, view_wells = false){
    let screen_table = Tabulator.findTable('#screen-tabulator')[0];
    screen_table.deselectRow();
    // we have to find the right row because may be selecting from subset screens
    screen_table.getRow(cell.getData().screen.id).select();
    $('#screens-half-div').css('width', '50%');
    $('#screen-info-view-div').show();
    $('#screen-info-view-title').text(cell.getData().screen.name);
    LAST_SELECTED_SCREEN = CURRENT_SELECTED_SCREEN;
    CURRENT_SELECTED_SCREEN = cell.getData().screen;

    if (view_wells)
        $('#view-wells-button').click();
    else
        load_data_from_button_pressed();
}

function load_data_from_button_pressed() {
    controller.abort();
    controller = new AbortController();
    signal = controller.signal;

    if ($('#screen-wells').is(':visible')) {
        update_view_wells();
    }
    if ($('#subset-screens').is(':visible')) {
        update_subset_screen();
    }
    if ($('#similar-screens').is(':visible')) {
        update_similar_screens();
    }
    if ($('#compare-screens').is(':visible')) {
        update_compare_screen();
    }
    if ($('#screen-report').is(':visible')) {
        update_screen_report();
    }
}

function update_view_wells() {
    let well_table = Tabulator.findTable('#screen-wells-view-tabulator')[0];
    well_table.setData(site_functions.API_URL+'/screens/factorQuery?screen_id='+CURRENT_SELECTED_SCREEN.id, LAST_QUERY, "POST");
}

async function update_compare_screen() {
    const chemical_table = Tabulator.findTable('#chemical-compare-tabulator')[0];
    chemical_table.clearData();
    const condition_table = Tabulator.findTable('#condition-compare-tabulator')[0];
    condition_table.clearData();

    // if only one screen has been selected then dont show screen comparison
    if (LAST_SELECTED_SCREEN != null) {

        $("#comparison-info-grid").show();
        $("#second-select-warning").hide();

        $("#screen-diversity-num1").text("loading");
        $("#screen-diversity-num2").text("loading");
        $("#distance-between-screens").text("loading");
        $("#name-screen1").text(CURRENT_SELECTED_SCREEN.name);
        $("#name-screen2").text(LAST_SELECTED_SCREEN.name);

        const stats1 = fetch(site_functions.API_URL+"/screens/stats?screen_id=" + CURRENT_SELECTED_SCREEN.id, { signal }).then((response)=> {
            return response.json();
            }).then((data)=> {
                $("#condition-screen1").text(data.num_conditions);
                $("#chemical-screen1").text(data.unique_chemicals);
                $("#avg-factor-screen1").text(round(data.avg_factors_per_condition));
        });

        const stats2 = fetch(site_functions.API_URL+"/screens/stats?screen_id=" + LAST_SELECTED_SCREEN.id, { signal }).then((response)=> {
            return response.json();
        }).then((data)=> {
            $("#condition-screen2").text(data.num_conditions);
            $("#chemical-screen2").text(data.unique_chemicals);
            $("#avg-factor-screen2").text(round(data.avg_factors_per_condition));
        });

        const chem_table = chemical_table.setData(site_functions.API_URL+"/screens/compareScreen?screen_id1=" + CURRENT_SELECTED_SCREEN.id + "&screen_id2=" +  LAST_SELECTED_SCREEN.id, "POST")
        .then(() => {$("#shared-chemicals").text(chemical_table.getData().length);});
        


        const condition_compare_tabulator = Tabulator.findTable('#condition-compare-tabulator')[0];
        condition_compare_tabulator.setData(site_functions.API_URL+"/screens/compareScreenConditions?screen_id1=" + CURRENT_SELECTED_SCREEN.id + "&screen_id2=" +  LAST_SELECTED_SCREEN.id);


        // delete all the columns which are in groups to change the column group title
        chemical_table.getColumns().forEach(c => {if (c.getField() != "chemical") chemical_table.deleteColumn(c.getField())});
        compare_columns_group_screen1.title = CURRENT_SELECTED_SCREEN.name
        compare_columns_group_screen2.title = LAST_SELECTED_SCREEN.name
        chemical_table.addColumn(compare_columns_group_screen1);
        chemical_table.addColumn(compare_columns_group_screen2);

        // we load the diversity data later because its much heavier computationally
        await Promise.all([stats1, stats2, chem_table, condition_table])

        fetch(site_functions.API_URL+"/screens/diversity?screen_id=" + CURRENT_SELECTED_SCREEN.id, { signal }).then((response)=> {
            response.json().then((data)=> {
                $("#screen-diversity-num1").text(round(data));
            });
        })

        fetch(site_functions.API_URL+"/screens/diversity?screen_id=" + LAST_SELECTED_SCREEN.id, { signal }).then((response)=> {
            response.json().then((data)=> {
                $("#screen-diversity-num2").text(round(data));
            });
        })

        fetch(site_functions.API_URL+"/screens/compareDiversity?screen_id1=" + CURRENT_SELECTED_SCREEN.id + "&screen_id2=" +  LAST_SELECTED_SCREEN.id, { signal }).then((response)=> {
            response.json().then((data)=> {                
                $("#distance-between-screens").text(round(data));
            });
        })

    }
}

function update_subset_screen() {    
    Tabulator.findTable('#screen-subset-tabulator')[0].setData(site_functions.API_URL+"/screens/subsets?screen_id=" + CURRENT_SELECTED_SCREEN.id, "POST");
}

function update_similar_screens() {
    Tabulator.findTable('#screen-similar-tabulator')[0].setData(
        site_functions.API_URL + "/screens/similar?screen_id=" + CURRENT_SELECTED_SCREEN.id
    );
}


async function update_screen_report() {
    $("#screen-report #screen-diversity-num").text("loading");

    const screen_table = Tabulator.findTable('#screen-report-tabulator')[0];

    const stats = fetch(site_functions.API_URL+"/screens/stats?screen_id=" + CURRENT_SELECTED_SCREEN.id, { signal }).then((response)=> {
        return response.json();
    }).then((data)=> {
        $("#screen-report #condition-num").text(data.num_conditions);
        $("#screen-report #chemical-num").text(data.unique_chemicals);
        $("#screen-report #avg-conditions-num").text(round(data.avg_factors_per_condition));
    });

    const report = screen_table.setData(site_functions.API_URL+"/screens/screenReport?screen_id=" + CURRENT_SELECTED_SCREEN.id, "POST");

    // we wait to load diveristy because its more expensive
    Promise.all([stats, report])

    fetch(site_functions.API_URL+"/screens/diversity?screen_id=" + CURRENT_SELECTED_SCREEN.id, { signal }).then((response)=> {
        return response.json();
    }).then((data)=> {
        $("#screen-report #screen-diversity-num").text(round(data));
    });
}

function report_pdf_value(value){
    if (value == null){
        return "";
    }
    if (typeof value === "number"){
        return Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, "") : "";
    }
    if (typeof value === "object"){
        return value.name || "";
    }
    return String(value);
}

function make_screen_report_pdf(){
    if (CURRENT_SELECTED_SCREEN == null){
        site_functions.alert_user("No screen selected.");
        return;
    }

    const report_table = Tabulator.findTable('#screen-report-tabulator')[0];
    const rows = report_table.getData("active");
    const columns = report_table.getColumns()
        .filter(column => column.isVisible())
        .map(column => ({title: column.getDefinition().title, field: column.getField()}));
    const report_window = window.open("", "_blank");
    if (!report_window){
        site_functions.alert_user("Please allow popups to open the PDF report.");
        return;
    }

    const header = columns.map(column => `<th>${xml_escape(column.title)}</th>`).join("");
    const body = rows.map(row => `<tr>${columns.map(column =>
        `<td>${xml_escape(report_pdf_value(column.field.split(".").reduce((value, key) => value == null ? null : value[key], row)))}</td>`
    ).join("")}</tr>`).join("");
    report_window.document.write(`<!doctype html>
<html>
<head>
<title>${xml_escape(CURRENT_SELECTED_SCREEN.name)} - Screen Report</title>
<style>
  body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
  h1 { margin-bottom: 4px; }
  h2 { margin-top: 0; font-size: 16px; font-weight: normal; }
  table { border-collapse: collapse; width: 100%; margin-top: 20px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eee; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<button onclick="window.print()">Print / Save as PDF</button>
<h1>${xml_escape(CURRENT_SELECTED_SCREEN.name)}</h1>
<h2>Owner: ${xml_escape(CURRENT_SELECTED_SCREEN.owned_by || "")}</h2>
<p>Screen Report</p>
<ul>
  <li>${xml_escape($("#condition-num").text())} conditions</li>
  <li>${xml_escape($("#chemical-num").text())} unique chemicals</li>
  <li>${xml_escape($("#avg-conditions-num").text())} avg factors per condition</li>
  <li>${xml_escape($("#screen-diversity-num").text())} screen diversity</li>
</ul>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`);
    report_window.document.close();
    report_window.focus();
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
    index: "screen_id",
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
var subset_table = new Tabulator("#screen-subset-tabulator", {
    ajaxContentType: 'json',
    ajaxRequestFunc: function (url, config, params) {
        return fetch(url, { signal })
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log("subset request was cancelled");
                return [];
            }
            console.error("subset fetch failed", error);
            throw error;
        });
    },
    height: "100%",
    layout: "fitData",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Screens",
    placeholder:"No Screens",
    initialFilter:[],
    selectableRows: false,
    index: "screen_id",
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
        {
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
                    view_screen(cell, view_wells = true);
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

var similar_table = new Tabulator("#screen-similar-tabulator", {
    ajaxContentType: 'json',
    ajaxRequestFunc: function(url) {
        return fetch(url, {signal}).then(response => {
            if (!response.ok) {
                throw new Error("Unable to load similar screens (HTTP " + response.status + ").");
            }
            return response.json();
        });
    },
    height: "100%",
    layout: "fitData",
    movableColumns: true,
    rowHeight: 48,
    editorEmptyValue: null,
    placeholderHeaderFilter: "No Matching Screens",
    placeholder: "No similar screens",
    selectableRows: false,
    index: "screen_id",
    validationMode: 'manual',
    columns: [
        {
            title: "Available",
            field: "screen.available",
            hozAlign: "center",
            vertAlign: "middle",
            width: 105,
            headerMenu: column_menu,
            headerFilter: "tickCross",
            headerFilterEmptyCheck: function(value){return !value;},
            formatter: "tickCross",
            mutator: function(value, data){return value ? 1 : 0;}
        }, {
            title: "Name",
            field: "screen.name",
            vertAlign: "middle",
            width: 400,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Similarity",
            field: "similarity_score",
            width: 120,
            hozAlign: "right",
            vertAlign: "middle",
            sorter: "number",
            formatter: cell => (cell.getValue() * 100).toFixed(1) + "%"
        }, {
            title: "Owner",
            field: "screen.owned_by",
            vertAlign: "middle",
            width: 175,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Creation Date",
            field: "screen.creation_date",
            vertAlign: "middle",
            width: 175,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Comments",
            field: "screen.comments",
            vertAlign: "middle",
            width: 485,
            headerMenu: column_menu,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Format",
            headerHozAlign: "center",
            columns: [{
                title: "Name",
                field: "screen.format_name",
                vertAlign: "middle",
                width: 115,
                headerMenu: column_menu,
                headerFilter: "input",
                headerFilterPlaceholder: "Filter"
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
            }]
        }, {
            title: "Frequently Made Block",
            headerHozAlign: "center",
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
            }]
        }, {
            title: "",
            field: "actions",
            width: 90,
            frozen: true,
            formatter: function() {
                return $('<button>').attr('class', 'view-button table-cell-button').text('View').prop('outerHTML');
            },
            cellClick: function(event, cell) {
                if ($(event.target).hasClass('view-button')) {
                    view_screen(cell, true);
                }
            },
            headerSort: false,
            hozAlign: "center",
            vertAlign: "middle",
            resizable: true
        }
    ],
    initialSort: [{column: "similarity_score", dir: "desc"}]
});


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
    placeholderHeaderFilter: "No Matching Chemicals",
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
                    return cell.getValue().name + (cell.getValue().aliases.length ? ' (aliases: ' + cell.getValue().aliases.length + ')' : "");
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.name.localeCompare(b.name);
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
});

// Making these column groups outside the tabulator initalization means we can remove them later to change the title
compare_columns_group_screen1 = {
        title:"Screen 1",
        headerHozAlign : "center", 
        columns: [{
            title: "Appearances", 
            field: "screen_info1.appearances", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min Concentration", 
            field: "screen_info1.conc_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Max concentration", 
            field: "screen_info1.conc_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min pH", 
            field: "screen_info1.ph_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Max pH", 
            field: "screen_info1.ph_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }]
        }

compare_columns_group_screen2 = {
        title:"Screen 2",
        headerHozAlign : "center", 
        columns: [{
            title: "Appearances", 
            field: "screen_info2.appearances", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min Concentration", 
            field: "screen_info2.conc_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Max concentration", 
            field: "screen_info2.conc_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Min pH", 
            field: "screen_info2.ph_min", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }, {
            title: "Max pH", 
            field: "screen_info2.ph_max", 
            hozAlign: "right", 
            vertAlign: "middle",
            width: 120,
            headerMenu: column_menu,
            sorter: "number",
            headerFilter: "number",
            headerFilterPlaceholder: "Filter"
        }]
        }

var chemical_compare_table = new Tabulator("#chemical-compare-tabulator",  {
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
                    return cell.getValue().name + (cell.getValue().aliases.length ? ' (aliases: ' + cell.getValue().aliases.length + ')' : "");
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.name.localeCompare(b.name);
            }

        // Concentration
        }, 
        compare_columns_group_screen1,
        compare_columns_group_screen2
          
],
    initialSort: [
        {column: "chemical", dir: "asc"}
    ],
});

// Tabulator table
var condition_compare_table = new Tabulator("#condition-compare-tabulator", {
    data: [],
    ajaxContentType: 'json',
    ajaxRequestFunc: function (url, config, params) {
        return fetch(url, { signal }).then((response)=> {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        }).then((data)=> {
            let condition_2wells = [];
            for (condition_compare of data) {
                for (factor of condition_compare.well1.wellcondition.factors) {
                    condition_2wells.push({
                        "factor" : factor, 
                        "wells" : condition_compare.well1.label + " " + condition_compare.well2.label
                    });
                }
            }
            $("#shared-conditions").text(data.length);
            console.log(condition_2wells)

            return condition_2wells
        }).catch(error => {
            if (error.name === 'AbortError') {
                console.log("Condition request was cancelled");
                return [];
            }
            console.error("Condition fetch failed", error);
            throw error;
        });
    },
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
            title: "Wells", 
            field: "wells", 
            vertAlign: "middle",
            width: 85,
            headerSort: false,
            headerMenu: column_menu,
            // we split the codes from A12 into "A" and "12", only if the letters are the same we check the numbers
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                if (b[0] == a[0]) {
                    return b.charCodeAt(0) - a.charCodeAt(0);
                } else {
                    return Number(b.substring(1)) - Number(a.substring(1));
                }
            },
            headerFilter: "input",
            headerFilterPlaceholder: "Filter",
            visible: false
            ,
            formatter: function(cell){
                let wells = String(cell.getValue() || "").split(" ");
                return `<span class="comparison-well-blue">${wells[0] || ""}</span> <span class="comparison-well-red">${wells[1] || ""}</span>`;
            }
        
        // Meets query
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
        {column: "wells", dir: "asc"},
        {column: "factor.chemical", dir: "asc"}
    ],
    groupBy: ["wells"]
    ,
    groupStartOpen:function(value, count, data, group){
        if (data.length >= 1 && data[0].query_match === false){
            return false;
        } else {
            return true;
        }
    },
    groupHeader:function(value, count, data, group){
        let wells = String(value || "").split(" ");
        let label = $('<div>').css('display', 'inline-block');
        label.append($('<span>').addClass('comparison-well-blue').css('color', '#2563eb').text(wells[0] || ""));
        label.append(document.createTextNode(" "));
        label.append($('<span>').addClass('comparison-well-red').css('color', '#dc2626').text(wells[1] || ""));
        return label.prop('outerHTML');
    }
});

document.getElementById("shared-conditions-button").addEventListener("click", (e)=> {
    document.getElementById("condition-compare-tabulator").style.display = "";
    document.getElementById("chemical-compare-tabulator").style.display = "none";
    $("#shared-conditions-button").prop("disabled", "disabled");
    $("#shared-chemicals-button").prop("disabled", "");
});

document.getElementById("shared-chemicals-button").addEventListener("click", (e)=> {
    document.getElementById("chemical-compare-tabulator").style.display = "";
    document.getElementById("condition-compare-tabulator").style.display = "none";
    $("#shared-conditions-button").prop("disabled", "");
    $("#shared-chemicals-button").prop("disabled", "disabled");
});

$("#shared-conditions-button").prop("disabled", "disabled");


condition_compare_table.on("groupClick", function (e, group){
    target = $(e.target);
        if (target.hasClass('select-button')) {
            select_condition(group, target);
        } else if (target.hasClass('delete-button')) {
            remove_condition(group, target);
        } else if (target.hasClass('recipe-button')) {
            condition_recipe(group);
        }
});

// disable all menu buttons and hide all displayed divs
function reset_info() {
    $('#view-wells-button').prop("disabled", "");
    $('#compare-screens-button').prop("disabled", "");
    $('#screen-subsets-button').prop("disabled", "");
    $('#similar-screens-button').prop("disabled", "");
    $('#screen-recipe-button').prop("disabled", "");
    $('#screen-make-recipe-button').prop("disabled", "");
    $('#screen-report-button').prop("disabled", "");

    $('#screen-wells').hide();
    $('#screen-report').hide();
    $('#compare-screens').hide();
    $('#subset-screens').hide();
    $('#similar-screens').hide();
}

$('#view-wells-button').click(function() {
    reset_info();
    $('#view-wells-button').prop("disabled", "disabled");
    $('#screen-wells').show();
    load_data_from_button_pressed()
});

$('#compare-screens-button').click(function() {
    reset_info();
    $('#compare-screens-button').prop("disabled", "disabled");
    $('#compare-screens').show();
    load_data_from_button_pressed()
});

$('#screen-subsets-button').click(function() {
    reset_info();
    $('#screen-subsets-button').prop("disabled", "disabled");
    $('#subset-screens').show();
    load_data_from_button_pressed()
});

$('#similar-screens-button').click(function() {
    reset_info();
    $('#similar-screens-button').prop("disabled", "disabled");
    $('#similar-screens').show();
    load_data_from_button_pressed();
});

$('#screen-recipe-button').click(function() {
    if (CURRENT_SELECTED_SCREEN == null) {
        site_functions.alert_user("No screen selected.");
        return;
    }
    open_screen_recipe_report(CURRENT_SELECTED_SCREEN);
});

$('#screen-make-recipe-button').click(function() {
    if (CURRENT_SELECTED_SCREEN == null) {
        site_functions.alert_user("No screen selected.");
        return;
    }
    choose_recipe_csv_format(CURRENT_SELECTED_SCREEN);
});

$('#screen-report-button').click(function() {
    reset_info();
    $('#screen-report-button').prop("disabled", "disabled");
    $('#screen-report').show();
    load_data_from_button_pressed()
});

$('#screen-report-pdf-button').click(function() {
    make_screen_report_pdf();
});

$('#hide-screen-view-button').click(function() {
    hide_screen();
});

$('#delete-screen-button').click(function() {
    if (CURRENT_SELECTED_SCREEN == null) {
        site_functions.alert_user("No screen selected.");
        return;
    }
    site_functions.authorise_action(null, function(token) {
        site_functions.confirm_action(
            `Delete screen "${CURRENT_SELECTED_SCREEN.name}"? This cannot be undone.`,
            function() {
                $.ajax({
                    type: "DELETE",
                    url: site_functions.API_URL + "/screens/" + CURRENT_SELECTED_SCREEN.id,
                    headers: {"Authorization": "Bearer " + token},
                    success: function() {
                        hide_screen();
                        $('#reload-all-screens-button').click();
                    },
                    error: function(xhr) {
                        let detail = xhr.responseJSON && xhr.responseJSON.detail;
                        site_functions.alert_user(detail || "Unable to delete the screen.");
                    }
                });
            }
        );
    });
});

// Propagate message passing after tables have loaded
Promise.all([
    new Promise(function(resolve, reject){
        screen_table.on('tableBuilt', resolve);
    }), 
    new Promise(function(resolve, reject){
        well_table.on('tableBuilt', resolve);
    }),
    new Promise(function(resolve, reject){
        chemical_compare_table.on('tableBuilt', resolve);
    })
]).then(function(){
    site_functions.propagate_message_passing();
    });
});

// Return public functions object for globally avilable functions
return public_functions;
})();