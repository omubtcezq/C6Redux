//# sourceURL=screen_query.js
(function() {
// Load once document is ready
$(document).ready(function() {

// Counter for identifying condition and chemical divs in recursive query
let CONDITION_ID_COUNTER = 0;
let CHEMICAL_ID_COUNTER = 0;

// Query object passed to API
let SCREEN_QUERY = {
    'name_search': null,
    'owner_search': null,
    'conds': null
};

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
    let cond_div = create_condition_div();
    let chem_div = get_first_chemical_div_from_condition_div(cond_div)
    chem_div.click();
    query_init(cond_div, chem_div);
    $('#condition-query-div').append(
        create_logic_div().append(cond_div)
    );
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
function create_condition_div() {
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
                cond.append(create_condition_chem_field(cond_id));
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
    // Init condition as being specified by chemical
    let condition_field = create_condition_chem_field(CONDITION_ID_COUNTER);
    condition_div.append(condition_field);

    CONDITION_ID_COUNTER += 1;
    return condition_div;
}

// Create field where condition is specified with chemical information
function create_condition_chem_field(condition_id){
    // Create border and logical operators
    let condition_field = $('<fieldset>').attr('id', 'condition-fieldset'+condition_id)
    .attr('class', 'condition-chem-field').append(
        $('<legend>').text('meet the following')
    );
    // Initialise with a chemical
    let chem_div = create_chemical_div();
    condition_field.append(
        $('<div>').attr('id', 'chemical-query'+condition_id).append(
            create_logic_div().append(chem_div)
        )
    );
    return condition_field;
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
        data: [{id: 1, screen: {id: null, name: null}, well: {id: null, name: null}}],
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
            width: 200,
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
            },
            // Update the wells list when screen selected
            cellEdited: function(cell){
                var row = cell.getRow();
                cell.getRow().reformat();
            },
            formatter: function(cell, formatterParams, onRendered){return cell.getValue().id ? cell.getValue().name : "<Search screens>";}
        }, {
            title: "Well", 
            field: "well", 
            vertAlign: "middle",
            width: 200,
            headerSort: false,
            editor: "list", 
            editorParams: {
                values: [],
                // Lookup: function(cell){
                //     // Load users list from api
                //     return 
                // },
                sort: "asc",
                emptyValue: {id: null, name: null},
                placeholderLoading: "Loading Well List...",
                placeholderEmpty: "No Wells Found",
            },
            formatter: function(cell, formatterParams, onRendered){
                if (cell.getData().screen.id == null){
                    return "(Select a screen)"
                }
                return cell.getValue().id ? cell.getValue().name : "<Select well>";
            },
            editable: function (cell) {
                var is_editable = cell.getRow().getData().screen.id != null;
                return is_editable;
            }
        }]
    });
    
    // .append(
    //     $('<table>').attr('class', 'input-table').append(
    //         $('<tr>').append(
    //             $('<td>').append(
    //                 $('<label>').attr('for', 'screen-id'+condition_id).text('Screen Name')
    //             )
    //         ).append(
    //             $('<td>').append(
    //                 $('<input>').attr('id', 'screen-id'+condition_id)
    //                 .attr('class', 'input-wide')
    //                 .attr('name', 'screen-id'+condition_id)
    //                 .attr('placeholder', 'Search screens')
    //                 .attr('autocomplete-id', '')
    //                 .autocomplete({
    //                     source: function (request, response){
    //                         if (SCREEN_NAMES == null){
    //                             $.getJSON(API_URL+'/screens/names', function(screen_names){
    //                                 SCREEN_NAMES = screen_names;
    //                                 response(search_screen_names(request.term, SCREEN_NAMES));
    //                             })
    //                         } else {
    //                             response(search_screen_names(request.term, SCREEN_NAMES));
    //                         }
    //                     },
    //                     select: function(event, ui) {
    //                         let well_dropdown = $(this).closest('.input-table').find('.input-location');
    //                         well_dropdown.empty();
    //                         well_dropdown.attr('disabled', 'disabled');
    //                         let id = ui.item.id;
    //                         if (id){
    //                             $.getJSON(API_URL+'/screens/wellNames?screen_id='+id, function(wells){
    //                                 $.each(wells, function(i, w){
    //                                     well_dropdown.append(
    //                                         $('<option>').attr('value', w.wellcondition_id)
    //                                         .text(w.label)
    //                                     )
    //                                 })
    //                                 well_dropdown.removeAttr('disabled');
    //                             })
    //                         }
    //                     },
    //                     change: function(event, ui){
    //                         let well_dropdown = $(this).closest('.input-table').find('.input-location');
    //                         if (ui.item){
    //                             $(this).val(ui.item.value);
    //                             $(this).attr('autocomplete-id', String(ui.item.id));
    //                             query_update_inputs(false);
    //                         } else {
    //                             $(this).val('');
    //                             $(this).attr('autocomplete-id', '');
    //                             well_dropdown.empty();
    //                             well_dropdown.append(
    //                                 $('<option>').attr('value', '').
    //                                 attr('selected', 'selected').
    //                                 text('No screen selected')
    //                             )
    //                             well_dropdown.attr('disabled', 'disabled');
    //                             query_update_inputs(false);
    //                         }
    //                     },
    //                     minLength: 1
    //                 })
    //             )
    //         )
    //     ).append(
    //         $('<tr>').append(
    //             $('<td>').append(
    //                 $('<label>').attr('for', 'wellcondition-id'+condition_id).text('Location')
    //             )
    //         ).append(
    //             $('<td>').append(
    //                 $('<select>').attr('id', 'wellcondition-id'+condition_id)
    //                 .attr('class', 'input-wide input-location')
    //                 .attr('name', 'wellcondition-id'+condition_id)
    //                 .attr('disabled', 'disabled')
    //                 .append(
    //                     $('<option>').attr('value', '')
    //                     .attr('selected', 'selected')
    //                     .text('No screen selected')
    //                 ).change(function () {
    //                     query_update_inputs(false);
    //                 })
    //             )
    //         )
    //     )
    // );
}

