//# sourceURL=screen_query.js
var screen_query = (function() {

// Counter for identifying condition and chemical divs in recursive query
let CONDITION_ID_COUNTER = 0;
let CHEMICAL_ID_COUNTER = 0;

// Query object passed to API
let SCREEN_QUERY = {
    'name_search': null,
    'owner_search': null,
    'conds': null
};

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// ========================================================================== //
// Query div navigation helpers
// ========================================================================== //

// Get the condition element id from jquery object
function get_condition_div_id(cond_div){
    return parseInt(cond_div.attr('id').slice(13));
}

// Get the chemical element id from jquery object
function get_chemical_div_id(chem_div){
    return parseInt(chem_div.attr('id').slice(12));
}

// Get the parent condition element id from chemical jquery object
function get_condition_div_id_from_chemical_div(chem_div){
    let cond_div = chem_div.closest('.condition-div');
    return get_condition_div_id(cond_div);
}

// Get the parent condition jquery object from a chemical jquery object
function get_condition_div_from_chemical_div(chem_div){
    return chem_div.closest('.condition-div');
}

// Get the first child chemical jquery object from a condition jquery object
function get_first_chemical_div_from_condition_div(cond_div){
    return cond_div.find('.chemical-div').first();
}

// ========================================================================== //
// Query divs
// ========================================================================== //

// Create a logic div for conditions and chemicals
function create_logic_div() {
    let ldiv = $('<div>').attr('class', 'logic-div');
    return ldiv
}

// Create a div for specifiying a condition
function append_condition_div(parent_div) {
    // Create radio check for ALL or SOME quantifier
    let condition_div = $('<div>').attr('class', 'condition-div').attr('id', 'condition-div'+CONDITION_ID_COUNTER).append(
        $('<div>').attr('class', 'section-title').text('CONDITION')
    ).append(
        // Create dropdown for reference or chemical condition specification
        $('<select>').attr('id', 'condition-ref'+CONDITION_ID_COUNTER).attr('name', 'condition-ref'+CONDITION_ID_COUNTER).append(
            $('<option>').attr('value', 'chem').
            attr('selected', 'selected').
            text('Identified by chemical')
        ).append(
            $('<option>').attr('value', 'ref').
            text('Identified by reference')
        // Create field for specifing condition on change
        ).change(function() {
            cond = $(this).parent();
            cond_id = get_condition_div_id(cond);
            cond.children().last().remove();
            if ($(this).val() == 'chem'){
                //cond.append(create_condition_chem_field(cond_id));
                append_condition_chem_field(cond);
                query_by_chemical_condition(cond, get_first_chemical_div_from_condition_div(cond));
            } else if ($(this).val() == 'ref'){
                append_condition_ref_field(cond);
                query_by_reference_condition(cond);
            }
        })
    ).append($('</br>')).append(
        $('<input>').attr('type', 'radio')
        .attr('name', 'condition-quant'+CONDITION_ID_COUNTER)
        .attr('id', 'condition-quant-e'+CONDITION_ID_COUNTER)
        .attr('value', 'e')
        .attr('checked', 'checked')
        .change(function() {
            query_update_inputs(false);
        })
    ).append(
        $('<label>').attr('for', 'condition-quant-e'+CONDITION_ID_COUNTER).text('Some')
    ).append(
        $('<input>').attr('type', 'radio')
        .attr('name', 'condition-quant'+CONDITION_ID_COUNTER)
        .attr('id', 'condition-quant-a'+CONDITION_ID_COUNTER)
        .attr('value', 'a')
        .change(function() {
            query_update_inputs(false);
        })
    ).
    append(
        $('<label>').attr('for', 'condition-quant-a'+CONDITION_ID_COUNTER)
        .text('All')
    ).append(' conditions in the screen').append($('</br>'))
    // Make condition selectable
    .click(function () {
        // Remove selection from all other conditions and chemicals
        $('.condition-div').removeClass('selected-query-div');
        $('.chemical-div').removeClass('selected-query-div');
        $(this).addClass('selected-query-div');
    });
    // Init condition div before adding field. Needs to be done first for tabulator tables
    parent_div.append(condition_div);
    // Init condition as being specified by chemical
    append_condition_chem_field(condition_div);

    CONDITION_ID_COUNTER += 1;
    return condition_div;
}

// Create field where condition is specified with chemical information
function append_condition_chem_field(cond_div){
    // Get condition div id
    let condition_id = get_condition_div_id(cond_div);
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id)
    .attr('class', 'condition-chem-field').append(
        $('<legend>').text('meet the following')
    );
    // Append field to condition div
    cond_div.append(condition_field);
    // Initialise with a chemical
    let logic_div = create_logic_div();
    condition_field.append(
        $('<div>').attr('id', 'chemical-query'+condition_id).append(logic_div)
    );
    append_chemical_div(logic_div);
}

// Create and append field where condition is specified with reference information
function append_condition_ref_field(cond_div){
    // Get div id
    let condition_id = get_condition_div_id(cond_div);
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id).append(
        $('<legend>').text('equal the one in')
    ).append($('<div>').attr('id', 'condition-ref-tabulator-'+condition_id));

    // Instantiate the field and div that will hold tabulator table
    cond_div.append(condition_field);

    // Make screen reference selector a tabulator table with a single entry
    var table = new Tabulator('#condition-ref-tabulator-'+condition_id, {
        data: [{id: 1, screen: {id: null, name: null}, well: {id: null, label: null}}],
        height: "100%",
        layout: "fitData",
        editorEmptyValue: null,
        selectableRows: false,
        index: "id",
        validationMode: 'manual',
        columns: [{
            title: "Screen", 
            field: "screen", 
            vertAlign: "middle",
            width: 160,
            headerSort: false,
            editor: "list", 
            editorParams: {
                valuesLookup: function(cell){
                    // Load users list from api
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: API_URL+'/screens/names',
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
            // Update the wells list when screen selected
            cellEdited: function(cell){
                cell.getRow().update({well: {id: null, label: null}});
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
            title: "Well", 
            field: "well", 
            vertAlign: "middle",
            width: 100,
            resizable: false,
            headerSort: false,
            editor: "list", 
            editorParams: {
                valuesLookup: function(cell){
                    var screen_id = cell.getData().screen.id;
                    if (screen_id){
                        return new Promise(function(resolve, reject){
                            $.ajax({
                                url: API_URL+'/screens/wellNames?screen_id='+screen_id,
                                success: function(data){
                                    var options = [];
                                    $.each(data, function(i,w){
                                        // Value of cell is the well object (not just the name)
                                        options.push({
                                            label: w.label,
                                            value: w,
                                        });
                                    })
                                    resolve(options);
                                },
                                error: function(error){
                                    reject(error);
                                },
                            });
                        });
                    } else {
                        return [];
                    }
                },
                sort: "asc",
                emptyValue: {id: null, name: null},
                placeholderLoading: "Loading Well List...",
                placeholderEmpty: "No Wells Found",
            },
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getData().screen.id == null){
                    return "";
                } else if (cell.getValue().id){
                    $(cell.getElement()).css('color', '#333');
                    return cell.getValue().label;
                } else {
                    $(cell.getElement()).css('color', '#999');
                    return "Select well ...";
                }
            },
            editable: function (cell) {
                var is_editable = cell.getRow().getData().screen.id != null;
                return is_editable;
            },
            cellEdited: function(cell){
                query_update_inputs(false);
            }
        }]
    });
    // Return field even if it is already appended
    return condition_field;
}

// Create div for specifiying a chemical
function append_chemical_div(parent_div){
    // Chemical id from drop down
    let chemical_div = $('<div>').attr('class', 'chemical-div')
    .attr('id', 'chemical-div'+CHEMICAL_ID_COUNTER).append(
        $('<div>').attr('class', 'section-title').text('CHEMICAL')
    ).append(
        $('<input>').attr('type', 'radio')
        .attr('name', 'chemical-quant'+CHEMICAL_ID_COUNTER)
        .attr('id', 'chemical-quant-e'+CHEMICAL_ID_COUNTER)
        .attr('value', 'e')
        .attr('checked', 'checked')
        .change(function(){
            query_update_inputs(false);
        })
    ).append(
        $('<label>').attr('for', 'chemical-quant-e'+CHEMICAL_ID_COUNTER).text('Some')
    ).append(
        $('<input>').attr('type', 'radio')
        .attr('name', 'chemical-quant'+CHEMICAL_ID_COUNTER)
        .attr('id', 'chemical-quant-a'+CHEMICAL_ID_COUNTER)
        .attr('value', 'a')
        .change(function(){
            query_update_inputs(false);
        })
    ).append(
        $('<label>').attr('for', 'chemical-quant-a'+CHEMICAL_ID_COUNTER).text('All')
    ).append(' chemicals in the condition are').append(
        $('<div>').attr('id', 'chemical-search-tabulator-'+CHEMICAL_ID_COUNTER).attr('class', 'chemical-search-tabulator')
    );
    
    // Append chemical div before tabulator table created
    parent_div.append(chemical_div);

    // Make chemical selector a tabulator table with a single entries
    var table = new Tabulator('#chemical-search-tabulator-'+CHEMICAL_ID_COUNTER, {
        data: [{id: 1, chemical: {id: null, name: null, aliases: [], unit: null}, concentration: null, unit: ALL_UNITS[0], ph: null}],
        height: "100%",
        layout: "fitData",
        editorEmptyValue: null,
        selectableRows: false,
        index: "id",
        validationMode: 'manual',
        columns: [{
            title: "Chemical", 
            field: "chemical", 
            vertAlign: "middle",
            width: 160,
            headerSort: false,
            editor: "list", 
            editorParams: {
                // Load chemical list from api, formatting to show numbers of aliases
                valuesLookup:function(cell){
                    return new Promise(function(resolve, reject){
                        $.ajax({
                            url: API_URL+'/chemicals/names',
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
                    var unit_ind = $.inArray(chemical.unit, ALL_UNITS);
                    var row = cell.getRow();
                    var unit_cell = row.getCell('unit');
                    var conc_cell = row.getCell('concentration');
                    // New units found
                    if (unit_ind != -1){
                        unit_cell.setValue(ALL_UNITS[unit_ind]);
                    // New units not found
                    } else {
                        unit_cell.setValue(ALL_UNITS[0]);
                    }
                    // Reset concentration
                    conc_cell.setValue(null);
                    // Update query
                    query_update_inputs(false);
            },
            // Display only name and alias count from the chemical object in the cell
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getValue().id){
                    $(cell.getElement()).css('color', '#333');
                    return cell.getValue().name + (cell.getValue().aliases.length ? ' (aliases: ' + cell.getValue().aliases.length + ')' : "");
                } else {
                    $(cell.getElement()).css('color', '#999');
                    return "Search chemicals ...";
                }
            },
            // Sorter should sort by chemical name
            sorter: function(a, b, aRow, bRow, column, dir, sorterParams){
                return a.name.localeCompare(b.name);
            }

        // Concentration
        }, , {
            title: "Concentration", 
            field: "concentration", 
            hozAlign: "right", 
            vertAlign: "middle",
            resizable: false,
            width: 110,
            headerSort: false,
            editor: "number",
            cellEdited: function(cell){
                query_update_inputs(false);
            }

        // Unit
        }, {
            title: "Unit", 
            field: "unit", 
            vertAlign: "middle",
            resizable: false,
            width: 80,
            headerSort: false,
            editor: "list",
            editorParams: {values: ALL_UNITS},
            cellEdited: function(cell){
                query_update_inputs(false);
            }

        // pH
        }, {
            title: "pH", 
            field: "ph", 
            hozAlign: "right", 
            vertAlign: "middle",
            resizable: false,
            width: 80,
            headerSort: false,
            editor: "number",
            cellEdited: function(cell){
                query_update_inputs(false);
            }
        }]
    });

    chemical_div.click(function (e) {
        e.stopPropagation();
        $('.condition-div').removeClass('selected-query-div');
        $('.chemical-div').removeClass('selected-query-div');
        $(this).addClass('selected-query-div');
    });

    CHEMICAL_ID_COUNTER += 1;
    // returnchemical div even if it is already appended
    return chemical_div;
}

// ========================================================================== //
// Query div logic operations
// ========================================================================== //

// Function to get jquery object of currently selected condition or chemical
function get_selection(){
    selected_div = $('.selected-query-div');
    if (selected_div.length == 0){
        console.log('No condition or chemical selected.')
    } else if (selected_div.length > 1){
        throw new Error('Error! Multiple conditions or chemicals marked as selected.');
    }
    return selected_div;
}

// Handling of AND and OR operators
function binop_query(binop){
    selected_div = get_selection();
    if (selected_div.hasClass('condition-div')){
        binop_condition(binop, selected_div);
    } else if (selected_div.hasClass('chemical-div')){
        binop_chemical(binop, selected_div);
    }
}

// Handling of NOT operator
function not_query(){
    selected_div = get_selection();
    if (selected_div.hasClass('condition-div')){
        not_condition(selected_div);
    } else if (selected_div.hasClass('chemical-div')){
        not_chemical(selected_div);
    }
}

// Handling of remove operator
function remove_query(){
    selected_div = get_selection();
    if (selected_div.hasClass('condition-div')){
        remove_condition(selected_div);
    } else if (selected_div.hasClass('chemical-div')){
        remove_chemical(selected_div);
    }
}

// Handling of AND and OR operators for condition
function binop_condition(binop, cond_div){
    if (cond_div == null){
        return;
    }
    // Get the parent logic div and the top level logic div
    let cond_logic = cond_div.parent();
    let logic_parent = cond_logic.parent();
    // Flag if left or right condition is selected to make new layout consistent
    if (logic_parent.children().last().is(cond_logic)){
        insert_right = true;
    } else {
        insert_right = false;
    }
    // Create new logiv div with selected and new conditions
    let op_logic = create_logic_div();
    let new_cond_logic = create_logic_div();
    let binop_str = null;
    let binop_cls = null;
    if (binop == 'and'){
        binop_str = 'AND';
        binop_cls = 'and-title';
    } else {
        binop_str = 'OR';
        binop_cls = 'or-title';
    }
    op_logic.append(
        $('<div>').attr('class', 'section-title ' + binop_cls).text(binop_str)
    ).append(
        // Appending selected condition logic will move it from current position
        cond_logic
    ).append(
        new_cond_logic
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    let new_cond_div = append_condition_div(new_cond_logic);
    let new_chem_div = get_first_chemical_div_from_condition_div(new_cond_div);
    // Update query tree object
    query_binop_condition(cond_div, new_cond_div, new_chem_div, binop);
}

// Handling of NOT operator for condition
function not_condition(cond_div){
    if (cond_div == null){
        return;
    }
    // Get logic container and check if it has 1 or 2 children
    let cond_logic = cond_div.parent();
    // One child means to add negation
    if (cond_logic.children().length == 1){
        cond_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').text('NOT')
        );
        // Update query tree object
        query_set_not_condition(cond_div, true);
    // Two means to remove negation
    } else if (cond_logic.children().length == 2){
        cond_logic.children().first().remove();
        // Update query tree object
        query_set_not_condition(cond_div, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple conditions in lowest level logic div.')
    }
}

// Handling of remove operator for condition
function remove_condition(cond_div){
    if (cond_div == null){
        return;
    }
    // Get operator logic div
    let cond_logic = cond_div.parent();
    let op_logic = cond_logic.parent();
    // Don't allow removal of last condition
    if (op_logic.is($('#condition-query-div'))){
        console.log('Cannot remove last condition.')
        return;
    }
    // Get sibling condition logic div (must be one sibling)
    if (op_logic.children().last().is(cond_logic)){
        keep_cond_logic = cond_logic.prev();
    } else {
        keep_cond_logic = op_logic.children().last();
    }
    // Replace whole operator logic div with one the siubling one
    op_logic.replaceWith(keep_cond_logic);
    // Update query tree object
    query_remove_condition(cond_div);
}

// Handling of AND and OR operators for chemical
function binop_chemical(binop, chem_div){
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);

    // Get the parent logic div and the top level logic div
    let chem_logic = chem_div.parent();
    let logic_parent = chem_logic.parent();
    // Flag if left or right chemical is selected to make new layout consistent
    if (logic_parent.children().last().is(chem_logic)){
        insert_right = true;
    } else {
        insert_right = false;
    }
    // Create new logiv div with selected and new chemicals
    let op_logic = create_logic_div();
    let new_chem_logic = create_logic_div();
    let binop_str = null;
    let binop_cls = null;
    if (binop == 'and'){
        binop_str = 'AND';
        binop_cls = 'and-title';
    } else {
        binop_str = 'OR';
        binop_cls = 'or-title';
    }
    op_logic.append(
        $('<div>').attr('class', 'section-title ' + binop_cls).text(binop_str)
    ).append(
        // Appending selected chemical logic will move it from current position
        chem_logic
    ).append(
        new_chem_logic
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
    // Add chemical div with tabulator table after other divs are instatiated
    let new_chem_div = append_chemical_div(new_chem_logic);
    // Update query tree object
    query_binop_chemical(cond_div, chem_div, new_chem_div, binop);
}

// Handling of NOT operator for chemical
function not_chemical(chem_div){
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);

    // Get logic container and check if it has 1 or 2 children
    let chem_logic = chem_div.parent();
    // One child means to add negation
    if (chem_logic.children().length == 1){
        chem_logic.prepend(
            $('<div>').attr('class', 'section-title not-title').text('NOT')
        );
        // Update query tree object
        query_set_not_chemical(cond_div, chem_div, true);
    // Two means to remove negation
    } else if (chem_logic.children().length == 2){
        chem_logic.children().first().remove();
        // Update query tree object
        query_set_not_chemical(cond_div, chem_div, false);
    // More is an error
    } else {
        throw new Error('Error! Multiple chemicals in lowest level logic div.')
    }
}

// Handling of remove operator for chemical
function remove_chemical(chem_div){
    if (chem_div == null){
        return;
    }
    let cond_div = get_condition_div_from_chemical_div(chem_div);
    let cond_id = get_condition_div_id_from_chemical_div(chem_div);

    // Get operator logic div
    let chem_logic = chem_div.parent();
    let op_logic = chem_logic.parent();
    // Don't allow removal of last chemical
    if (op_logic.is($('#chemical-query'+cond_id))){
        console.log('Cannot remove last chemical.')
        return;
    }
    // Get sibling chemical logic div (must be one sibling)
    if (op_logic.children().last().is(chem_logic)){
        keep_chem_logic = chem_logic.prev();
    } else {
        keep_chem_logic = op_logic.children().last();
    }
    // Replace whole operator logic div with the sibling one
    op_logic.replaceWith(keep_chem_logic);
    // Update query tree object
    query_remove_chemical(cond_div, chem_div);
}

//============================================================================//
// Query tree functions
//============================================================================//

// Create query tree
function query_init(cond_div, chem_div){
    SCREEN_QUERY.conds = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'id': null,
            'chems': {
                'negate': false,
                'arg': {
                    'universal_quantification': false,
                    'name_search': null,
                    'id': null,
                    'conc': null,
                    'units': null,
                    'ph': null,
                    // Additional details stored for easy parsing until query
                    'q_chemical_div': chem_div
                }
            },
            // Additional details stored for easy parsing until query
            'q_condition_div': cond_div
        }
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Destroy query tree
function query_empty(){
    SCREEN_QUERY.conds = null;
    console.log('Q: ', SCREEN_QUERY);
}

// Add condition to query tree
function query_binop_condition(cond_div, new_cond_div, new_chem_div, binop){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for operation.');
    }
    let right = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'id': null,
            'chems': {
                'negate': false,
                'arg': {
                    'universal_quantification': false,
                    'name_search': null,
                    'id': null,
                    'conc': null,
                    'units': null,
                    'ph': null,
                    // Additional details stored for easy parsing until query
                    'q_chemical_div': new_chem_div
                }
            },
            // Additional details stored for easy parsing until query
            'q_condition_div': new_cond_div
        }
    };
    let left = {
        'negate': cond_clause.negate,
        'arg': cond_clause.arg
    };
    cond_clause.negate = false;
    cond_clause.arg = {
        'op': binop,
        'arg_left': left,
        'arg_right': right
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Negate condition in query tree
function query_set_not_condition(cond_div, not){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for negation.');
    }
    cond_clause.negate = not;
    console.log('Q: ', SCREEN_QUERY);
}

// Remove condition from query tree
function query_remove_condition(cond_div){
    let cond_parent_clause = query_get_cond_parent_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_parent_clause == null){
        throw new Error('Error! Could not find condition in query tree for removal.');
    }
    // Either remove left argument
    if (!cond_parent_clause.arg.arg_left.arg.op && cond_parent_clause.arg.arg_left.arg.q_condition_div.is(cond_div)){
        cond_parent_clause.negate = cond_parent_clause.arg.arg_right.negate;
        cond_parent_clause.arg = cond_parent_clause.arg.arg_right.arg;
    // Or right argument
    } else if (!cond_parent_clause.arg.arg_right.arg.op && cond_parent_clause.arg.arg_right.arg.q_condition_div.is(cond_div)){
        cond_parent_clause.negate = cond_parent_clause.arg.arg_left.negate;
        cond_parent_clause.arg = cond_parent_clause.arg.arg_left.arg;
    }
    console.log('Q: ', SCREEN_QUERY);
}

// Specify condition by reference
function query_by_reference_condition(cond_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for adding reference.');
    }
    cond_clause.arg.chems = null;
    console.log('Q: ', SCREEN_QUERY);
}