// Create div for specifiying a chemical
function create_chemical_div(){
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
        $('<table>').attr('class', 'input-table').append(
            // Name search
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-id'+CHEMICAL_ID_COUNTER).text('Chemical')
                )
            ).append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-id'+CHEMICAL_ID_COUNTER)
                    .attr('class', 'input-wide')
                    .attr('name', 'chemical-id'+CHEMICAL_ID_COUNTER)
                    .attr('placeholder', 'Search chemicals')
                    .attr('autocomplete-id', '')
                    .autocomplete({
                        source: function (request, response){
                            if (CHEMICAL_NAMES == null){
                                $.getJSON(API_URL+'/chemicals/names', function(chemical_names){
                                    CHEMICAL_NAMES = chemical_names;
                                    response(search_chemical_names(request.term, CHEMICAL_NAMES));
                                })
                            } else {
                                response(search_chemical_names(request.term, CHEMICAL_NAMES));
                            }
                        },
                        select: function(event, ui) {
                            let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                            let id = ui.item.id;
                            if (id){
                                $.getJSON(API_URL+'/chemicals/chemical?chemical_id='+id, function(chemical){
                                    for (i in ALL_UNITS){
                                        if (ALL_UNITS[i] == chemical.unit){
                                            unit_dropdown.val(ALL_UNITS[i]);
                                            unit_dropdown.change();
                                        }
                                    }
                                })
                            }
                        },
                        change: function(event,ui){
                            let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                            if (ui.item){
                                $(this).val(ui.item.value);
                                $(this).attr('autocomplete-id', String(ui.item.id));
                                query_update_inputs(false);
                            } else {
                                $(this).val('');
                                $(this).attr('autocomplete-id', '');
                                unit_dropdown.val(ALL_UNITS[0]);
                                unit_dropdown.change();
                                query_update_inputs(false);
                            }
                        },
                        minLength: 1
                    })
                )
            )
        ).append(
            // Concentration and unit search
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-conc'+CHEMICAL_ID_COUNTER).text('Concentration')
                )
            ).append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-conc'+CHEMICAL_ID_COUNTER)
                    .attr('class', 'input-conc')
                    .attr('name', 'chemical-conc'+CHEMICAL_ID_COUNTER)
                    .attr('type', 'number')
                    .attr('min', '0')
                    .attr('placeholder', 'Range: [0, inf)')
                    .change(function(){
                        if ($(this).val() < 0){
                            $(this).val('');
                        }
                        query_update_inputs(false);
                    })
                ).append(
                    $('<select>').attr('id', 'chemical-units'+CHEMICAL_ID_COUNTER)
                    .attr('class', 'input-units')
                    .attr('name', 'chemical-units'+CHEMICAL_ID_COUNTER).append(
                        ALL_UNITS.map(function(u){
                            let o = $('<option>').attr('value', u).
                                    text(u);
                            return o;
                        })
                    ).
                    change(function(){
                        query_update_inputs(false);
                    })
                )
            )
        ).
        // pH Search
        append(
            $('<tr>').append(
                $('<td>').append(
                    $('<label>').attr('for', 'chemical-ph'+CHEMICAL_ID_COUNTER).text('pH')
                )
            ).append(
                $('<td>').append(
                    $('<input>').attr('id', 'chemical-ph'+CHEMICAL_ID_COUNTER)
                    .attr('class', 'input-wide')
                    .attr('name', 'chemical-ph'+CHEMICAL_ID_COUNTER)
                    .attr('type', 'number')
                    .attr('min', '0')
                    .attr('max', '0')
                    .attr('placeholder', 'Range: [0, 14]')
                    .change(function(){
                        if ($(this).val() < 0 || $(this).val() > 14){
                            $(this).val('');
                        }
                        query_update_inputs(false);
                    })
                )
            )
        )
    );

    chemical_div.click(function (e) {
        e.stopPropagation();
        $('.condition-div').removeClass('selected-query-div');
        $('.chemical-div').removeClass('selected-query-div');
        $(this).addClass('selected-query-div');
    });

    CHEMICAL_ID_COUNTER += 1;
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
    let new_cond_div = create_condition_div();
    let new_chem_div = get_first_chemical_div_from_condition_div(new_cond_div);
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
        new_cond_logic.append(new_cond_div)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
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
    let new_chem_div = create_chemical_div();
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
        new_chem_logic.append(new_chem_div)
    );
    // Insert according to which side was selected ot being with
    if (insert_right){
        logic_parent.append(op_logic);
    } else {
        op_logic.insertBefore(logic_parent.children().last());
    }
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
        query_update_conds(SCREEN_QUERY.conds, alert_validation);
    }
    console.log('Q: ', SCREEN_QUERY);

    // Final validation matching API parser
    if (alert_validation &&
        SCREEN_QUERY.name_search == null &&
        SCREEN_QUERY.owner_search == null &&
        SCREEN_QUERY.conds == null){

        alert_user("Must query screens by at least a name, owner name or by conditions!");
        return false;
    // When not validating always pass
    } else {
        return true;
    }
}