// Specify condition by chemicals
function query_by_chemical_condition(cond_div, chem_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for adding chemical.');
    }
    cond_clause.arg.chems = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'name_search': null,
            'id': null,
            'conc': null,
            'units': null,
            'ph': null,
            // Additional details stored for easy parsing until query
            'q_chemical_div': chem_div
        }
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Get the clause of the condition in the query tree
function query_get_cond_clause(cond_div, tree){
    if (!tree.arg.op){
        if (tree.arg.q_condition_div.is(cond_div)){
            return tree;
        } else {
            return null;
        }
    } else {
        let left = query_get_cond_clause(cond_div, tree.arg.arg_left);
        if (left != null){
            return left;
        } else {
            return query_get_cond_clause(cond_div, tree.arg.arg_right);
        }
    }
}

// Get the clause with the binary operator above the specified condition
function query_get_cond_parent_clause(cond_div, tree){
    if (tree.arg.op){
        if (!tree.arg.arg_left.arg.op && tree.arg.arg_left.arg.q_condition_div.is(cond_div)){
            return tree;
        } else if (!tree.arg.arg_right.arg.op && tree.arg.arg_right.arg.q_condition_div.is(cond_div)){
            return tree;
        } else {
            let left = query_get_cond_parent_clause(cond_div, tree.arg.arg_left);
            if (left != null){
                return left;
            } else {
                return query_get_cond_parent_clause(cond_div, tree.arg.arg_right);
            }
        }
    } else {
        return null;
    }
}