// Condition recursion for update
function query_update_conds(tree, alert_validation){
    // Parse recursively, ending if validation alert occurs
    if (tree.arg.op){
        let validated = query_update_conds(tree.arg.arg_left);
        if (validated){
            query_update_conds(tree.arg.arg_right);
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
            query_update_chems(tree.arg.chems, alert_validation);
        } else {
            tree.arg.id = $('select[name="wellcondition-id'+cond_id+'"]').val();
        }

        // Final validation matching API parser
        if (alert_validation &&
            tree.arg.id == null &&
            tree.arg.chems == null){
                
            alert_user("Must specify condition exclusively either by reference or by chemicals!");
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
    if (tree.arg.op){
        let validated = query_update_chems(tree.arg.arg_left);
        if (validated){
            query_update_chems(tree.arg.arg_right);
        }
        return validated;
    // When in chemical, read individual inputs
    } else {
        let chem_div = tree.arg.q_chemical_div;
        let chem_id = get_chemical_div_id(chem_div);
        if ($('input[name="chemical-quant'+chem_id+'"]:checked').val() == 'a'){
            tree.arg.universal_quantification = true;
        } else {
            tree.arg.universal_quantification = false;
        }
        tree.arg.name_search = null;
        if ($('input[name="chemical-id'+chem_id+'"]').val() == ''){
            tree.arg.id = null;
        } else {
            tree.arg.id = $('input[name="chemical-id'+chem_id+'"]').attr('autocomplete-id');
        }
        if ($('input[name="chemical-conc'+chem_id+'"]').val() == ''){
            tree.arg.conc = null;
            tree.arg.units = null;
        } else {
            tree.arg.conc = $('input[name="chemical-conc'+chem_id+'"]').val();
            tree.arg.units = $('select[name="chemical-units'+chem_id+'"]').val();
        }
        if ($('input[name="chemical-ph'+chem_id+'"]').val() == ''){
            tree.arg.ph = null;
        } else {
            tree.arg.ph = $('input[name="chemical-ph'+chem_id+'"]').val();
        }

        // Final validation matching API parser
        if (alert_validation){
            if (tree.arg.id == null &&
                tree.arg.name_search == null){

                alert_user("Must specify chemical!");
                return false;
            } else if (tree.arg.id == null &&
                tree.arg.name_search == null &&
                tree.arg.conc == null &&
                tree.arg.ph == null){

                alert_user("Must specify chemical with at least name, concentration and unit, or ph!");
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
    // If no errors, clear currently displayed screens and query API
    let api_query = JSON.stringify(SCREEN_QUERY, query_drop_extra);
    screen_table_body = $('#screen-table > tbody');
    screen_table_body.empty();
    $.ajax({
        type: 'POST',
        url: API_URL+'/screens/query', 
        data: api_query, 
        // Display returned screens
        success: function(data) {
            let api_well_query = null;
            if (SCREEN_QUERY.conds){
                api_well_query = JSON.stringify($.extend(true, {}, SCREEN_QUERY.conds), query_drop_extra);
            }
            
            // TODO
            //display_screens(data, api_well_query);
        }, 
        dataType: 'json',
        contentType: 'application/json'
    });
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

});
})();