// Add chemical to query tree within condition
function query_binop_chemical(cond_div, chem_div, new_chem_div, binop){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_clause = query_get_chem_clause(chem_div, cond_clause.arg.chems);
    if (chem_clause == null){
        throw new Error('Error! Could not find chemical in query tree for operation.');
    }
    let right = {
        'negate': false,
        'arg': {
            'universal_quantification': false,
            'name_search': null,
            'id': null,
            'conc': null,
            'units': null,
            'ph': null,
            // Additional details stored for easy parsing until query
            'q_chemical_div': new_chem_div
        }
    };
    let left = {
        'negate': chem_clause.negate,
        'arg': chem_clause.arg
    }
    chem_clause.negate = false;
    chem_clause.arg = {
        'op': binop,
        'arg_left': left,
        'arg_right': right
    };
    console.log('Q: ', SCREEN_QUERY);
}

// Negate chemical in query tree within condition
function query_set_not_chemical(cond_div, chem_div, not){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_clause = query_get_chem_clause(chem_div, cond_clause.arg.chems);
    if (chem_clause == null){
        throw new Error('Error! Could not find chemical in query tree for operation.');
    }
    chem_clause.negate = not;
    console.log('Q: ', SCREEN_QUERY);
}

// Remove chemical from query tree within condition
function query_remove_chemical(cond_div, chem_div){
    let cond_clause = query_get_cond_clause(cond_div, SCREEN_QUERY.conds);
    if (cond_clause == null){
        throw new Error('Error! Could not find condition in query tree for chemical operation.');
    }
    let chem_parent_clause = query_get_chem_parent_clause(chem_div, cond_clause.arg.chems);
    if (chem_parent_clause == null){
        throw new Error('Error! Could not find chemical in query tree for removal.');
    }
    // Either remove left argument
    if (!chem_parent_clause.arg.arg_left.arg.op && chem_parent_clause.arg.arg_left.arg.q_chemical_div.is(chem_div)){
        chem_parent_clause.negate = chem_parent_clause.arg.arg_right.negate;
        chem_parent_clause.arg = chem_parent_clause.arg.arg_right.arg;
    // Or right argument
    } else if (!chem_parent_clause.arg.arg_right.arg.op && chem_parent_clause.arg.arg_right.arg.q_chemical_div.is(chem_div)){
        chem_parent_clause.negate = chem_parent_clause.arg.arg_left.negate;
        chem_parent_clause.arg = chem_parent_clause.arg.arg_left.arg;
    
    }
    console.log('Q: ', SCREEN_QUERY);
}

// Get the clause of the chemical in the query tree within a condition
function query_get_chem_clause(chem_div, tree){
    if (!tree.arg.op){
        if (tree.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else {
            return null;
        }
    } else {
        let left = query_get_chem_clause(chem_div, tree.arg.arg_left);
        if (left != null){
            return left;
        } else {
            return query_get_chem_clause(chem_div, tree.arg.arg_right);
        }
    }
}

// Get the clause with the binary operator above the specified chemical within a condition
function query_get_chem_parent_clause(chem_div, tree){
    if (tree.arg.op){
        if (!tree.arg.arg_left.arg.op && tree.arg.arg_left.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else if (!tree.arg.arg_right.arg.op && tree.arg.arg_right.arg.q_chemical_div.is(chem_div)){
            return tree;
        } else {
            let left = query_get_chem_parent_clause(chem_div, tree.arg.arg_left);
            if (left != null){
                return left;
            } else {
                return query_get_chem_parent_clause(chem_div, tree.arg.arg_right);
            }
        }
    } else {
        return null;
    }
}

// Update query from form elements
function query_update_inputs(alert_validation){
    // First parse screen name/owner inputs
    if ($('#screen-name-search').val() == ''){
        SCREEN_QUERY.name_search = null;
    } else {
        SCREEN_QUERY.name_search = $('#screen-name-search').val();
    }
    if ($('#screen-owner-search').val() == ''){
        SCREEN_QUERY.owner_search = null;
    } else {
        SCREEN_QUERY.owner_search = $('#screen-owner-search').val();
    }
    // Then recurse into conditions/chemicals
    if (SCREEN_QUERY.conds){
        let validation = query_update_conds(SCREEN_QUERY.conds, alert_validation);
        // If condition fails validation, propagate it
        if (!validation){
            return false;
        }
    }
    console.log('Q: ', SCREEN_QUERY);

    // Final validation matching API parser
    if (alert_validation &&
        SCREEN_QUERY.name_search == null &&
        SCREEN_QUERY.owner_search == null &&
        SCREEN_QUERY.conds == null){

        alert_user("Must query screens by at least a name, owner name or by condition.");
        return false;
    // When not validating always pass
    } else {
        return true;
    }
}

// Condition recursion for update
function query_update_conds(tree, alert_validation){
    // Parse recursively, ending if validation alert occurs
    let validated = false;
    if (tree.arg.op){
        validated = query_update_conds(tree.arg.arg_left);
        if (validated){
            validated = query_update_conds(tree.arg.arg_right);
        }
        return validated;
    // When in condition, read individual inputs
    } else {
        let cond_div = tree.arg.q_condition_div;
        let cond_id = get_condition_div_id(cond_div);
        if ($('input[name="condition-quant'+cond_id+'"]:checked').val() == 'a'){
            tree.arg.universal_quantification = true;
        } else {
            tree.arg.universal_quantification = false;
        }
        // Recurse into chemicals
        if (tree.arg.chems){
            tree.arg.id = null;
            validated = query_update_chems(tree.arg.chems, alert_validation);
            // If chemical validation fails, propagate fail
            if (!validated){
                return false;
            }
        } else {
            tree.arg.id = Tabulator.findTable('#condition-ref-tabulator-'+cond_id)[0].getRow(1).getData().well.wellcondition_id;
        }

        // Final validation matching API parser
        if (alert_validation &&
            tree.arg.id == null &&
            tree.arg.chems == null){
                
            alert_user("Must specify condition exclusively either by reference or by chemical.");
            return false;
        // When not validating always continue parsing
        } else {
            return true;
        }
    }
}

// Chemical recursion for update
function query_update_chems(tree, alert_validation){
    // Parse recursively, ending if validation alert occurs
    let validated = false;
    if (tree.arg.op){
        validated = query_update_chems(tree.arg.arg_left);
        if (validated){
            validated = query_update_chems(tree.arg.arg_right);
        }
        return validated;
    // When in chemical, read individual inputs
    } else {
        let chem_div = tree.arg.q_chemical_div;
        let chem_id = get_chemical_div_id(chem_div);
        let chem_data = Tabulator.findTable('#chemical-search-tabulator-'+chem_id)[0].getRow(1).getData();
        if ($('input[name="chemical-quant'+chem_id+'"]:checked').val() == 'a'){
            tree.arg.universal_quantification = true;
        } else {
            tree.arg.universal_quantification = false;
        }
        // No UI for chemical name search yet
        tree.arg.name_search = null;
        // Chemical id
        tree.arg.id = chem_data.chemical.id;
        // If concentration specified get both concentration and unit
        if (chem_data.concentration){
            tree.arg.conc = chem_data.concentration;
            tree.arg.units = chem_data.unit;
        // Otherwise neither
        } else {
            tree.arg.conc = null;
            tree.arg.units = null;
        }
        // pH
        tree.arg.ph = chem_data.ph;

        // Final validation matching API parser
        if (alert_validation){
            if (tree.arg.id == null &&
                tree.arg.name_search == null){

                alert_user("Must specify chemical.");
                return false;
            } else if (tree.arg.id == null &&
                tree.arg.name_search == null &&
                tree.arg.conc == null &&
                tree.arg.ph == null){

                alert_user("Must specify chemical with at least name, concentration and unit, or ph.");
                return false
            } else {
                return true;
            }
        // When not validating always continue parsing
        } else {
            return true;
        }
    }
}

// Make screen query
function query_screens(){
    // Update inputs with notifications for validation errors
    let validated = query_update_inputs(true);
    if (!validated){
        return;
    }
    
    // If validated, make new query object without helper keys and pass it the screens script public function
    let api_query_object = JSON.parse(JSON.stringify(SCREEN_QUERY, query_drop_extra));
    screen_explorer.screen_query(api_query_object);

    // Hide complex query popup
    $('#screen-query-cancel-button').click();
}

// Replacer function to drop query object keys not needed for API call
function query_drop_extra(key, value){
    if (key === 'q_condition_div'){
        return undefined;
    } else if (key === 'q_chemical_div'){
        return undefined;
    } else {
        return value;
    }
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. event handlers)
// ========================================================================== //

$(document).ready(function() {

// Show complex query popup
$('#query-screens-button').click(function(){
    $("#screen-query-popup").css("display", "block");
    $('#screen-popup-container').show();
    
});

// Cancel (hide) complex query popup
$('#screen-query-cancel-button').click(function(){
    $("#screen-query-popup").css("display", "none");
    $('#screen-popup-container').hide();
});

// Screen name/owner inputs
$('#screen-name-search').change(function(){
    query_update_inputs(false);
});
$('#screen-owner-search').change(function(){
    query_update_inputs(false);
});

// Perform search
$('#screen-query-search-button').click(function(){
    query_screens();
});

// Start condition search
$('#condition-query-button').click(function(){
    $('#condition-query-button-table').css('display', 'none');
    $('#condition-query-header').css('display', 'block');

    // Create condition search tree
    let logic_div = create_logic_div();
    $('#condition-query-div').append(
        logic_div
    );
    let cond_div = append_condition_div(logic_div);
    let chem_div = get_first_chemical_div_from_condition_div(cond_div);
    chem_div.click();
    query_init(cond_div, chem_div);
});

// Cancel condition search
$('#condition-query-cancel-button').click(function() {
    $('#condition-query-header').css('display', 'none');
    $('#condition-query-button-table').css('display', 'table');

    // Destroy condition search tree
    query_empty();
    $('#condition-query-div').empty();
});

// Condition / chemical logic operations
$('#condition-query-and-button').click(function() {
    binop_query('and');
});
$('#condition-query-or-button').click(function() {
    binop_query('or');
});
$('#condition-query-not-button').click(function() {
    not_query();
});
$('#condition-query-remove-button').click(function() {
    remove_query();
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();